package com.foodmate.application.runtime.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.foodmate.application.common.service.OperationAuditService;
import com.foodmate.application.food.service.ApprovalService;
import com.foodmate.application.runtime.port.out.ToolGatewayPort;
import com.foodmate.application.runtime.service.CalculatorEvaluator;
import com.foodmate.application.runtime.service.PlanValidator;
import com.foodmate.application.runtime.service.SqlQueryGuard;
import com.foodmate.application.runtime.service.SqlQueryPlanValidator;
import com.foodmate.application.runtime.service.SqlSchemaCatalogService;
import com.foodmate.application.runtime.service.ToolGatewayService;
import com.foodmate.application.runtime.service.ToolPolicy;
import com.foodmate.application.runtime.service.ToolRegistryService;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import com.foodmate.shared.id.IdGenerator;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Java Tool Gateway：Python 只提交 Proposal，Java 负责权限、SQL Guard、执行和审计。 */
@Service
public class ToolGatewayServiceImpl implements ToolGatewayService {
    private static final int MAX_ID_LENGTH = 128;
    private static final int MAX_SQL_LENGTH = 8_192;
    private static final Pattern RELATIVE_DAYS = Pattern.compile("(?:最近|过去|近)\\s*(\\d{1,3})\\s*天");
    private final ToolGatewayPort store;
    private final IdGenerator ids;
    private final ApprovalService approvals;
    private final ObjectMapper mapper;
    private final ToolRegistryService registry;
    private final SqlQueryGuard sqlGuard;
    private final SqlSchemaCatalogService catalogService;
    private final OperationAuditService operationAudit;

    public ToolGatewayServiceImpl(ToolGatewayPort store, IdGenerator ids) {
        this(
                store,
                ids,
                (ApprovalService) null,
                new ObjectMapper().findAndRegisterModules(),
                null,
                null,
                null,
                null);
    }

    @Autowired
    public ToolGatewayServiceImpl(
            ToolGatewayPort store,
            IdGenerator ids,
            ObjectProvider<ApprovalService> approvals,
            ObjectMapper mapper,
            ToolRegistryService registry,
            SqlQueryGuard sqlGuard,
            SqlSchemaCatalogService catalogService,
            ObjectProvider<OperationAuditService> operationAudit) {
        this(
                store,
                ids,
                approvals.getIfAvailable(),
                mapper,
                registry,
                sqlGuard,
                catalogService,
                operationAudit == null ? null : operationAudit.getIfAvailable());
    }

    public ToolGatewayServiceImpl(
            ToolGatewayPort store,
            IdGenerator ids,
            ApprovalService approvals,
            ObjectMapper mapper) {
        this(store, ids, approvals, mapper, null, null, null);
    }

    public ToolGatewayServiceImpl(
            ToolGatewayPort store,
            IdGenerator ids,
            ApprovalService approvals,
            ObjectMapper mapper,
            ToolRegistryService registry) {
        this(store, ids, approvals, mapper, registry, null, null);
    }

    public ToolGatewayServiceImpl(
            ToolGatewayPort store,
            IdGenerator ids,
            ApprovalService approvals,
            ObjectMapper mapper,
            ToolRegistryService registry,
            SqlQueryGuard sqlGuard,
            SqlSchemaCatalogService catalogService) {
        this(store, ids, approvals, mapper, registry, sqlGuard, catalogService, null);
    }

    public ToolGatewayServiceImpl(
            ToolGatewayPort store,
            IdGenerator ids,
            ApprovalService approvals,
            ObjectMapper mapper,
            ToolRegistryService registry,
            SqlQueryGuard sqlGuard,
            SqlSchemaCatalogService catalogService,
            OperationAuditService operationAudit) {
        this.store = store;
        this.ids = ids;
        this.approvals = approvals;
        this.mapper = mapper.copy().findAndRegisterModules();
        this.registry = registry;
        this.sqlGuard = sqlGuard;
        this.catalogService = catalogService;
        this.operationAudit = operationAudit;
    }

    @Override
    @Transactional
    public ProposalResult execute(ProposalCommand proposal) {
        long started = System.nanoTime();
        ProposalResult result = null;
        try {
            result = executeInternal(proposal);
            return result;
        } finally {
            recordToolCallFact(proposal, result, (System.nanoTime() - started) / 1_000_000);
        }
    }

    private ProposalResult executeInternal(ProposalCommand proposal) {
        if (proposal == null) return reject(null, "PROPOSAL_NOT_ALLOWED");
        String proposalId = text(proposal.proposalId());
        String runId = text(proposal.runId());
        String type = text(proposal.proposalType());
        ProposalPayload payload = proposal.payload();
        String statement = payload == null ? null : text(payload.statement());
        String invocationId = payload == null ? null : text(payload.invocationId());
        if (!"v1".equals(text(proposal.schemaVersion()))
                || proposalId == null
                || runId == null
                || invocationId == null
                || proposalId.length() > MAX_ID_LENGTH
                || runId.length() > MAX_ID_LENGTH
                || invocationId.length() > MAX_ID_LENGTH)
            return reject(proposalId, "PROPOSAL_NOT_ALLOWED");
        if (registry != null) {
            ToolRegistryService.ToolView tool;
            String toolName =
                    "sql_read".equals(type) ? "database_query" : text(proposal.toolName());
            try {
                // schema_version is the wire protocol version; registry versioning is independent.
                tool = registry.resolve(toolName, null);
            } catch (BusinessException exception) {
                return reject(proposalId, exception.errorCode().code());
            }
            if ("sql_read".equals(type) && !"database_query".equals(tool.name()))
                return reject(proposalId, "TOOL_NAME_NOT_ALLOWED");
            if ("tool".equals(type)) {
                String schemaError = ToolPolicy.validateInput(tool, proposal.input());
                if (schemaError != null) return reject(proposalId, schemaError);
                if (ToolPolicy.requiresConfirmation(tool)
                        && (text(proposal.confirmationRef()) == null
                                || payload == null
                                || text(payload.idempotencyKey()) == null)
                        && (!isApprovalTool(tool.name()) || approvals == null))
                    return result(
                            proposalId,
                            runId,
                            invocationId,
                            "confirmation_required",
                            "TOOL_CONFIRMATION_REQUIRED",
                            null);
            }
            if ("tool".equals(type)
                    && !"database_query".equals(tool.name())
                    && !"time_parser".equals(tool.name())
                    && !"food_log_writer".equals(tool.name())
                    && !"meal_plan.save_plan".equals(tool.name())
                    && !"calculator".equals(tool.name())
                    && !"plan_validator".equals(tool.name()))
                return reject(proposalId, "TOOL_EXECUTOR_UNAVAILABLE");
        }
        if (registry == null) {
            if ("food_log_writer".equals(proposal.toolName()) && !"tool".equals(type))
                return reject(proposalId, "PROPOSAL_NOT_ALLOWED");
            if ("tool".equals(type)
                    && !"database_query".equals(proposal.toolName())
                    && !"time_parser".equals(proposal.toolName())
                    && !"food_log_writer".equals(proposal.toolName())
                    && !"calculator".equals(proposal.toolName())
                    && !"plan_validator".equals(proposal.toolName())
                    && !"meal_plan.save_plan".equals(proposal.toolName()))
                return reject(proposalId, "TOOL_NAME_NOT_ALLOWED");
            if ("sql_read".equals(type)
                    && proposal.toolName() != null
                    && !"database_query".equals(proposal.toolName()))
                return reject(proposalId, "TOOL_NAME_NOT_ALLOWED");
        }
        if ("food_log_writer".equals(proposal.toolName()))
            return executeApprovalWrite(
                    proposal, proposalId, runId, invocationId, "food_log_writer");
        if ("meal_plan.save_plan".equals(proposal.toolName()))
            return executeApprovalWrite(
                    proposal, proposalId, runId, invocationId, "meal_plan.save_plan");
        if ("tool".equals(type) && "time_parser".equals(proposal.toolName()))
            return executeTimeParser(proposalId, runId, invocationId, proposal.input());
        if ("tool".equals(type) && "calculator".equals(proposal.toolName()))
            return executeCalculator(proposalId, runId, invocationId, proposal.input());
        if ("tool".equals(type) && "plan_validator".equals(proposal.toolName()))
            return executePlanValidator(proposalId, runId, invocationId, proposal.input());
        if ("tool".equals(type) && "database_query".equals(proposal.toolName())) {
            String planError = SqlQueryPlanValidator.validate(proposal.input(), statement);
            if (planError != null) return reject(proposalId, planError);
            return executeValidated(proposalId, runId, statement, invocationId);
        }
        if (!"sql_read".equals(type)) return reject(proposalId, "PROPOSAL_NOT_ALLOWED");
        return executeValidated(proposalId, runId, statement, invocationId);
    }

    /** 工具执行只记录安全摘要，原始 SQL、问题和业务载荷分别留在专用审计边界。 */
    private void recordToolCallFact(
            ProposalCommand proposal, ProposalResult result, long latencyMs) {
        if (proposal == null || result == null || text(result.toolName()) == null) return;
        long runId;
        try {
            runId = Long.parseLong(text(proposal.runId()));
        } catch (NumberFormatException exception) {
            return;
        }
        ObjectNode input = mapper.createObjectNode();
        String statement =
                proposal.payload() == null ? null : text(proposal.payload().statement());
        String inputDigest =
                proposal.input() == null
                        ? digest(statement)
                        : digest(proposal.input().toString());
        input.put("input_digest", inputDigest);
        input.put("input_kind", proposal.input() == null ? "statement" : "json");
        if (statement != null && !statement.isBlank())
            input.put("statement_digest", digest(statement));

        ObjectNode output = mapper.createObjectNode();
        String resultStatus = text(result.status());
        output.put("status", resultStatus == null ? "failed" : resultStatus);
        output.put("row_count", result.rows() == null ? 0 : result.rows().size());
        if (result.sqlAuditId() != null) output.put("sql_audit_id", result.sqlAuditId());
        if (result.errorCode() != null) output.put("error_code", result.errorCode());
        int boundedLatency = (int) Math.min(Integer.MAX_VALUE, Math.max(0L, latencyMs));
        store.recordToolCall(
                new ToolGatewayPort.ToolCall(
                        ids.nextId(),
                        runId,
                        text(result.toolName()),
                        "v1",
                        safeJson(input),
                        safeJson(output),
                        persistedToolCallStatus(resultStatus),
                        boundedLatency,
                        result.errorCode(),
                        truncateTrace("proposal:" + text(proposal.proposalId()))));
    }

    private static String persistedToolCallStatus(String status) {
        return switch (status == null ? "failed" : status) {
            case "succeeded", "success" -> "success";
            case "confirmation_required", "pending" -> "pending";
            case "cancelled" -> "cancelled";
            default -> "failed";
        };
    }

    private String safeJson(JsonNode value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            return "{}";
        }
    }

    private static String truncateTrace(String value) {
        return value.substring(0, Math.min(64, value.length()));
    }

    private ProposalResult executeApprovalWrite(
            ProposalCommand proposal,
            String proposalId,
            String runId,
            String invocationId,
            String toolName) {
        if (approvals == null || proposal.input() == null)
            return reject(proposalId, "TOOL_NOT_CONFIGURED");
        String confirmationRef = text(proposal.confirmationRef());
        String idempotencyKey =
                proposal.payload() == null ? null : text(proposal.payload().idempotencyKey());
        if (idempotencyKey == null)
            return result(
                    proposalId,
                    runId,
                    invocationId,
                    "confirmation_required",
                    "TOOL_CONFIRMATION_REQUIRED",
                    null);
        // 兼容不带完整本地运行装配的纯协议调用；生产 Spring 装配始终提供审计和审批服务。
        if (confirmationRef == null && operationAudit == null)
            return result(
                    proposalId,
                    runId,
                    invocationId,
                    "confirmation_required",
                    "TOOL_CONFIRMATION_REQUIRED",
                    null);
        long approvalId = 0;
        long numericRunId;
        try {
            numericRunId = Long.parseLong(runId);
            if (confirmationRef != null) approvalId = Long.parseLong(confirmationRef);
        } catch (NumberFormatException exception) {
            return reject(proposalId, "TOOL_CONFIRMATION_INVALID");
        }
        ToolGatewayPort.RunContext context = store.runContext(numericRunId);
        if (context == null) return reject(proposalId, "RUN_NOT_FOUND");
        if (confirmationRef == null) {
            try {
                boolean mealPlan = "meal_plan.save_plan".equals(toolName);
                ApprovalService.ProposalView approval =
                        approvals.propose(
                                context.userId(),
                                new ApprovalService.ProposalCommand(
                                        context.sessionId(),
                                        numericRunId,
                                        mealPlan ? "save_plan" : "create",
                                        mealPlan ? "meal_plan" : "food_log",
                                        null,
                                        proposal.input(),
                                        idempotencyKey,
                                        900));
                return result(
                        proposalId,
                        runId,
                        invocationId,
                        "confirmation_required",
                        "TOOL_CONFIRMATION_REQUIRED",
                        confirmationRows(approval.approvalRequestId(), proposal.input(), toolName),
                        Long.toString(approval.approvalRequestId()),
                        toolName);
            } catch (BusinessException exception) {
                return result(
                        proposalId,
                        runId,
                        invocationId,
                        "rejected",
                        exception.errorCode().code(),
                        null);
            }
        }
        long started = System.nanoTime();
        try {
            ApprovalService.ExecuteView execution =
                    approvals.executeForAgent(
                            context.userId(),
                            numericRunId,
                            approvalId,
                            idempotencyKey,
                            proposal.input());
            if (!"executed".equals(execution.status()))
                return result(
                        proposalId,
                        runId,
                        invocationId,
                        execution.status(),
                        "TOOL_EXECUTION_FAILED",
                        null);
            long resourceId = execution.resourceId();
            ObjectNode row = mapper.createObjectNode();
            row.put(
                    "meal_plan.save_plan".equals(toolName) ? "meal_plan_id" : "food_log_id",
                    Long.toString(resourceId));
            row.put("status", "saved");
            if (execution.secondaryResourceId() != null)
                row.put("shopping_list_id", Long.toString(execution.secondaryResourceId()));
            List<JsonNode> rows = List.of(row);
            long sqlAuditId = ids.nextId();
            store.audit(
                    new ToolGatewayPort.Audit(
                            sqlAuditId,
                            numericRunId,
                            toolName,
                            "executed",
                            1,
                            null,
                            (System.nanoTime() - started) / 1_000_000,
                            "proposal:" + proposalId));
            return result(proposalId, runId, invocationId, "success", null, rows);
        } catch (BusinessException exception) {
            String toolErrorCode = exception.details().path("tool_error_code").asText(null);
            String status;
            String errorCode;
            if ("TOOL_CONFIRMATION_REQUIRED".equals(toolErrorCode)
                    || "TOOL_CONFIRMATION_EXPIRED".equals(toolErrorCode)) {
                status = "confirmation_required";
                errorCode = toolErrorCode;
            } else if ("TOOL_CONFIRMATION_REJECTED".equals(toolErrorCode)) {
                status = "rejected";
                errorCode = toolErrorCode;
            } else if ("TOOL_CONFIRMATION_SUPERSEDED".equals(toolErrorCode)) {
                status = "superseded";
                errorCode = toolErrorCode;
            } else if ("TOOL_EXECUTION_FAILED".equals(toolErrorCode)) {
                status = "failed";
                errorCode = toolErrorCode;
            } else if ("TOOL_IDEMPOTENCY_CONFLICT".equals(toolErrorCode)) {
                status = "failed";
                errorCode = toolErrorCode;
            } else if (exception.errorCode() == ErrorCode.FORBIDDEN) {
                status = "denied";
                errorCode = "TOOL_POLICY_DENIED";
            } else if (exception.errorCode() == ErrorCode.CONFLICT) {
                status = "failed";
                errorCode = "TOOL_FAILED";
            } else {
                status = "denied";
                errorCode = "TOOL_POLICY_DENIED";
            }
            return result(proposalId, runId, invocationId, status, errorCode, null);
        } catch (RuntimeException exception) {
            return result(proposalId, runId, invocationId, "failed", "TOOL_EXECUTION_FAILED", null);
        }
    }

    private ProposalResult result(
            String proposalId,
            String runId,
            String invocationId,
            String status,
            String errorCode,
            List<JsonNode> rows) {
        return new ProposalResult(
                proposalId, runId, status, errorCode, rows == null ? List.of() : rows);
    }

    private ProposalResult result(
            String proposalId,
            String runId,
            String invocationId,
            String status,
            String errorCode,
            List<JsonNode> rows,
            String confirmationRef,
            String toolName) {
        return new ProposalResult(
                proposalId,
                runId,
                status,
                errorCode,
                rows == null ? List.of() : rows,
                null,
                toolName,
                confirmationRef);
    }

    private static boolean isApprovalTool(String toolName) {
        return "food_log_writer".equals(toolName) || "meal_plan.save_plan".equals(toolName);
    }

    /** 返回给确认卡的最小业务摘要，不把完整请求原文写入运行事件。 */
    private List<JsonNode> confirmationRows(
            long approvalRequestId, JsonNode input, String toolName) {
        ObjectNode row = mapper.createObjectNode();
        row.put("approval_request_id", Long.toString(approvalRequestId));
        boolean mealPlan = "meal_plan.save_plan".equals(toolName);
        row.put("operation", mealPlan ? "save_plan" : "create");
        row.put("resource_type", mealPlan ? "meal_plan" : "food_log");
        if (mealPlan) {
            copySafePlan(row, input == null ? null : input.get("plan"));
            return List.of(row);
        }
        if (input != null) {
            copySafeText(row, input, "meal_time");
            copySafeText(row, input, "meal_type");
            if (input.has("notes")) {
                JsonNode notes = input.get("notes");
                if (notes == null || notes.isNull()) row.putNull("notes");
                else copySafeText(row, input, "notes");
            }
            ArrayNode items = row.putArray("items");
            JsonNode rawItems = input.path("items");
            if (rawItems.isArray()) {
                for (JsonNode item : rawItems) {
                    if (!item.isObject() || items.size() >= 50) continue;
                    ObjectNode safeItem = mapper.createObjectNode();
                    copySafeText(safeItem, item, "name");
                    copySafeText(safeItem, item, "raw_name");
                    if (item.path("amount").isNumber())
                        safeItem.set("amount", item.path("amount").deepCopy());
                    copySafeText(safeItem, item, "unit");
                    items.add(safeItem);
                }
            }
        }
        return List.of(row);
    }

    /** 返回餐食计划确认所需的有限结构，不暴露运行凭据或对象存储信息。 */
    private void copySafePlan(ObjectNode target, JsonNode plan) {
        if (plan == null || !plan.isObject()) return;
        ObjectNode safePlan = mapper.createObjectNode();
        for (String field :
                List.of(
                        "plan_name",
                        "people",
                        "days",
                        "budget",
                        "calorie_target",
                        "protein_target",
                        "allergens",
                        "dislikes")) {
            JsonNode value = plan.get(field);
            if (value != null && (value.isValueNode() || value.isArray()))
                safePlan.set(field, value.deepCopy());
        }
        JsonNode daysPlan = plan.get("days_plan");
        if (daysPlan != null && daysPlan.isArray() && daysPlan.size() <= 7)
            safePlan.set("days_plan", daysPlan.deepCopy());
        target.set("plan", safePlan);
    }

    private void copySafeText(ObjectNode target, JsonNode source, String field) {
        JsonNode value = source.get(field);
        if (value != null && value.isTextual() && value.asText().length() <= 256)
            target.put(field, value.asText());
    }

    private ProposalResult executeTimeParser(
            String proposalId, String runId, String invocationId, JsonNode input) {
        String question = input == null ? null : text(input.path("question").asText(null));
        String timezone = input == null ? null : text(input.path("timezone").asText(null));
        if (question == null || question.length() > 2_000)
            return toolResult(
                    proposalId, runId, "failed", "TIME_RANGE_INPUT_INVALID", List.of(), null);
        if (timezone == null) timezone = "Asia/Shanghai";
        long numericRunId;
        try {
            numericRunId = Long.parseLong(runId);
        } catch (NumberFormatException exception) {
            return reject(proposalId, "RUN_ID_INVALID");
        }
        if (!store.runExists(numericRunId)) return reject(proposalId, "RUN_NOT_FOUND");
        ZonedDateTime now;
        try {
            now = ZonedDateTime.now(ZoneId.of(timezone));
        } catch (RuntimeException exception) {
            return toolResult(proposalId, runId, "failed", "TIMEZONE_INVALID", List.of(), null);
        }
        ZonedDateTime from;
        ZonedDateTime to;
        Matcher matcher = RELATIVE_DAYS.matcher(question);
        if (matcher.find()) {
            int days = Integer.parseInt(matcher.group(1));
            if (days < 1 || days > 90)
                return toolResult(
                        proposalId, runId, "failed", "TIME_RANGE_OUT_OF_BOUNDS", List.of(), null);
            from = now.minusDays(days);
            to = now;
        } else if (question.contains("最近一周")
                || question.contains("过去一周")
                || question.contains("近一周")) {
            from = now.minusDays(7);
            to = now;
        } else if (question.contains("昨天")) {
            from = now.toLocalDate().minusDays(1).atStartOfDay(now.getZone());
            to = from.plusDays(1);
        } else if (question.contains("今天") || question.contains("今日")) {
            from = now.toLocalDate().atStartOfDay(now.getZone());
            to = from.plusDays(1);
        } else {
            return toolResult(
                    proposalId, runId, "failed", "TIME_RANGE_UNSUPPORTED", List.of(), null);
        }
        ObjectNode row = mapper.createObjectNode();
        row.put("from", from.toInstant().toString());
        row.put("to", to.toInstant().toString());
        row.put("timezone", timezone);
        row.put("days", Math.max(1, java.time.Duration.between(from, to).toDays()));
        long auditId = ids.nextId();
        store.audit(
                new ToolGatewayPort.Audit(
                        auditId,
                        numericRunId,
                        "time_parser",
                        "executed",
                        1,
                        null,
                        0,
                        "proposal:" + proposalId));
        return toolResult(
                proposalId, runId, "succeeded", null, List.of(row), Long.toString(auditId));
    }

    private ProposalResult toolResult(
            String proposalId,
            String runId,
            String status,
            String errorCode,
            List<JsonNode> rows,
            String auditId) {
        return new ProposalResult(
                proposalId,
                runId,
                status,
                errorCode,
                rows == null ? List.of() : rows,
                auditId,
                "time_parser");
    }

    private ProposalResult executeCalculator(
            String proposalId, String runId, String invocationId, JsonNode input) {
        String expression = input == null ? null : text(input.path("expression").asText(null));
        long numericRunId;
        try {
            numericRunId = Long.parseLong(runId);
        } catch (NumberFormatException exception) {
            return reject(proposalId, "RUN_ID_INVALID");
        }
        if (!store.runExists(numericRunId)) return reject(proposalId, "RUN_NOT_FOUND");
        CalculatorEvaluator.Evaluation evaluation = CalculatorEvaluator.evaluate(expression);
        ObjectNode row = mapper.createObjectNode();
        if (!evaluation.succeeded()) {
            auditTool(
                    numericRunId,
                    invocationId,
                    "calculator",
                    "failed",
                    evaluation.errorCode(),
                    expression);
            return toolResult(
                    proposalId,
                    runId,
                    "failed",
                    evaluation.errorCode(),
                    List.of(),
                    null,
                    "calculator");
        }
        BigDecimal value = evaluation.value();
        row.put("result", value);
        row.put("formula", expression.trim());
        row.putArray("warnings");
        auditTool(numericRunId, invocationId, "calculator", "success", null, expression);
        return toolResult(proposalId, runId, "succeeded", null, List.of(row), null, "calculator");
    }

    private ProposalResult executePlanValidator(
            String proposalId, String runId, String invocationId, JsonNode input) {
        long numericRunId;
        try {
            numericRunId = Long.parseLong(runId);
        } catch (NumberFormatException exception) {
            return reject(proposalId, "RUN_ID_INVALID");
        }
        if (!store.runExists(numericRunId)) return reject(proposalId, "RUN_NOT_FOUND");
        JsonNode plan = input == null ? null : input.get("plan");
        PlanValidator.Validation validation = PlanValidator.evaluate(plan);
        String errorCode = validation.valid() ? null : "PLAN_CONSTRAINTS_UNSATISFIED";
        auditTool(
                numericRunId,
                invocationId,
                "plan_validator",
                validation.valid() ? "success" : "failed",
                errorCode,
                plan == null ? null : plan.toString());
        return toolResult(
                proposalId,
                runId,
                validation.valid() ? "succeeded" : "failed",
                errorCode,
                List.of(validation.asJson()),
                null,
                "plan_validator");
    }

    private void auditTool(
            long runId,
            String invocationId,
            String toolName,
            String result,
            String errorCode,
            String sensitiveInput) {
        if (operationAudit == null) return;
        ToolGatewayPort.RunContext context = store.runContext(runId);
        operationAudit.record(
                context == null ? null : context.userId(),
                "agent_tool",
                Long.toString(runId),
                "tool." + toolName + ".execute",
                result,
                errorCode,
                digest(sensitiveInput),
                null,
                java.util.Map.of("invocation_id", invocationId));
    }

    private String digest(String value) {
        if (value == null) return "none";
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private ProposalResult toolResult(
            String proposalId,
            String runId,
            String status,
            String errorCode,
            List<JsonNode> rows,
            String auditId,
            String toolName) {
        return new ProposalResult(
                proposalId,
                runId,
                status,
                errorCode,
                rows == null ? List.of() : rows,
                auditId,
                toolName);
    }

    /** 执行最小 sql_read Proposal；无数据库时明确返回不可用，不回退到进程内伪造数据。 */
    private ProposalResult executeValidated(
            String proposalId, String runId, String statement, String invocationId) {
        if (statement == null || statement.length() > MAX_SQL_LENGTH)
            return reject(proposalId, "SQL_PROPOSAL_NOT_READ_ONLY");
        if (sqlGuard == null
                && !statement.trim().toLowerCase(java.util.Locale.ROOT).startsWith("select"))
            return reject(proposalId, "SQL_PROPOSAL_NOT_READ_ONLY");
        long numericRunId;
        try {
            numericRunId = Long.parseLong(runId);
        } catch (NumberFormatException exception) {
            return reject(proposalId, "RUN_ID_INVALID");
        }
        ToolGatewayPort.RunContext context = null;
        SqlQueryGuard.GuardedQuery guarded = null;
        if (sqlGuard != null && catalogService != null) {
            context = store.runContext(numericRunId);
            if (context == null) return reject(proposalId, "RUN_NOT_FOUND");
            try {
                guarded =
                        sqlGuard.guard(
                                statement,
                                catalogService.current(context.datasourceId()),
                                context.userId());
            } catch (BusinessException exception) {
                return reject(proposalId, exception.errorCode().code());
            }
        } else if (!store.runExists(numericRunId)) {
            return reject(proposalId, "RUN_NOT_FOUND");
        }
        long started = System.nanoTime();
        long sqlAuditId = ids.nextId();
        List<JsonNode> rows;
        try {
            rows =
                    guarded == null
                            ? store.executeRead(statement)
                            : store.executeRead(
                                    guarded.statement(), guarded.parameters(), guarded.timeoutMs());
            if (rows.size() > 500) rows = rows.subList(0, 500);
            store.audit(
                    new ToolGatewayPort.Audit(
                            sqlAuditId,
                            numericRunId,
                            guarded == null ? statement : guarded.statement(),
                            "executed",
                            rows.size(),
                            null,
                            (System.nanoTime() - started) / 1_000_000,
                            "proposal:" + proposalId));
            return new ProposalResult(
                    proposalId,
                    runId,
                    "succeeded",
                    null,
                    rows,
                    Long.toString(sqlAuditId),
                    "database_query");
        } catch (RuntimeException error) {
            store.audit(
                    new ToolGatewayPort.Audit(
                            sqlAuditId,
                            numericRunId,
                            statement,
                            "rejected",
                            null,
                            truncateReason(error.getMessage()),
                            (System.nanoTime() - started) / 1_000_000,
                            "proposal:" + proposalId));
            return new ProposalResult(
                    proposalId,
                    runId,
                    "failed",
                    "SQL_EXECUTION_FAILED",
                    List.of(),
                    Long.toString(sqlAuditId),
                    "database_query");
        }
    }

    private ProposalResult reject(String proposalId, String code) {
        return new ProposalResult(proposalId, null, "rejected", code, List.of());
    }

    /** 审计表的 reject_reason 是 varchar(255)，避免数据库异常文本反过来遮蔽原始失败结果。 */
    private static String truncateReason(String value) {
        if (value == null || value.isBlank()) return "tool execution failed";
        return value.substring(0, Math.min(255, value.length()));
    }

    private static String text(Object value) {
        if (value == null || value.toString().isBlank() || value.toString().length() > 10000)
            return null;
        return value.toString();
    }
}

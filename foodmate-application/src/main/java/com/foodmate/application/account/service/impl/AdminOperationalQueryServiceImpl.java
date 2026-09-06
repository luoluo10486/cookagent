package com.foodmate.application.account.service.impl;

import com.foodmate.application.account.port.out.AdminOperationalQueryRepository;
import com.foodmate.application.account.port.out.AdminOperationalQueryRepository.Query;
import com.foodmate.application.account.service.AdminOperationalQueryService;
import com.foodmate.shared.error.BusinessException;
import com.foodmate.shared.error.ErrorCode;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class AdminOperationalQueryServiceImpl implements AdminOperationalQueryService {
    private static final Set<String> RESOURCES =
            Set.of(
                    "runs",
                    "traces",
                    "users",
                    "tool-calls",
                    "sql-audits",
                    "tools",
                    "usage",
                    "knowledge",
                    "deleted",
                    "operation-audits",
                    "dlq");

    private final AdminOperationalQueryRepository store;

    public AdminOperationalQueryServiceImpl(AdminOperationalQueryRepository store) {
        this.store = store;
    }

    @Override
    public Page<?> query(String resource, Request request) {
        String normalizedResource =
                resource == null ? "" : resource.trim().toLowerCase(Locale.ROOT);
        if (!RESOURCES.contains(normalizedResource))
            throw new IllegalArgumentException("unsupported admin query resource");
        Request safeRequest =
                request == null
                        ? new Request(1, 20, null, null, null, null, null)
                        : request.normalized();
        Query query = toQuery(normalizedResource, safeRequest);
        return switch (normalizedResource) {
            case "users" ->
                    page(store.users(query), store.countUsers(query), safeRequest, this::user);
            case "runs" -> page(store.runs(query), store.countRuns(query), safeRequest, this::run);
            case "traces" ->
                    page(store.traces(query), store.countTraces(query), safeRequest, this::trace);
            case "tool-calls" ->
                    page(
                            store.toolCalls(query),
                            store.countToolCalls(query),
                            safeRequest,
                            this::toolCall);
            case "sql-audits" ->
                    page(
                            store.sqlAudits(query),
                            store.countSqlAudits(query),
                            safeRequest,
                            this::sqlAudit);
            case "tools" ->
                    page(store.tools(query), store.countTools(query), safeRequest, this::tool);
            case "usage" ->
                    page(store.usage(query), store.countUsage(query), safeRequest, this::usage);
            case "knowledge" ->
                    page(
                            store.knowledge(query),
                            store.countKnowledge(query),
                            safeRequest,
                            this::knowledge);
            case "deleted" ->
                    page(
                            store.deleted(query),
                            store.countDeleted(query),
                            safeRequest,
                            this::deleted);
            case "operation-audits" ->
                    page(
                            store.operationAudits(query),
                            store.countOperationAudits(query),
                            safeRequest,
                            this::operationAudit);
            case "dlq" -> page(store.dlq(query), store.countDlq(query), safeRequest, this::dlq);
            default -> throw new IllegalArgumentException("unsupported admin query resource");
        };
    }

    @Override
    public Page<OperationAudit> operationAuditsForUser(long userId, int page, int size) {
        if (userId <= 0) throw new IllegalArgumentException("user id must be positive");
        int safePage = Math.max(1, Math.min(page, 1_000_000));
        int safeSize = Math.min(100, Math.max(1, size));
        int offset = (safePage - 1) * safeSize;
        return new Page<>(
                store.operationAuditsForUser(userId, safeSize, offset).stream()
                        .map(this::operationAudit)
                        .toList(),
                store.countOperationAuditsForUser(userId),
                safePage,
                safeSize);
    }

    @Override
    public TraceDetail traceDetail(String traceId) {
        String normalizedTraceId = normalizeTraceId(traceId);
        AdminOperationalQueryRepository.TraceRow summary = store.traceById(normalizedTraceId);
        if (summary == null) throw new BusinessException(ErrorCode.NOT_FOUND, "trace not found");
        return new TraceDetail(
                trace(summary),
                store.traceSpans(normalizedTraceId).stream().map(this::traceSpan).toList());
    }

    private static String normalizeTraceId(String traceId) {
        if (traceId == null || traceId.isBlank() || traceId.length() > 64)
            throw new BusinessException(ErrorCode.INVALID_ARGUMENT, "trace id is invalid");
        return traceId.trim();
    }

    private Query toQuery(String resource, Request request) {
        String sort = request.sort();
        if (sort == null) sort = defaultSort(resource);
        if (!allowedSort(resource).contains(sort))
            throw new IllegalArgumentException("unsupported sort field for resource");
        return new Query(
                request.query(),
                request.status(),
                request.visibility(),
                sort,
                request.direction(),
                request.size(),
                (request.page() - 1) * request.size());
    }

    private static String defaultSort(String resource) {
        return switch (resource) {
            case "users" -> "created_at";
            case "tools" -> "name";
            case "usage" -> "created_at";
            default -> "created_at";
        };
    }

    private static Set<String> allowedSort(String resource) {
        return switch (resource) {
            case "users" -> Set.of("created_at", "username", "status");
            case "runs" -> Set.of("created_at", "duration_ms", "status");
            case "traces" -> Set.of("started_at", "duration_ms", "status");
            case "tool-calls" -> Set.of("created_at", "latency_ms", "status");
            case "sql-audits" -> Set.of("created_at", "latency_ms", "status");
            case "tools" -> Set.of("name", "updated_at", "status");
            case "usage" -> Set.of("created_at", "latency_ms", "status");
            case "knowledge" -> Set.of("updated_at", "title", "status");
            case "deleted" -> Set.of("deleted_at", "resource_type");
            case "operation-audits" -> Set.of("created_at", "result", "action");
            case "dlq" -> Set.of("first_seen_at", "reconciled_at", "reconsume_times", "state");
            default -> Set.of();
        };
    }

    private <R, T> Page<T> page(
            List<R> rows, long total, Request request, java.util.function.Function<R, T> mapper) {
        return new Page<>(
                rows.stream().map(mapper).toList(), total, request.page(), request.size());
    }

    private Run run(AdminOperationalQueryRepository.RunRow row) {
        return new Run(
                row.agentRunId(),
                row.sessionId(),
                row.intent(),
                row.status(),
                row.traceId(),
                row.durationMs(),
                row.actorRef());
    }

    private User user(AdminOperationalQueryRepository.UserRow row) {
        return new User(row.userId(), row.username(), row.role(), row.status(), row.emailRef());
    }

    private Trace trace(AdminOperationalQueryRepository.TraceRow row) {
        return new Trace(
                row.traceId(),
                row.runId(),
                row.entry(),
                row.status(),
                row.startedAt(),
                row.durationMs(),
                row.spanCount(),
                row.rootService(),
                row.errorCode());
    }

    private TraceSpan traceSpan(AdminOperationalQueryRepository.TraceSpanRow row) {
        return new TraceSpan(
                row.spanId(),
                row.spanType(),
                row.name(),
                row.service(),
                row.status(),
                row.startedAt(),
                row.finishedAt(),
                row.durationMs(),
                row.errorCode(),
                row.sequenceNo());
    }

    private ToolCall toolCall(AdminOperationalQueryRepository.ToolCallRow row) {
        return new ToolCall(
                row.toolCallId(),
                row.agentRunId(),
                row.toolName(),
                row.status(),
                row.latencyMs(),
                row.traceId());
    }

    private SqlAudit sqlAudit(AdminOperationalQueryRepository.SqlAuditRow row) {
        return new SqlAudit(
                row.sqlAuditId(),
                row.actor(),
                row.queryHash(),
                row.result(),
                row.traceId(),
                row.latencyMs(),
                row.rowCount(),
                row.errorCode(),
                row.createdAt());
    }

    private Tool tool(AdminOperationalQueryRepository.ToolRow row) {
        return new Tool(
                row.name(),
                row.version(),
                row.risk(),
                row.status(),
                row.scope(),
                row.owner(),
                row.lastCalledAt());
    }

    private Usage usage(AdminOperationalQueryRepository.UsageRow row) {
        return new Usage(
                row.provider(),
                row.model(),
                row.scene(),
                row.tokens(),
                row.cost(),
                row.latencyMs(),
                row.status());
    }

    private Knowledge knowledge(AdminOperationalQueryRepository.KnowledgeRow row) {
        return new Knowledge(
                row.documentId(),
                row.title(),
                row.status(),
                row.visibility(),
                row.chunks(),
                row.source(),
                row.indexProgress(),
                row.updatedAt());
    }

    private DeletedResource deleted(AdminOperationalQueryRepository.DeletedRow row) {
        return new DeletedResource(
                row.resourceType(),
                row.resourceId(),
                row.ownerRef(),
                row.deletedAt(),
                row.reason());
    }

    private OperationAudit operationAudit(AdminOperationalQueryRepository.OperationAuditRow row) {
        return new OperationAudit(
                row.operatorId(),
                row.action(),
                row.targetType(),
                row.targetId(),
                row.result(),
                row.requestId(),
                row.traceId(),
                row.createdAt());
    }

    private Dlq dlq(AdminOperationalQueryRepository.DlqRow row) {
        return new Dlq(
                row.dlqId(),
                row.consumerGroup(),
                row.sourceTopic(),
                row.messageId(),
                row.runId(),
                row.dispatchId(),
                row.eventId(),
                row.attempt(),
                row.reconsumeTimes(),
                row.errorCode(),
                row.reconciliationState(),
                row.firstSeenAt(),
                row.reconciledAt());
    }
}

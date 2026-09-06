package com.foodmate.application.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.foodmate.application.common.service.OperationAuditService;
import com.foodmate.application.food.service.ApprovalService;
import com.foodmate.application.runtime.port.out.ToolGatewayPort;
import com.foodmate.application.runtime.port.out.ToolRegistryRepository;
import com.foodmate.application.runtime.service.ToolGatewayService;
import com.foodmate.application.runtime.service.ToolRegistryCatalog;
import com.foodmate.application.runtime.service.ToolRegistryService;
import com.foodmate.application.runtime.service.impl.ToolGatewayServiceImpl;
import com.foodmate.application.runtime.service.impl.ToolRegistryServiceImpl;
import com.foodmate.shared.id.IdGenerator;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ToolPolicyGatewayServiceTest {
    private final ToolGatewayPort store = mock(ToolGatewayPort.class);
    private final ToolRegistryRepository registryStore = mock(ToolRegistryRepository.class);
    private final OperationAuditService audit = mock(OperationAuditService.class);
    private final IdGenerator ids = () -> 99L;

    @Test
    void resolvesDatabaseQueryFromSqlReadAndDoesNotRequireConfirmation() {
        ToolRegistryService registry = registryWith("database_query");
        when(store.runExists(42L)).thenReturn(true);
        when(store.runContext(42L)).thenReturn(new ToolGatewayPort.RunContext(7L, 8L));
        when(store.executeRead("SELECT 1"))
                .thenReturn(List.of(JsonNodeFactory.instance.objectNode().put("value", 1)));

        var result = gateway(registry).execute(sqlProposal("SELECT 1"));

        assertEquals("succeeded", result.status());
        assertEquals(1, result.rows().size());
    }

    @Test
    void rejectsUnknownRegistryToolBeforeAnyExecution() {
        when(registryStore.findCurrent("unknown_tool")).thenReturn(null);

        var result = gateway(registry()).execute(toolProposal("unknown_tool", object()));

        assertEquals("TOOL_NOT_FOUND", result.errorCode());
        verifyNoInteractions(store);
    }

    @Test
    void appliesWriterSchemaAndConfirmationPolicyBeforeApproval() {
        ToolRegistryService registry = registryWith("food_log_writer");
        var input = object();
        input.putArray("items").addObject().put("name", "rice");

        var result = gateway(registry).execute(toolProposal("food_log_writer", input));

        assertEquals("confirmation_required", result.status());
        assertEquals("TOOL_CONFIRMATION_REQUIRED", result.errorCode());
        verifyNoInteractions(store);
    }

    @Test
    void mealPlanWriterReadsIdempotencyKeyFromProposalPayload() {
        var definition =
                new ToolRegistryRepository.ToolDefinition(
                        720007L,
                        "meal_plan.save_plan",
                        "Save meal plan",
                        "Persist a validated meal plan for the current user.",
                        "write",
                        "high",
                        "user",
                        "active",
                        "v2",
                        "v2",
                        "{\"type\":\"object\",\"properties\":{\"plan\":{\"type\":\"object\"}},\"required\":[\"plan\"],\"additionalProperties\":false}",
                        "{\"type\":\"object\",\"properties\":{\"status\":{\"type\":\"string\"}}}",
                        "{\"roles\":[\"user\",\"operator\",\"admin\",\"superadmin\"],\"approval\":\"required\",\"scope\":\"user\"}",
                        10000,
                        false,
                        true,
                        Instant.parse("2026-09-05T00:00:00Z"),
                        1L);
        when(registryStore.findCurrent("meal_plan.save_plan")).thenReturn(definition);
        ApprovalService approvals = mock(ApprovalService.class);
        when(store.runContext(42L)).thenReturn(new ToolGatewayPort.RunContext(7L, 8L));
        when(approvals.propose(eq(7L), any()))
                .thenReturn(
                        new ApprovalService.ProposalView(
                                101L,
                                "save_plan",
                                "meal_plan",
                                null,
                                "digest",
                                "pending",
                                Instant.parse("2026-09-05T01:00:00Z"),
                                null,
                                null));

        var result =
                new ToolGatewayServiceImpl(
                                store,
                                ids,
                                approvals,
                                new com.fasterxml.jackson.databind.ObjectMapper(),
                                registry(),
                                null,
                                null,
                                audit)
                        .execute(
                                new ToolGatewayService.ProposalCommand(
                                        "proposal-plan-v2",
                                        "42",
                                        "tool",
                                        "v1",
                                        "meal_plan.save_plan",
                                        null,
                                        mealPlanInput(),
                                        new ToolGatewayService.ProposalPayload(
                                                "", "inv-plan-v2", "plan-key-v2")));

        assertEquals("confirmation_required", result.status());
        assertEquals("101", result.confirmationRef());
        verify(approvals).propose(eq(7L), any());
    }

    @Test
    void rejectsInvalidSchemaInputBeforeExecutor() {
        ToolRegistryService registry = registryWith("calculator");
        var invalid = JsonNodeFactory.instance.arrayNode().add(1);

        var result = gateway(registry).execute(toolProposal("calculator", invalid));

        assertEquals("TOOL_INPUT_INVALID", result.errorCode());
        verifyNoInteractions(store);
    }

    @Test
    void calculatorUsesTheRegisteredDeterministicExecutor() {
        ToolRegistryService registry = registryWith("calculator");
        var input = object().put("expression", "1 + 1");
        when(store.runExists(42L)).thenReturn(true);
        when(store.runContext(42L)).thenReturn(new ToolGatewayPort.RunContext(7L, 8L));

        var result = gateway(registry).execute(toolProposal("calculator", input));

        assertEquals("succeeded", result.status());
        assertEquals("2", result.rows().getFirst().path("result").asText());
        assertEquals("calculator", result.toolName());
        verify(audit)
                .record(
                        eq(7L),
                        eq("agent_tool"),
                        eq("42"),
                        eq("tool.calculator.execute"),
                        eq("success"),
                        org.mockito.ArgumentMatchers.isNull(),
                        any(String.class),
                        org.mockito.ArgumentMatchers.isNull(),
                        any());
    }

    @Test
    void planValidatorReturnsConstraintIssuesWithoutWritingThePlan() {
        ToolRegistryService registry = registryWith("plan_validator");
        var plan = object().put("people", 1).put("days", 1).put("budget", 5);
        plan.putArray("days_plan").addObject().putObject("breakfast").put("cost", 6);
        var input = object().set("plan", plan);
        when(store.runExists(42L)).thenReturn(true);
        when(store.runContext(42L)).thenReturn(new ToolGatewayPort.RunContext(7L, 8L));

        var result = gateway(registry).execute(toolProposal("plan_validator", input));

        assertEquals("failed", result.status());
        assertEquals("PLAN_CONSTRAINTS_UNSATISFIED", result.errorCode());
        assertEquals("invalid", result.rows().getFirst().path("status").asText());
        verify(audit)
                .record(
                        eq(7L),
                        eq("agent_tool"),
                        eq("42"),
                        eq("tool.plan_validator.execute"),
                        eq("failed"),
                        eq("PLAN_CONSTRAINTS_UNSATISFIED"),
                        any(String.class),
                        org.mockito.ArgumentMatchers.isNull(),
                        any());
    }

    @Test
    void disabledRegistryToolIsRejectedWithStableCode() {
        var definition =
                ToolRegistryCatalog.defaults().stream()
                        .filter(tool -> "calculator".equals(tool.name()))
                        .findFirst()
                        .orElseThrow();
        when(registryStore.findCurrent("calculator"))
                .thenReturn(
                        new ToolRegistryRepository.ToolDefinition(
                                definition.toolId(),
                                definition.name(),
                                definition.displayName(),
                                definition.description(),
                                definition.category(),
                                definition.riskLevel(),
                                definition.availabilityScope(),
                                "disabled",
                                definition.currentVersion(),
                                definition.version(),
                                definition.inputSchemaJson(),
                                definition.outputSchemaJson(),
                                definition.permissionsJson(),
                                definition.timeoutMs(),
                                definition.retryable(),
                                definition.idempotent(),
                                definition.publishedAt(),
                                definition.revision()));

        var result = gateway(registry()).execute(toolProposal("calculator", object()));

        assertEquals("TOOL_DISABLED", result.errorCode());
    }

    private ToolGatewayServiceImpl gateway(ToolRegistryService registry) {
        return new ToolGatewayServiceImpl(
                store,
                ids,
                (com.foodmate.application.food.service.ApprovalService) null,
                new com.fasterxml.jackson.databind.ObjectMapper(),
                registry,
                null,
                null,
                audit);
    }

    private ToolRegistryService registry() {
        return new ToolRegistryServiceImpl(registryStore);
    }

    private ToolRegistryService registryWith(String name) {
        ToolRegistryRepository.ToolDefinition definition =
                ToolRegistryCatalog.defaults().stream()
                        .filter(tool -> name.equals(tool.name()))
                        .findFirst()
                        .orElseThrow();
        when(registryStore.findCurrent(name)).thenReturn(definition);
        return registry();
    }

    private static ToolGatewayService.ProposalCommand sqlProposal(String statement) {
        return new ToolGatewayService.ProposalCommand(
                "proposal-sql",
                "42",
                "sql_read",
                "v1",
                new ToolGatewayService.ProposalPayload(statement, "invocation-sql"));
    }

    private static ToolGatewayService.ProposalCommand toolProposal(
            String name, com.fasterxml.jackson.databind.JsonNode input) {
        return new ToolGatewayService.ProposalCommand(
                "proposal-" + name,
                "42",
                "tool",
                "v1",
                name,
                null,
                input,
                new ToolGatewayService.ProposalPayload("", "invocation-" + name, null));
    }

    private static com.fasterxml.jackson.databind.node.ObjectNode object() {
        return JsonNodeFactory.instance.objectNode();
    }

    private static com.fasterxml.jackson.databind.node.ObjectNode mealPlanInput() {
        var plan = JsonNodeFactory.instance.objectNode();
        plan.put("plan_name", "一日计划");
        plan.put("people", 1);
        plan.put("days", 1);
        plan.put("budget", 80);
        plan.putArray("allergens");
        plan.putArray("dislikes");
        var day = plan.putArray("days_plan").addObject();
        day.putObject("breakfast");
        day.putObject("lunch");
        day.putObject("dinner");
        return JsonNodeFactory.instance.objectNode().set("plan", plan);
    }
}

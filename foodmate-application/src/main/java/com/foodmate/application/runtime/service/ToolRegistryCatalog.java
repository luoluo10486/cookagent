package com.foodmate.application.runtime.service;

import com.foodmate.application.runtime.port.out.ToolRegistryRepository.ToolDefinition;
import java.time.Instant;
import java.util.List;

/** local-stub 使用的固定只读目录；真实数据库目录由 V18 种子提供。 */
public final class ToolRegistryCatalog {
    private static final Instant PUBLISHED_AT = Instant.parse("2026-01-01T00:00:00Z");

    private ToolRegistryCatalog() {}

    public static List<ToolDefinition> defaults() {
        return List.of(
                definition(
                        720001L,
                        "calculator",
                        "Calculator",
                        "Evaluate a bounded arithmetic expression.",
                        "utility",
                        "low",
                        "user",
                        "none",
                        1000,
                        true,
                        true,
                        "{\"expression\":{\"type\":\"string\",\"maxLength\":256}}",
                        "{\"result\":{\"type\":\"number\"}}"),
                definition(
                        720002L,
                        "time_parser",
                        "Time parser",
                        "Resolve a natural-language time range into bounded instants.",
                        "utility",
                        "low",
                        "user",
                        "none",
                        1000,
                        true,
                        true,
                        "{\"question\":{\"type\":\"string\",\"maxLength\":512},\"timezone\":{\"type\":\"string\",\"maxLength\":64}}",
                        "{\"from\":{\"type\":\"string\"},\"to\":{\"type\":\"string\"}}"),
                definition(
                        720003L,
                        "knowledge_search",
                        "Knowledge search",
                        "Search the public published knowledge scope.",
                        "retrieval",
                        "low",
                        "public",
                        "none",
                        3000,
                        true,
                        true,
                        "{\"query\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":512},\"limit\":{\"type\":\"integer\",\"minimum\":1,\"maximum\":12}}",
                        "{\"citations\":{\"type\":\"array\"}}"),
                definition(
                        720004L,
                        "database_query",
                        "Database query",
                        "Run an authorized read-only query for the current user.",
                        "analysis",
                        "medium",
                        "user",
                        "none",
                        5000,
                        false,
                        true,
                        "{\"intent\":{\"type\":\"string\"},\"time_range\":{\"type\":\"object\"},\"metrics\":{\"type\":\"array\"},\"dimensions\":{\"type\":\"array\"},\"filters\":{\"type\":\"object\"},\"candidate_sql\":{\"type\":\"string\",\"maxLength\":8192},\"planner_mode\":{\"type\":\"string\"},\"planner_version\":{\"type\":\"string\"}}",
                        "{\"rows\":{\"type\":\"array\"},\"sql_audit_id\":{\"type\":\"string\"}}",
                        "v2"),
                definition(
                        720005L,
                        "food_log_writer",
                        "Food log writer",
                        "Create, update, delete, or restore the current user's food log.",
                        "write",
                        "high",
                        "user",
                        "required",
                        10000,
                        false,
                        true,
                        "{\"meal_time\":{\"type\":\"string\"},\"meal_type\":{\"type\":\"string\"},\"notes\":{\"type\":\"string\",\"maxLength\":2000},\"items\":{\"type\":\"array\",\"maxItems\":50},\"revision\":{\"type\":\"integer\",\"minimum\":1}}",
                        "{\"status\":{\"type\":\"string\"},\"resourceId\":{\"type\":\"string\"}}"),
                definition(
                        720006L,
                        "plan_validator",
                        "Plan validator",
                        "Validate a meal plan against nutrition and business constraints.",
                        "planning",
                        "medium",
                        "user",
                        "none",
                        5000,
                        true,
                        true,
                        "{\"plan\":{\"type\":\"object\"}}",
                        "{\"valid\":{\"type\":\"boolean\"},\"status\":{\"type\":\"string\"},\"issues\":{\"type\":\"array\"},\"warnings\":{\"type\":\"array\"},\"nutrition_summary\":{\"type\":\"object\"},\"budget_summary\":{\"type\":\"object\"}}"),
                definition(
                        720007L,
                        "meal_plan.save_plan",
                        "Save meal plan",
                        "Persist a validated meal plan for the current user.",
                        "write",
                        "high",
                        "user",
                        "required",
                        10000,
                        false,
                        true,
                        "{\"plan\":{\"type\":\"object\"}}",
                        "{\"status\":{\"type\":\"string\"},\"resourceId\":{\"type\":\"string\"}}"));
    }

    private static ToolDefinition definition(
            long toolId,
            String name,
            String displayName,
            String description,
            String category,
            String riskLevel,
            String availabilityScope,
            String approval,
            int timeoutMs,
            boolean retryable,
            boolean idempotent,
            String inputSchema,
            String outputSchema) {
        return definition(
                toolId,
                name,
                displayName,
                description,
                category,
                riskLevel,
                availabilityScope,
                approval,
                timeoutMs,
                retryable,
                idempotent,
                inputSchema,
                outputSchema,
                "v1");
    }

    private static ToolDefinition definition(
            long toolId,
            String name,
            String displayName,
            String description,
            String category,
            String riskLevel,
            String availabilityScope,
            String approval,
            int timeoutMs,
            boolean retryable,
            boolean idempotent,
            String inputSchema,
            String outputSchema,
            String version) {
        String permissions =
                "{\"roles\":[\"user\",\"operator\",\"admin\",\"superadmin\"],\"approval\":\""
                        + approval
                        + "\",\"scope\":\""
                        + availabilityScope
                        + "\"}";
        return new ToolDefinition(
                toolId,
                name,
                displayName,
                description,
                category,
                riskLevel,
                availabilityScope,
                "active",
                version,
                version,
                "{\"type\":\"object\",\"properties\":"
                        + inputSchema
                        + ",\"additionalProperties\":false}",
                "{\"type\":\"object\",\"properties\":" + outputSchema + "}",
                permissions,
                timeoutMs,
                retryable,
                idempotent,
                PUBLISHED_AT,
                1L);
    }
}

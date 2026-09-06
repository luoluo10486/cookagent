package com.foodmate.application.runtime.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;

/** 在 SQL 守卫前校验不可信的结构化 database_query 提案。 */
public final class SqlQueryPlanValidator {
    private static final Set<String> ALLOWED_FIELDS =
            Set.of(
                    "intent",
                    "time_range",
                    "metrics",
                    "dimensions",
                    "filters",
                    "candidate_sql",
                    "planner_mode",
                    "planner_version");
    private static final Set<String> ALLOWED_INTENTS =
            Set.of(
                    "nutrition_summary",
                    "food_occurrence",
                    "meal_plan_completion",
                    "shopping_list_missing",
                    "meal_plan",
                    "shopping_list",
                    "nutrition_food");
    private static final Set<String> ALLOWED_MODES = Set.of("stub", "local");

    private SqlQueryPlanValidator() {}

    public static String validate(JsonNode plan, String statement) {
        if (plan == null || !plan.isObject()) return "TOOL_INPUT_INVALID";
        Set<String> fields = new HashSet<>();
        plan.fieldNames().forEachRemaining(fields::add);
        if (!ALLOWED_FIELDS.containsAll(fields)) return "TOOL_SCHEMA_UNSUPPORTED";
        if (!textIn(plan, "intent", ALLOWED_INTENTS)) return "TOOL_INPUT_INVALID";
        if (!textIn(plan, "planner_mode", ALLOWED_MODES)) return "TOOL_INPUT_INVALID";
        if (text(plan, "planner_version", 64) == null) return "TOOL_INPUT_INVALID";
        String candidate = text(plan, "candidate_sql", 8_192);
        if (candidate == null || statement == null || !candidate.equals(statement))
            return "TOOL_INPUT_INVALID";
        if (!arrayOfStrings(plan.path("metrics"), 6) || !arrayOfStrings(plan.path("dimensions"), 4))
            return "TOOL_INPUT_INVALID";
        JsonNode filters = plan.path("filters");
        if (!filters.isObject() || filters.size() > 8) return "TOOL_INPUT_INVALID";
        var filterNames = filters.fieldNames();
        while (filterNames.hasNext()) {
            String name = filterNames.next();
            if (name.length() > 64 || !filters.path(name).isTextual()) return "TOOL_INPUT_INVALID";
            if (filters.path(name).textValue().length() > 128) return "TOOL_INPUT_INVALID";
        }
        JsonNode timeRange = plan.get("time_range");
        if (timeRange != null && !timeRange.isNull()) {
            if (!timeRange.isObject()
                    || timeRange.size() > 4
                    || !"relative".equals(timeRange.path("kind").asText())
                    || !isBoundedDays(timeRange.path("days"))) return "TOOL_INPUT_INVALID";
            if (timeRange.has("label")
                    && (!timeRange.path("label").isTextual()
                            || !Set.of("today", "yesterday")
                                    .contains(timeRange.path("label").textValue())))
                return "TOOL_INPUT_INVALID";
        }
        return null;
    }

    private static boolean textIn(JsonNode object, String name, Set<String> allowed) {
        return object.path(name).isTextual() && allowed.contains(object.path(name).textValue());
    }

    private static String text(JsonNode object, String name, int maxLength) {
        JsonNode value = object.path(name);
        return value.isTextual()
                        && !value.textValue().isBlank()
                        && value.textValue().length() <= maxLength
                ? value.textValue()
                : null;
    }

    private static boolean arrayOfStrings(JsonNode value, int maxItems) {
        if (!value.isArray() || value.size() > maxItems) return false;
        for (JsonNode item : value) {
            if (!item.isTextual() || item.textValue().isBlank() || item.textValue().length() > 64)
                return false;
        }
        return true;
    }

    private static boolean isBoundedDays(JsonNode value) {
        if (value.isIntegralNumber()) {
            return value.asInt() >= 1 && value.asInt() <= 90;
        }
        if (!value.isTextual() || !value.textValue().matches("[1-9][0-9]?")) return false;
        int days = Integer.parseInt(value.textValue());
        return days <= 90;
    }
}

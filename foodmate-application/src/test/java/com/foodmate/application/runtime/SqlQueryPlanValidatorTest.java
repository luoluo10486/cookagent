package com.foodmate.application.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.foodmate.application.runtime.service.SqlQueryPlanValidator;
import org.junit.jupiter.api.Test;

class SqlQueryPlanValidatorTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsBoundedPlanWhenCandidateMatchesPayload() throws Exception {
        var plan =
                mapper.readTree(
                        "{\"intent\":\"nutrition_summary\",\"time_range\":{\"kind\":\"relative\",\"days\":\"7\"},\"metrics\":[\"protein_g\"],\"dimensions\":[\"meal_time\"],\"filters\":{},\"candidate_sql\":\"SELECT meal_time FROM food_logs LIMIT 500\",\"planner_mode\":\"stub\",\"planner_version\":\"v1\"}");

        assertEquals(
                null,
                SqlQueryPlanValidator.validate(plan, "SELECT meal_time FROM food_logs LIMIT 500"));
    }

    @Test
    void rejectsCandidateMismatchAndUnknownPlanFields() throws Exception {
        var mismatch =
                mapper.readTree(
                        "{\"intent\":\"nutrition_summary\",\"metrics\":[],\"dimensions\":[],\"filters\":{},\"candidate_sql\":\"SELECT 1 LIMIT 1\",\"planner_mode\":\"stub\",\"planner_version\":\"v1\"}");
        assertEquals(
                "TOOL_INPUT_INVALID", SqlQueryPlanValidator.validate(mismatch, "SELECT 2 LIMIT 1"));

        ObjectNode unknown = (ObjectNode) mismatch.deepCopy();
        unknown.put("user_id", 42);
        assertEquals(
                "TOOL_SCHEMA_UNSUPPORTED",
                SqlQueryPlanValidator.validate(unknown, "SELECT 1 LIMIT 1"));
    }

    @Test
    void acceptsCoreReadOnlyAnalysisIntents() throws Exception {
        for (String intent : new String[] {"food_occurrence", "meal_plan_completion", "shopping_list_missing"}) {
            var plan = mapper.createObjectNode();
            plan.put("intent", intent);
            plan.put("candidate_sql", "SELECT 1 LIMIT 1");
            plan.put("planner_mode", "stub");
            plan.put("planner_version", "m2-2-deterministic-v1");
            plan.putArray("metrics");
            plan.putArray("dimensions");
            plan.putObject("filters");

            assertEquals(null, SqlQueryPlanValidator.validate(plan, "SELECT 1 LIMIT 1"));
        }
    }
}

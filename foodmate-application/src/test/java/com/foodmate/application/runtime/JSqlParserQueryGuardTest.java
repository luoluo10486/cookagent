package com.foodmate.application.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.foodmate.application.runtime.service.SqlQueryGuard;
import com.foodmate.application.runtime.service.SqlSchemaCatalogService.CatalogView;
import com.foodmate.application.runtime.service.SqlSchemaCatalogService.FieldView;
import com.foodmate.application.runtime.service.SqlSchemaCatalogService.Scope;
import com.foodmate.application.runtime.service.SqlSchemaCatalogService.TableView;
import com.foodmate.application.runtime.service.impl.JSqlParserQueryGuard;
import com.foodmate.shared.error.BusinessException;
import java.util.List;
import org.junit.jupiter.api.Test;

class JSqlParserQueryGuardTest {
    private final SqlQueryGuard guard = new JSqlParserQueryGuard();

    @Test
    void parsesAllowlistedReadAndInjectsTrustedUserScopeAndLimit() {
        SqlQueryGuard.GuardedQuery query =
                guard.guard(
                        "SELECT meal_time FROM food_logs WHERE meal_type = 'lunch'",
                        catalog(),
                        42L);

        assertEquals(List.of(42L), query.parameters());
        org.junit.jupiter.api.Assertions.assertTrue(query.statement().contains("user_id = ?"));
        org.junit.jupiter.api.Assertions.assertTrue(
                query.statement().contains("is_deleted = false"));
        org.junit.jupiter.api.Assertions.assertTrue(
                query.statement().toLowerCase().contains("limit 500"));
    }

    @Test
    void rejectsWriteMultiStatementAndCommentPayloads() {
        for (String sql :
                List.of(
                        "UPDATE food_logs SET notes = 'x'",
                        "SELECT meal_time FROM food_logs; DELETE FROM food_logs",
                        "SELECT meal_time FROM food_logs /* bypass */")) {
            BusinessException exception =
                    assertThrows(BusinessException.class, () -> guard.guard(sql, catalog(), 42L));
            assertEquals("SQL_GUARD_DENIED", exception.errorCode().code());
        }
    }

    @Test
    void rejectsUnknownTableColumnsWildcardsAndFunctions() {
        assertEquals(
                "SQL_SCHEMA_DENIED",
                assertThrows(
                                BusinessException.class,
                                () ->
                                        guard.guard(
                                                "SELECT password_hash FROM users", catalog(), 42L))
                        .errorCode()
                        .code());
        assertEquals(
                "SQL_SCHEMA_DENIED",
                assertThrows(
                                BusinessException.class,
                                () -> guard.guard("SELECT * FROM food_logs", catalog(), 42L))
                        .errorCode()
                        .code());
        assertEquals(
                "SQL_SCHEMA_DENIED",
                assertThrows(
                                BusinessException.class,
                                () ->
                                        guard.guard(
                                                "SELECT pg_sleep(1) FROM food_logs",
                                                catalog(),
                                                42L))
                        .errorCode()
                        .code());
        assertEquals(
                "SQL_SCHEMA_DENIED",
                assertThrows(
                                BusinessException.class,
                                () ->
                                        guard.guard(
                                                "SELECT meal_time FROM other.food_logs",
                                                catalog(),
                                                42L))
                        .errorCode()
                        .code());
    }

    @Test
    void preservesCteReadButStillScopesItsBaseTable() {
        SqlQueryGuard.GuardedQuery query =
                guard.guard(
                        "WITH recent AS (SELECT meal_time FROM food_logs) SELECT meal_time FROM recent",
                        catalog(),
                        42L);

        assertEquals(List.of(42L), query.parameters());
        org.junit.jupiter.api.Assertions.assertTrue(query.statement().contains("user_id = ?"));
    }

    @Test
    void wrapsUserPredicateBeforeAddingScopeFilters() {
        SqlQueryGuard.GuardedQuery query =
                guard.guard(
                        "SELECT meal_time FROM food_logs WHERE meal_type = 'lunch' OR meal_type = 'dinner'",
                        catalog(),
                        42L);

        assertEquals(
                "WHERE ((meal_type = 'lunch' OR meal_type = 'dinner') AND food_logs.is_deleted = false) AND food_logs.user_id = ? LIMIT 500",
                query.statement().substring(query.statement().indexOf("WHERE")));
    }

    @Test
    void rejectsUnscopedDerivedTablesAndExpressionSubqueries() {
        for (String sql :
                List.of(
                        "SELECT x.meal_time FROM (SELECT meal_time FROM food_logs) x",
                        "SELECT (SELECT meal_time FROM food_logs) FROM food_logs")) {
            assertEquals(
                    "SQL_GUARD_DENIED",
                    assertThrows(BusinessException.class, () -> guard.guard(sql, catalog(), 42L))
                            .errorCode()
                            .code());
        }
    }

    @Test
    void inheritsUserScopeThroughTheFoodLogParentJoin() {
        SqlQueryGuard.GuardedQuery query =
                guard.guard(
                        "SELECT SUM(i.protein_g) AS protein_g FROM food_logs f JOIN food_log_items i ON i.food_log_id = f.food_log_id WHERE f.meal_time >= CURRENT_TIMESTAMP - INTERVAL '7 days' GROUP BY f.meal_time ORDER BY f.meal_time DESC LIMIT 500",
                        catalogWithFoodLogItems(),
                        42L);

        assertEquals(List.of(42L), query.parameters());
        org.junit.jupiter.api.Assertions.assertTrue(query.statement().contains("f.user_id = ?"));
        org.junit.jupiter.api.Assertions.assertTrue(
                query.statement().contains("i.is_deleted = false"));
    }

    @Test
    void rejectsFoodLogItemsWithoutTheApprovedParentJoin() {
        for (String sql :
                List.of(
                        "SELECT i.protein_g FROM food_log_items i LIMIT 500",
                        "SELECT i.protein_g FROM food_logs f JOIN food_log_items i ON i.raw_name = f.meal_type LIMIT 500")) {
            assertEquals(
                    "SQL_SCHEMA_DENIED",
                    assertThrows(
                                    BusinessException.class,
                                    () -> guard.guard(sql, catalogWithFoodLogItems(), 42L))
                            .errorCode()
                            .code());
        }
    }

    @Test
    void acceptsCoreAnalysisTemplatesAndInjectsUserScope() {
        for (String sql :
                List.of(
                        "SELECT SUM(i.calories_kcal) AS calories_kcal FROM food_logs f JOIN food_log_items i ON i.food_log_id = f.food_log_id WHERE f.meal_time >= CURRENT_DATE AND f.meal_time < CURRENT_DATE + INTERVAL '1 day' LIMIT 500",
                        "SELECT i.raw_name AS food_name, COUNT(i.food_log_item_id) AS occurrence_count FROM food_logs f JOIN food_log_items i ON i.food_log_id = f.food_log_id WHERE f.meal_time >= CURRENT_TIMESTAMP - INTERVAL '7 days' AND i.raw_name = '鸡胸肉' GROUP BY i.raw_name ORDER BY COUNT(i.food_log_item_id) DESC LIMIT 500",
                        "SELECT meal_plan_id, plan_name, days, status, CASE WHEN status = 'saved' THEN 1.0 WHEN status = 'validated' THEN 0.5 ELSE 0.0 END AS completion_ratio FROM meal_plans LIMIT 500",
                        "SELECT shopping_list_id, meal_plan_id, status, CASE WHEN status = 'confirmed' THEN 0 ELSE 1 END AS missing_item_groups FROM shopping_lists ORDER BY shopping_list_id DESC LIMIT 500")) {
            SqlQueryGuard.GuardedQuery query = guard.guard(sql, catalogWithCoreAnalysis(), 42L);
            org.junit.jupiter.api.Assertions.assertTrue(query.statement().contains("is_deleted = false"));
            org.junit.jupiter.api.Assertions.assertTrue(query.parameters().contains(42L));
        }
    }

    private static CatalogView catalog() {
        return new CatalogView(
                1L,
                "catalog-v1",
                List.of(
                        new TableView(
                                "public",
                                "food_logs",
                                Scope.USER,
                                List.of(
                                        field("food_log_id"),
                                        field("user_id"),
                                        field("meal_time"),
                                        field("meal_type"),
                                        field("is_deleted"))),
                        new TableView(
                                "public",
                                "nutrition_foods",
                                Scope.PUBLIC,
                                List.of(field("standard_name"), field("is_deleted")))));
    }

    private static CatalogView catalogWithFoodLogItems() {
        CatalogView base = catalog();
        return new CatalogView(
                base.datasourceId(),
                base.version(),
                List.of(
                        base.tables().getFirst(),
                        new TableView(
                                "public",
                                "food_log_items",
                                Scope.USER_VIA_FOOD_LOG,
                                List.of(
                                        field("food_log_id"),
                                        field("protein_g"),
                                        field("is_deleted")))));
    }

    private static CatalogView catalogWithCoreAnalysis() {
        return new CatalogView(
                1L,
                "catalog-v1",
                List.of(
                        new TableView(
                                "public",
                                "food_logs",
                                Scope.USER,
                                List.of(
                                        field("food_log_id"),
                                        field("user_id"),
                                        field("meal_time"),
                                        field("is_deleted"))),
                        new TableView(
                                "public",
                                "food_log_items",
                                Scope.USER_VIA_FOOD_LOG,
                                List.of(
                                        field("food_log_item_id"),
                                        field("food_log_id"),
                                        field("raw_name"),
                                        field("calories_kcal"),
                                        field("is_deleted"))),
                        new TableView(
                                "public",
                                "meal_plans",
                                Scope.USER,
                                List.of(
                                        field("meal_plan_id"),
                                        field("user_id"),
                                        field("plan_name"),
                                        field("days"),
                                        field("status"),
                                        field("is_deleted"))),
                        new TableView(
                                "public",
                                "shopping_lists",
                                Scope.USER,
                                List.of(
                                        field("shopping_list_id"),
                                        field("meal_plan_id"),
                                        field("user_id"),
                                        field("status"),
                                        field("is_deleted")))));
    }

    private static FieldView field(String name) {
        return new FieldView(name, null, "text", true, false, true, null);
    }
}

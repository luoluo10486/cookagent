package com.foodmate.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** 校验营养候选确认迁移只扩展状态和查询索引，不改变既有业务数据。 */
class FlywayV34MigrationScriptTest {
    private static final Path ROOT = Path.of("..", "script", "sql", "FoodMate");

    @Test
    void migrationAddsExplicitConfirmationStatus() throws Exception {
        String migration =
                Files.readString(
                        ROOT.resolve("migration/V34__m2_4_nutrition_match_confirmation.sql"));

        assertTrue(migration.contains("pending_confirmation"));
        assertTrue(migration.contains("idx_nutrition_foods_candidate_lookup"));
        assertFalse(migration.matches("(?is).*\\b(TRUNCATE|DELETE\\s+FROM|DROP\\s+TABLE)\\b.*"));
    }

    @Test
    void validationAndRollbackAreReadOnlyCompanionFiles() throws Exception {
        String validation =
                Files.readString(
                        ROOT.resolve(
                                "validation/V34__m2_4_nutrition_match_confirmation_validation.sql"));
        String rollback =
                Files.readString(
                        ROOT.resolve(
                                "rollback/R34__m2_4_nutrition_match_confirmation_precheck.sql"));

        assertTrue(validation.contains("pending_confirmation_rows"));
        assertTrue(validation.contains("invalid_catalog_candidate_rows"));
        assertTrue(rollback.contains("rollback_precheck"));
        assertFalse(rollback.matches("(?is).*\\b(TRUNCATE|DELETE\\s+FROM|DROP\\s+TABLE)\\b.*"));
    }
}

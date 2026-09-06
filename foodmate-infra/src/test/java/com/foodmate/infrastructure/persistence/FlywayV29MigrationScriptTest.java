package com.foodmate.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** 校验 M2-1 Embedding 供应商 Trace 迁移只追加受控关联事实。 */
class FlywayV29MigrationScriptTest {
    private static final Path ROOT = Path.of("..", "script", "sql", "FoodMate");

    @Test
    void migrationAddsOnlyTheProviderTraceColumn() throws Exception {
        String migration =
                Files.readString(ROOT.resolve("migration/V29__m2_1_embedding_trace.sql"));

        assertTrue(migration.contains("ADD COLUMN IF NOT EXISTS provider_trace_id VARCHAR(256)"));
        assertTrue(
                migration.contains("COMMENT ON COLUMN knowledge_import_items.provider_trace_id"));
        assertTrue(!migration.matches("(?is).*\\b(TRUNCATE|DELETE\\s+FROM|DROP\\s+TABLE)\\b.*"));
    }

    @Test
    void validationRollbackAndReadmesRegisterTheTraceContract() throws Exception {
        String validation =
                Files.readString(
                        ROOT.resolve("validation/V29__m2_1_embedding_trace_validation.sql"));
        String rollback =
                Files.readString(ROOT.resolve("rollback/R29__m2_1_embedding_trace_precheck.sql"));
        String rootReadme = Files.readString(ROOT.resolve("README.md"));
        String migrationReadme = Files.readString(ROOT.resolve("migration/README.md"));

        assertTrue(validation.contains("invalid_provider_trace_ids"));
        assertTrue(validation.contains("provider_trace_migration_status"));
        assertTrue(validation.contains("\\gexec"));
        assertTrue(rollback.contains("provider_trace_id_rows"));
        assertTrue(rollback.contains("\\gexec"));
        assertTrue(rollback.contains("回滚前置检查"));
        assertTrue(rootReadme.contains("V29") && rootReadme.contains("Trace"));
        assertTrue(migrationReadme.contains("V29__m2_1_embedding_trace.sql"));
        assertTrue(!rollback.matches("(?is).*\\b(TRUNCATE|DELETE\\s+FROM|DROP\\s+TABLE)\\b.*"));
    }
}

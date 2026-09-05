SELECT table_name, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'knowledge_import_items'
  AND column_name = 'provider_trace_id';

SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_import_items'
          AND column_name = 'provider_trace_id'
    ) THEN 'applied'
    ELSE 'not_applied'
END AS provider_trace_migration_status;

-- 迁移尚未执行时，不能直接引用新增列；使用 psql 动态执行保持校验只读且可重复。
SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_import_items'
          AND column_name = 'provider_trace_id'
    ) THEN 'SELECT COUNT(*) AS invalid_provider_trace_ids, ''applied'' AS provider_trace_migration_status FROM knowledge_import_items WHERE provider_trace_id IS NOT NULL AND (length(provider_trace_id) = 0 OR length(provider_trace_id) > 256);'
    ELSE 'SELECT NULL::BIGINT AS invalid_provider_trace_ids, ''not_applied'' AS provider_trace_migration_status;'
END AS validation_query
\gexec

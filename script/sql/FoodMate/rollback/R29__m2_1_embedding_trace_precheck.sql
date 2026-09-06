-- V29 回滚前置检查：仅输出待评审的数据量，不自动删除列或审计事实。
SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_import_items'
          AND column_name = 'provider_trace_id'
    ) THEN 'SELECT COUNT(*) AS provider_trace_id_rows, ''applied'' AS provider_trace_migration_status FROM knowledge_import_items WHERE provider_trace_id IS NOT NULL;'
    ELSE 'SELECT NULL::BIGINT AS provider_trace_id_rows, ''not_applied'' AS provider_trace_migration_status;'
END AS precheck_query
\gexec

-- 通过数据保留评审和变更审批后，才允许人工执行：
-- ALTER TABLE knowledge_import_items DROP COLUMN provider_trace_id;

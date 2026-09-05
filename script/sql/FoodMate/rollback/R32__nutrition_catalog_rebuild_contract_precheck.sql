-- V32 回滚前置检查，只读。
-- 该版本增加目录溯源字段和索引；执行删除前必须人工确认应用已停止使用这些字段。

SELECT COUNT(*) AS active_catalog_rows,
       (SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'nutrition_foods'
          AND column_name = 'canonical_key') AS canonical_key_columns,
       (SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'nutrition_foods'
          AND column_name = 'source_food_id') AS source_food_id_columns
FROM nutrition_foods
WHERE is_deleted = FALSE;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
      'uk_nutrition_foods_canonical_key',
      'idx_nutrition_foods_source_identity',
      'idx_nutrition_foods_form_type'
  )
ORDER BY indexname;

-- V34 营养候选确认状态校验，只读。

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'food_log_items'::regclass
  AND conname = 'chk_food_log_items_status';

SELECT COUNT(*) AS pending_confirmation_rows
FROM food_log_items
WHERE nutrition_status = 'pending_confirmation';

SELECT COUNT(*) AS invalid_catalog_candidate_rows
FROM nutrition_foods
WHERE is_deleted = FALSE
  AND review_status = 'approved'
  AND (
      btrim(standard_name) = ''
      OR btrim(chinese_name) = ''
      OR food_form IS NULL
      OR basis_unit NOT IN ('g', 'ml')
  );

SELECT CASE WHEN COUNT(*) = 1 THEN 0 ELSE 1 END AS missing_candidate_lookup_index
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_nutrition_foods_candidate_lookup';

-- V33 USDA 营养目录重建种子校验，只读。
-- 校验对象为生成器当前版本的 1,000 条食材和 USDA 份量换算规则。

SELECT COUNT(*) AS catalog_rows,
       COUNT(*) FILTER (WHERE review_status = 'approved') AS approved_rows,
       COUNT(*) FILTER (WHERE data_type = 'official') AS official_rows,
       COUNT(DISTINCT canonical_key) AS distinct_canonical_keys,
       COUNT(DISTINCT source_food_id) AS distinct_source_food_ids
FROM nutrition_foods
WHERE is_deleted = FALSE
  AND catalog_version = 'USDA-SR-Legacy-2019-04-01-FoodMate-1';

SELECT COUNT(*) AS invalid_catalog_rows
FROM nutrition_foods
WHERE is_deleted = FALSE
  AND catalog_version = 'USDA-SR-Legacy-2019-04-01-FoodMate-1'
  AND (
      btrim(canonical_key) = ''
      OR btrim(source_food_id) = ''
      OR btrim(food_form) = ''
      OR data_type <> 'official'
      OR review_status <> 'approved'
      OR calories_kcal_per_100 < 0
      OR protein_g_per_100 < 0
      OR fat_g_per_100 < 0
      OR carbs_g_per_100 < 0
  );

SELECT COUNT(*) AS duplicate_active_catalog_keys
FROM nutrition_foods
WHERE is_deleted = FALSE
GROUP BY canonical_key
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS conversion_rows,
       COUNT(DISTINCT (nutrition_food_id, source_unit)) AS distinct_food_unit_rows,
       COUNT(*) FILTER (WHERE review_status = 'approved') AS approved_rows
FROM nutrition_unit_conversions
WHERE is_deleted = FALSE
  AND source_name = 'USDA FoodData Central foodPortion';

SELECT COUNT(*) AS invalid_conversion_rows
FROM nutrition_unit_conversions conversion_row
LEFT JOIN nutrition_foods food
  ON food.nutrition_food_id = conversion_row.nutrition_food_id
 AND food.is_deleted = FALSE
WHERE conversion_row.is_deleted = FALSE
  AND conversion_row.source_name = 'USDA FoodData Central foodPortion'
  AND (
      conversion_row.target_unit <> 'g'
      OR conversion_row.multiplier <= 0
      OR conversion_row.review_status <> 'approved'
      OR food.nutrition_food_id IS NULL
  );

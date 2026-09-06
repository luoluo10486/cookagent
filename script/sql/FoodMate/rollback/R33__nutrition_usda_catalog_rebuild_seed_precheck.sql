-- V33 USDA 营养目录种子回滚前置检查，只读。
-- 本文件不执行删除；任何反向处理都必须先人工确认业务引用和备份状态。

SELECT COUNT(*) AS active_generated_catalog_rows,
       MIN(nutrition_food_id) AS minimum_food_id,
       MAX(nutrition_food_id) AS maximum_food_id
FROM nutrition_foods
WHERE is_deleted = FALSE
  AND catalog_version = 'USDA-SR-Legacy-2019-04-01-FoodMate-1';

SELECT COUNT(*) AS active_generated_conversion_rows
FROM nutrition_unit_conversions conversion_row
JOIN nutrition_foods food
  ON food.nutrition_food_id = conversion_row.nutrition_food_id
WHERE conversion_row.is_deleted = FALSE
  AND conversion_row.source_name = 'USDA FoodData Central foodPortion'
  AND food.catalog_version = 'USDA-SR-Legacy-2019-04-01-FoodMate-1';

SELECT COUNT(*) AS food_log_references
FROM food_log_items item
JOIN nutrition_foods food
  ON food.nutrition_food_id = item.nutrition_food_id
WHERE food.catalog_version = 'USDA-SR-Legacy-2019-04-01-FoodMate-1';

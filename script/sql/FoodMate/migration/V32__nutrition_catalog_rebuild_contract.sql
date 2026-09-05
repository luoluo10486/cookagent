-- M2-4：营养目录重建所需的来源、规范键和营养形态字段。
-- 人工执行；不删除既有目录数据，正式清库由受保护的本地维护入口完成。

ALTER TABLE nutrition_foods
    ADD COLUMN IF NOT EXISTS canonical_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_food_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS catalog_version VARCHAR(64),
    ADD COLUMN IF NOT EXISTS food_form VARCHAR(64),
    ADD COLUMN IF NOT EXISTS data_type VARCHAR(64);

UPDATE nutrition_foods
SET canonical_key = lower(regexp_replace(trim(standard_name), '[^[:alnum:][:space:]]+', ' ', 'g'))
WHERE canonical_key IS NULL;

UPDATE nutrition_foods
SET catalog_version = COALESCE(catalog_version, source_version),
    source_food_id = COALESCE(source_food_id, split_part(source_version, 'FDC-', 2)),
    food_form = COALESCE(food_form, 'unspecified'),
    data_type = COALESCE(data_type, 'official');

ALTER TABLE nutrition_foods
    ALTER COLUMN canonical_key SET NOT NULL,
    ALTER COLUMN catalog_version SET NOT NULL,
    ALTER COLUMN food_form SET NOT NULL,
    ALTER COLUMN data_type SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_nutrition_foods_canonical_key
    ON nutrition_foods (canonical_key)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_source_identity
    ON nutrition_foods (source_name, source_food_id, catalog_version)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_form_type
    ON nutrition_foods (food_form, data_type, review_status, is_deleted);

COMMENT ON COLUMN nutrition_foods.canonical_key IS '规范化食材键；只合并完全相同的营养形态，不合并生熟和部位差异。';
COMMENT ON COLUMN nutrition_foods.source_food_id IS '外部营养数据源的稳定食材标识。';
COMMENT ON COLUMN nutrition_foods.catalog_version IS '本条目录数据的来源版本快照。';
COMMENT ON COLUMN nutrition_foods.food_form IS '营养形态，例如 raw、cooked、frozen 或 unspecified。';
COMMENT ON COLUMN nutrition_foods.data_type IS '数据类型，例如 official 或 foodmate_recipe_estimate。';

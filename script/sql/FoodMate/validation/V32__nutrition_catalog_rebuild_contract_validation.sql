-- V32 营养目录重建契约校验，只读。

SELECT COUNT(*) AS missing_catalog_columns
FROM (
    VALUES
        ('canonical_key'),
        ('source_food_id'),
        ('catalog_version'),
        ('food_form'),
        ('data_type')
) expected(column_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nutrition_foods'
      AND column_name = expected.column_name
);

SELECT COUNT(*) AS invalid_active_catalog_keys
FROM nutrition_foods
WHERE is_deleted = FALSE
  AND (
      canonical_key IS NULL
      OR btrim(canonical_key) = ''
      OR catalog_version IS NULL
      OR btrim(catalog_version) = ''
      OR food_form IS NULL
      OR data_type IS NULL
  );

SELECT COUNT(*) AS duplicate_active_catalog_keys
FROM (
    SELECT canonical_key
    FROM nutrition_foods
    WHERE is_deleted = FALSE
    GROUP BY canonical_key
    HAVING COUNT(*) > 1
) duplicates;

SELECT COUNT(*) AS invalid_nutrition_values
FROM nutrition_foods
WHERE is_deleted = FALSE
  AND (
      calories_kcal_per_100 < 0
      OR protein_g_per_100 < 0
      OR fat_g_per_100 < 0
      OR carbs_g_per_100 < 0
  );

# FoodMate 营养目录 Seed

本目录存放人工评审后的营养目录数据，不由 Java 启动自动执行，也不由 Flyway 自动执行。

截至 2026-09-06，当前本地数据库已通过 validation 核验 1,000 条 `approved/official` USDA 食材和 1,518 条 USDA `foodPortion` 食材级换算规则；历史目录中的 75 条 `kg/mg/lb -> g` 精确质量换算仍按既有规则保留。下面的 V1/V2/V4/V5/V6/V7/V8 说明分别对应各自 seed 的历史增量范围，V33 是当前重建基线，不应将单个脚本的行数误读为当前目录总量。

## V32/V33 当前重建基线

`migration/V32__nutrition_catalog_rebuild_contract.sql` 补齐当前目录重建所需的来源、版本、规范键、食材形态和数据类型约束；它只增加结构和索引，不删除业务数据。

`seed/generated/V33__nutrition_usda_catalog_rebuild_seed.sql` 由 `script/data/nutrition/build_usda_catalog.py` 根据 USDA FoodData Central SR Legacy CSV 生成，当前包含 1,000 条唯一规范键的 `approved/official` 食材和 1,518 条去重后的 `foodPortion` 换算。每条记录保留 USDA FDC 标识、来源版本和安全别名；重复执行使用稳定 ID 幂等更新，不使用 `MAX(id)+1`。

执行 V33 前必须先确认 V32 结构和 `seed/generated/V33__nutrition_usda_catalog_rebuild_manifest.json`，再执行 `validation/V32__nutrition_catalog_rebuild_contract_validation.sql` 与 `validation/V33__nutrition_usda_catalog_rebuild_seed_validation.sql`。V33 的 rollback 文件只是只读前置检查，不执行删除；重新筛选淘汰的旧生成记录只能在确认无业务引用后按软删除处理。

## V1

`V1__nutrition_usda_seed.sql` 首批导入 5 条 USDA FoodData Central `SR Legacy` 数据：米饭、鸡胸肉、鸡蛋、三文鱼和苹果。所有数值都是每 100g 基准值，来源版本和 FDC ID 写入 `nutrition_foods.source_version`，并以 `approved` 状态供 Java 匹配。

V1 本身不提供“个、碗、勺”等家庭单位换算，也不把 ml 默认当作 g。已完成官方食材级份量核验的规则单独放在 `V2__nutrition_usda_portion_seed.sql`；没有官方证据的单位仍不得新增 `nutrition_unit_conversions` 记录。

## V2

`V2__nutrition_usda_portion_seed.sql` 导入 5 条 USDA FoodData Central `foodPortions` 食材级规则：米饭 `1 cup=186g`、鸡胸肉 `1 cup=140g`、熟鸡蛋 `1 large=50g`、三文鱼 `3 oz=85g`（归一化为 `1 oz=28.3333g`）和苹果 `1 medium=161g`。每条记录保留 FDC ID、portion 序号和来源版本，写入 `nutrition_unit_conversions` 并标记 `approved`。

对应校验脚本为 `validation/V2__nutrition_usda_portion_seed_validation.sql`。V2 只覆盖有官方证据的食材/单位组合，未知食材或未覆盖单位继续返回 `pending`，不得由模型推断。

官方依据：

- [USDA FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide.html)：API、数据类型、许可证和建议引用。
- [USDA FoodData Central Data Documentation](https://fdc.nal.usda.gov/data-documentation.html)：`SR Legacy` 数据类型说明。

## V3

`V3__m2_2_sql_agent_catalog_seed.sql` registers the local FoodMate PostgreSQL
data source as explicitly read-only and publishes only the approved business
tables and fields for `database_query`. It contains metadata only; it does not
create users, food records, meal plans, or other business data. The seed is
idempotent by stable metadata IDs and must be run manually before local SQL
Agent integration tests. Its read-only validation is
`validation/V3__m2_2_sql_agent_catalog_seed_validation.sql`.

## V4

`V4__nutrition_usda_extended_seed.sql` adds 11 reviewed USDA FoodData Central
`SR Legacy` foods: oats, cooked pasta, cooked broccoli, baked potato, whole
milk, cooked 90/10 ground beef, lentils, firm tofu, whole-wheat bread, black
beans and banana. The values are per 100 g and retain the official FDC ID in
`source_version`.

The same seed adds 11 food-specific `foodPortions` rules, including cup,
medium, ounce and slice conversions. Portion rows whose original amount is
0.5 or 3 are normalized to one source unit, with the original amount retained
in `source_version`; no generic household conversion is inferred. The
corresponding read-only checks are in
`validation/V4__nutrition_usda_extended_seed_validation.sql`.

## V8

`V8__nutrition_usda_directory_expansion_seed.sql` adds 12 reviewed USDA FoodData Central `SR Legacy` foods and 12 food-specific `foodPortions` rules. The source version retains the FDC ID and portion number; portion amounts such as `3 oz=85 g` are normalized to one source unit without introducing a generic density conversion. The seed uses stable IDs `510049`-`510060` for foods and `520049`-`520060` for conversion rules.

The read-only checks are in `validation/V8__nutrition_usda_directory_expansion_validation.sql`. The 2026-09-02 local PostgreSQL validation returned 12 V8 foods, 12 V8 rules, zero invalid foods, zero invalid rules, zero food foreign-key mismatches, and zero malformed rule shapes. `NutritionExpansionV8SeedScriptTest` passes `2/2`. The current approved totals are 60 foods, 60 USDA foodPortion rules, 75 exact mass conversions, and 135 active conversions.

## 执行顺序

1. 确认目标数据库为本地 `FoodMate`，并先读取 seed SQL 和对应校验 SQL。
2. 人工执行 `V1__nutrition_usda_seed.sql`。
3. 执行 `validation/V1__nutrition_usda_seed_validation.sql`，确认 5 条记录为 `approved`、基准单位为 `g`、FDC ID 和四项营养值齐全。
4. 人工执行 `V2__nutrition_usda_portion_seed.sql`，再执行 `validation/V2__nutrition_usda_portion_seed_validation.sql`，确认 5 条规则为 `approved` 且来源版本包含 FDC ID/portion 序号。
5. 用真实 HTTP 创建带 `rice`、`鸡胸肉` 或其他已覆盖别名/单位的饮食记录，确认明细分别进入 `matched` 或无证据时的 `pending`，再验证营养分析。

6. 对 SQL Agent 本地业务验证，先执行 `V3__m2_2_sql_agent_catalog_seed.sql`，再运行受开关控制的 Java RocketMQ 测试；该 seed 不会替换或删除既有目录数据。

7. 如需扩展营养目录，人工执行 `V4__nutrition_usda_extended_seed.sql`，再执行对应 validation，确认 11 条食材和 11 条换算均为 `approved` 且来源版本包含 FDC ID/portion 序号。

8. 如需导入第二批常见食材，人工执行 `V5__nutrition_usda_common_foods_seed.sql`，再执行对应 validation，确认 9 条食材和 9 条换算均为 `approved` 且来源版本包含 FDC ID/portion 序号。

9. 如需启用无密度推断的质量单位，人工执行 `V6__nutrition_mass_unit_seed.sql`，再执行 `validation/V6__nutrition_mass_unit_seed_validation.sql`。该 seed 为现有克基准食材增加 `kg`、`mg` 和 `lb` 到 `g` 的精确换算；`oz` 仍使用食材级 USDA 规则，不由本 seed 覆盖。

10. 如需导入官方目录扩展，人工执行 `V7__nutrition_usda_directory_expansion_seed.sql`，再执行 `validation/V7__nutrition_usda_directory_expansion_validation.sql`，确认 23 条食材和 23 条换算均为 `approved`、来源版本包含 FDC ID/portion 序号、关联食材无缺失且规则形状错误为 `0`。V7 覆盖水果、蔬菜、谷物、坚果、鱼肉和禽畜肉等常用食材，所有份量均来自对应 USDA `food_portion` 记录；3 oz 规则仅按原始 85 g 归一化为每 oz 28.3333 g。
11. 如需导入 V8 官方目录扩展，人工执行 `V8__nutrition_usda_directory_expansion_seed.sql`，再执行 `validation/V8__nutrition_usda_directory_expansion_validation.sql`，确认 12 条食材和 12 条换算均为 `approved`、来源版本包含 FDC ID/portion 序号、关联食材无缺失且规则形状错误为 `0`；重复执行必须保持幂等。

12. 当前目录重建时，确认本地数据库和备份状态后人工执行 `migration/V32__nutrition_catalog_rebuild_contract.sql`，再执行 `validation/V32__nutrition_catalog_rebuild_contract_validation.sql`。
13. 读取 V33 manifest 后人工执行 `seed/generated/V33__nutrition_usda_catalog_rebuild_seed.sql`，再执行 `validation/V33__nutrition_usda_catalog_rebuild_seed_validation.sql`；确认活动食材为 1,000 条、活动 foodPortion 换算为 1,518 条、重复规范键和非法值均为 `0`。
14. 如需重新筛选 V33，先执行 `rollback/R33__nutrition_usda_catalog_rebuild_seed_precheck.sql` 并核对 `food_log_items` 引用，再由管理员确认软删除范围；禁止使用 `TRUNCATE` 或无条件删除。

seed 可重复执行：相同 `nutrition_food_id` 会被跳过；如果同一标准名称已被其他 ID 占用，SQL 会失败，必须先做数据评审，不得静默覆盖目录。

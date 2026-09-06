from unittest import TestCase

from model_provider import ModelProviderError, ModelResponse
from sql_planner import (
    DeterministicSqlPlanner,
    OpenAICompatibleSqlPlanner,
    ModelRouterSqlPlanner,
    SqlPlannerError,
    planner_from_environment,
    normalize_candidate_sql,
    _planner_prompt,
    validate_candidate_sql,
)


class DeterministicSqlPlannerTests(TestCase):
    def setUp(self):
        self.planner = DeterministicSqlPlanner()

    def test_recent_protein_query_returns_structured_bounded_plan(self):
        plan = self.planner.plan("分析最近7天蛋白质摄入")

        self.assertEqual("ready", plan.status)
        self.assertEqual("nutrition_summary", plan.intent)
        self.assertEqual({"kind": "relative", "days": "7", "timezone": "Asia/Shanghai"}, plan.time_range)
        self.assertEqual(("protein_g",), plan.metrics)
        self.assertIn("SUM(i.protein_g) AS protein_g", plan.candidate_sql)
        self.assertTrue(plan.candidate_sql.endswith("LIMIT 500"))
        self.assertNotIn("user_id =", plan.candidate_sql)

    def test_analysis_without_time_range_requires_clarification(self):
        plan = self.planner.plan("分析我的蛋白质摄入")

        self.assertEqual("need_clarification", plan.status)
        self.assertEqual(("time_range",), plan.missing_slots)
        self.assertIsNone(plan.candidate_sql)

    def test_fixed_templates_cover_plan_shopping_and_public_food_queries(self):
        self.assertIn("FROM meal_plans", self.planner.plan("查看我的餐食计划").candidate_sql)
        self.assertIn("FROM shopping_lists", self.planner.plan("查看购物清单").candidate_sql)
        self.assertIn("review_status = 'approved'", self.planner.plan("查询食材营养目录").candidate_sql)

    def test_core_nutrition_queries_have_explicit_business_metrics(self):
        today = self.planner.plan("今日热量")
        self.assertEqual("today", today.time_range["label"])
        self.assertEqual(("calories_kcal",), today.metrics)
        self.assertIn("CURRENT_DATE", today.candidate_sql)
        self.assertIn("SUM(i.calories_kcal)", today.candidate_sql)

        protein = self.planner.plan("分析最近7天蛋白质摄入")
        self.assertEqual(("protein_g",), protein.metrics)
        self.assertNotIn("GROUP BY", protein.candidate_sql)

    def test_food_occurrence_requires_a_precise_name_and_time_range(self):
        ready = self.planner.plan("统计最近7天鸡胸肉出现次数")
        self.assertEqual("food_occurrence", ready.intent)
        self.assertEqual("鸡胸肉", ready.filters["food_name"])
        self.assertIn("COUNT(i.food_log_item_id)", ready.candidate_sql)
        self.assertIn("i.raw_name = '鸡胸肉'", ready.candidate_sql)

        breakfast = self.planner.plan("统计最近7天早餐鸡胸肉出现次数")
        self.assertEqual("breakfast", breakfast.filters["meal_type"])
        self.assertIn("f.meal_type = 'breakfast'", breakfast.candidate_sql)

        ambiguous = self.planner.plan("统计最近7天鸡肉出现次数")
        self.assertEqual("need_clarification", ambiguous.status)
        self.assertEqual(("food_name",), ambiguous.missing_slots)

    def test_plan_completion_and_shopping_missing_use_documented_status_semantics(self):
        completion = self.planner.plan("我的餐食计划完成度")
        self.assertEqual("meal_plan_completion", completion.intent)
        self.assertIn("completion_ratio", completion.candidate_sql)
        self.assertIn("status = 'saved'", completion.candidate_sql)

        shopping = self.planner.plan("查看购物清单缺项")
        self.assertEqual("shopping_list_missing", shopping.intent)
        self.assertIn("missing_item_groups", shopping.candidate_sql)

    def test_unsupported_nutrition_field_fails_closed(self):
        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_FIELD_UNSUPPORTED"):
            self.planner.plan("分析最近7天的钠摄入")

    def test_time_range_and_candidate_limits_fail_closed(self):
        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_TIME_RANGE_INVALID"):
            self.planner.plan("分析最近120天蛋白质摄入")
        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_SQL_INVALID"):
            validate_candidate_sql("DELETE FROM food_logs LIMIT 1")
        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_LIMIT_REQUIRED"):
            validate_candidate_sql("SELECT meal_time FROM food_logs")

    def test_model_sql_normalization_only_removes_safe_outer_wrappers(self):
        self.assertEqual(
            "SELECT meal_time FROM food_logs LIMIT 500",
            normalize_candidate_sql("```sql\nSELECT meal_time FROM food_logs LIMIT 500;\n```")
        )
        self.assertEqual(
            "SELECT meal_time FROM food_logs LIMIT 500",
            normalize_candidate_sql("SELECT meal_time FROM food_logs LIMIT 500;")
        )

class OpenAICompatibleSqlPlannerTests(TestCase):
    class Provider:
        def __init__(self, content):
            self.content = content

        def complete(self, _model, _request):
            return ModelResponse(self.content, 12, 10)

    def test_local_mode_validates_shared_structured_plan(self):
        planner = OpenAICompatibleSqlPlanner(
            self.Provider(
                '{"status":"ready","intent":"nutrition_summary",'
                '"time_range":{"kind":"relative","days":"7","timezone":"Asia/Shanghai"},'
                '"metrics":["protein_g"],"dimensions":["meal_time"],"filters":{},'
                '"candidate_sql":"SELECT meal_time FROM food_logs LIMIT 500","missing_slots":[]}'
            ),
            "local-model",
        )

        plan = planner.plan("最近7天蛋白质摄入")

        self.assertEqual("local", plan.planner_mode)
        self.assertEqual("ready", plan.status)
        self.assertEqual(("protein_g",), plan.metrics)

    def test_model_plan_stores_normalized_candidate_sql(self):
        planner = OpenAICompatibleSqlPlanner(
            self.Provider(
                '{"status":"ready","intent":"nutrition_summary",'
                '"time_range":{"kind":"relative","days":"7","timezone":"Asia/Shanghai"},'
                '"metrics":["protein_g"],"dimensions":["meal_time"],"filters":{},'
                '"candidate_sql":"SELECT meal_time FROM food_logs LIMIT 500;",'
                '"missing_slots":[]}'
            ),
            "local-model",
        )

        plan = planner.plan("最近7天蛋白质摄入")

        self.assertEqual("SELECT meal_time FROM food_logs LIMIT 500", plan.candidate_sql)

    def test_prompt_pins_sql_to_the_authorized_schema_examples(self):
        prompt = _planner_prompt("最近7天蛋白质摄入", None)

        self.assertIn("meal_time for both the time filter and grouping", prompt)
        self.assertIn("log_time", prompt)
        self.assertIn("SELECT SUM(i.protein_g) AS protein_g", prompt)

    def test_missing_shared_chat_route_fails_without_stub_fallback(self):
        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_CONFIG_MISSING"):
            planner_from_environment({"FOODMATE_SQL_PLANNER_MODE": "local"})

    def test_invalid_model_json_fails_closed(self):
        planner = OpenAICompatibleSqlPlanner(self.Provider("not-json"), "local-model")

        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_RESPONSE_INVALID"):
            planner.plan("最近7天蛋白质摄入")


class ModelRouterSqlPlannerTests(TestCase):
    class Router:
        environment = {
            "FOODMATE_MODEL_TIER_STANDARD": "cloud_primary:chat-model",
        }

        def __init__(self, content):
            self.content = content
            self.calls = []

        def fallback_tiers_for(self, _tier):
            return ()

        def invoke(self, request, tier, fallback_tiers, governed_route=None):
            self.calls.append((request, tier, fallback_tiers, governed_route))
            return ModelResponse(self.content, 12, 10, "provider-request"), ["attempt"]

    def test_local_mode_uses_shared_chat_route_and_returns_attempts(self):
        router = self.Router(
            '{"status":"ready","intent":"nutrition_summary",'
            '"time_range":{"kind":"relative","days":"7","timezone":"Asia/Shanghai"},'
            '"metrics":["protein_g"],"dimensions":["meal_time"],"filters":{},'
            '"candidate_sql":"SELECT meal_time FROM food_logs LIMIT 500","missing_slots":[]}'
        )
        planner = planner_from_environment(
            {
                "FOODMATE_SQL_PLANNER_MODE": "local",
                "FOODMATE_MODEL_TIER_STANDARD": "cloud_primary:chat-model",
            },
            router,
        )

        plan, attempts = planner.plan_with_attempts(
            "最近7天蛋白质摄入",
            governed_route={"provider_code": "cloud_primary", "model_name": "chat-model"},
        )

        self.assertIsInstance(planner, ModelRouterSqlPlanner)
        self.assertEqual("local", plan.planner_mode)
        self.assertEqual(["attempt"], attempts)
        self.assertEqual("sql_planner", router.calls[0][0].scene)
        self.assertEqual("standard", router.calls[0][1])
        self.assertEqual("cloud_primary", router.calls[0][3]["provider_code"])
        self.assertNotIn("API_KEY", router.calls[0][0].prompt)

    def test_local_mode_rejects_deterministic_route_instead_of_falling_back(self):
        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_CONFIG_MISSING"):
            planner_from_environment(
                {
                    "FOODMATE_SQL_PLANNER_MODE": "local",
                    "FOODMATE_MODEL_TIER_STANDARD": "deterministic:local",
                }
            )

    def test_governed_deterministic_route_is_rejected(self):
        router = self.Router(
            '{"status":"ready","intent":"nutrition_summary",'
            '"time_range":{"kind":"relative","days":"7"},"metrics":[],"dimensions":[],"filters":{},'
            '"candidate_sql":"SELECT meal_time FROM food_logs LIMIT 1","missing_slots":[]}'
        )
        planner = ModelRouterSqlPlanner(router, "standard", 30)

        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_CONFIG_MISSING"):
            planner.plan_with_attempts(
                "最近7天饮食",
                governed_route={"provider_code": "deterministic", "model_name": "local"},
            )

    def test_shared_provider_failure_is_stable_and_preserves_attempts(self):
        class FailingRouter(self.Router):
            def invoke(self, *_args, **_kwargs):
                error = ModelProviderError("MODEL_PROVIDER_REJECTED", "provider rejected")
                error.attempts = ["attempt"]
                raise error

        planner = ModelRouterSqlPlanner(FailingRouter(""), "standard", 30)

        with self.assertRaisesRegex(SqlPlannerError, "SQL_PLANNER_MODEL_UNAVAILABLE") as raised:
            planner.plan_with_attempts("最近7天饮食")

        self.assertEqual(["attempt"], raised.exception.attempts)

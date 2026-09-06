import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).parents[1]))

from agent_core import (
    Context,
    DeterministicComposer,
    DeterministicRouter,
    generate_meal_plan_proposal,
    generate_food_log_writer_proposal,
    generate_tool_proposals,
)
from model_provider import ModelResponse
from proposal_protocol import Proposal, validate_proposal


class ToolProtocolTests(unittest.TestCase):
    def test_explicit_meal_plan_route_wins_over_meal_name(self):
        planning = DeterministicRouter().route(
            "请制定一个 2 天的餐食计划，安排每天早餐、午餐和晚餐"
        )
        self.assertEqual("planning", planning.intent)
        self.assertEqual((), planning.missing_slots)

        constrained = DeterministicRouter().route(
            "请生成 7 天餐食计划，目标是均衡蛋白质和蔬菜"
        )
        self.assertEqual("planning", constrained.intent)

        recording = DeterministicRouter().route("记录早餐：燕麦 50g")
        self.assertEqual("record", recording.intent)

    def test_real_model_food_log_candidate_is_strict_and_requires_java_confirmation(self):
        class Router:
            def tier_for(self, *_args):
                return "high"

            def fallback_tiers_for(self, _tier):
                return ()

            def invoke(self, *_args, **_kwargs):
                return (
                    ModelResponse(
                        '{"operation":"create","meal_time":"2026-09-04T04:00:00Z",'
                        '"meal_type":"lunch","notes":null,'
                        '"items":[{"name":"rice","amount":150,"unit":"g"}]}',
                        10,
                        20,
                    ),
                    [],
                )

        route = DeterministicRouter().route("记录午餐：米饭 150g")
        proposals, attempts = generate_food_log_writer_proposal(
            {
                "run_id": "run-1",
                "dispatch_id": "dispatch-1",
                "deadline_at": "2026-09-04T05:00:00Z",
                "message": {"content": "记录午餐：米饭 150g"},
                "authorized_context": {"food_log_writer_authorized": True},
            },
            route,
            Router(),
        )

        self.assertEqual([], attempts)
        self.assertEqual("food_log_writer", proposals[0]["tool_name"])
        self.assertTrue(proposals[0]["requires_confirmation"])
        self.assertNotIn("confirmation_ref", proposals[0])
        validate_proposal(Proposal(**proposals[0]))

    def test_food_log_candidate_cannot_be_created_without_java_authorization(self):
        route = DeterministicRouter().route("记录午餐：米饭 150g")
        proposals, attempts = generate_food_log_writer_proposal(
            {"run_id": "run-1", "message": {"content": "记录午餐：米饭 150g"}},
            route,
            object(),
        )

        self.assertEqual([], proposals)
        self.assertEqual([], attempts)

    def test_calculator_proposal_is_valid_and_requires_no_confirmation(self):
        proposal = Proposal(
            "p-calc",
            "run-1",
            "tool",
            "v1",
            {"invocation_id": "inv-calc", "idempotency_key": "key-calc"},
            False,
            tool_name="calculator",
            input={"expression": "20 * 1.1"},
        )

        validate_proposal(Proposal(**proposal.as_dict()))

    def test_calculator_rejects_confirmation_and_unknown_expression_shape(self):
        with self.assertRaisesRegex(ValueError, "CALCULATOR_INPUT_INVALID"):
            validate_proposal(
                Proposal(
                    "p-calc",
                    "run-1",
                    "tool",
                    "v1",
                    {"invocation_id": "inv-calc"},
                    True,
                    tool_name="calculator",
                    input={"expression": "20 * 1.1"},
                )
            )
        with self.assertRaisesRegex(ValueError, "CALCULATOR_INPUT_INVALID"):
            validate_proposal(
                Proposal(
                    "p-calc",
                    "run-1",
                    "tool",
                    "v1",
                    {"invocation_id": "inv-calc"},
                    False,
                    tool_name="calculator",
                    input={"expression": [20, 1.1]},
                )
            )

    def test_plan_validator_proposal_requires_a_structured_plan_without_confirmation(self):
        proposal = Proposal(
            "p-plan",
            "run-1",
            "tool",
            "v1",
            {"invocation_id": "inv-plan", "idempotency_key": "key-plan"},
            False,
            tool_name="plan_validator",
            input={"plan": {"people": 1, "days": 1, "days_plan": []}},
        )

        validate_proposal(Proposal(**proposal.as_dict()))

    def test_plan_validator_proposal_rejects_non_object_plan(self):
        with self.assertRaisesRegex(ValueError, "PLAN_VALIDATOR_INPUT_INVALID"):
            validate_proposal(
                Proposal(
                    "p-plan",
                    "run-1",
                    "tool",
                    "v1",
                    {"invocation_id": "inv-plan"},
                    False,
                    tool_name="plan_validator",
                    input={"plan": []},
                )
            )

    def test_real_model_meal_plan_candidate_stops_at_java_validation(self):
        class Router:
            def tier_for(self, *_args):
                return "high"

            def fallback_tiers_for(self, _tier):
                return ()

            def invoke(self, *_args, **_kwargs):
                return (
                    ModelResponse(
                        '{"operation":"create","plan":{"plan_name":"一日均衡餐",'
                        '"people":1,"days":1,"budget":80,"calorie_target":1800,'
                        '"protein_target":90,"allergens":["花生"],"dislikes":["香菜"],'
                        '"days_plan":[{"breakfast":{"ingredients":[{"name":"燕麦","amount":50,"unit":"g"}]},'
                        '"lunch":{"ingredients":[{"name":"鸡胸肉","amount":150,"unit":"g"}]},'
                        '"dinner":{"ingredients":[{"name":"鸡蛋","amount":2,"unit":"个"}]}}]}}',
                        20,
                        40,
                    ),
                    [],
                )

        route = DeterministicRouter().route("计划 1 天三餐，预算 80 元，忌口香菜")
        proposals, attempts = generate_meal_plan_proposal(
            {
                "run_id": "run-plan-1",
                "dispatch_id": "dispatch-plan-1",
                "deadline_at": "2026-09-04T05:00:00Z",
                "message": {"content": "计划 1 天三餐，预算 80 元，忌口香菜"},
                "authorized_context": {"meal_plan_writer_authorized": True},
            },
            route,
            Router(),
        )

        self.assertEqual([], attempts)
        self.assertEqual("plan_validator", proposals[0]["tool_name"])
        self.assertFalse(proposals[0]["requires_confirmation"])
        validate_proposal(Proposal(**proposals[0]))

    def test_validated_meal_plan_candidate_transitions_to_save_confirmation(self):
        route = DeterministicRouter().route("计划 1 天三餐")
        plan = {
            "plan_name": "一日计划",
            "people": 1,
            "days": 1,
            "budget": 50,
            "allergens": [],
            "dislikes": [],
            "days_plan": [{"breakfast": {}, "lunch": {}, "dinner": {}}],
        }
        proposals = generate_tool_proposals(
            {
                "run_id": "run-plan-2",
                "message": {"content": "计划 1 天三餐"},
                "authorized_context": {
                    "tool_results": [
                        {
                            "tool_name": "plan_validator",
                            "status": "succeeded",
                            "rows": [{"valid": True}],
                            "plan": plan,
                        }
                    ]
                },
            },
            route,
        )

        self.assertEqual("meal_plan.save_plan", proposals[0]["tool_name"])
        self.assertTrue(proposals[0]["requires_confirmation"])
        self.assertEqual(plan, proposals[0]["input"]["plan"])
        validate_proposal(Proposal(**proposals[0]))

    def test_deterministic_calculation_route_builds_authorized_proposal(self):
        route = DeterministicRouter().route("20 * 1.1")
        proposals = generate_tool_proposals({"run_id": "run-1", "message": {"content": "20 * 1.1"}}, route)

        self.assertEqual("calculation", route.intent)
        self.assertEqual("calculator", proposals[0]["tool_name"])
        self.assertEqual("20 * 1.1", proposals[0]["input"]["expression"])

    def test_composer_only_uses_java_calculator_result(self):
        route = DeterministicRouter().route("20 * 1.1")
        context = Context(
            messages=({"message_id": "m1"},),
            summary=None,
            memories=(),
            unresolved_slots=(),
            sources={"message_id": ("m1",), "summary_id": (), "memory_id": (), "citation_id": (), "invocation_id": ("inv-calc",)},
            tool_results=({"tool_name": "calculator", "status": "succeeded", "rows": [{"result": 22, "formula": "20 * 1.1"}]},),
        )

        answer = DeterministicComposer().compose("20 * 1.1", route, context, "normal")

        self.assertIn("计算结果：22", answer)
        self.assertIn("20 * 1.1", answer)

    def test_analysis_composer_explains_empty_results_without_inventing_a_value(self):
        route = DeterministicRouter().route("统计最近7天鸡胸肉出现次数")
        context = Context(
            messages=({"message_id": "m-analysis"},),
            summary=None,
            memories=(),
            unresolved_slots=(),
            sources={
                "message_id": ("m-analysis",),
                "summary_id": (),
                "memory_id": (),
                "citation_id": (),
                "invocation_id": ("inv-db",),
            },
            tool_results=(
                {
                    "tool_name": "database_query",
                    "status": "succeeded",
                    "rows": [],
                    "query_plan": {
                        "intent": "food_occurrence",
                        "time_range": {"kind": "relative", "days": "7"},
                        "metrics": ["occurrence_count"],
                        "dimensions": ["raw_name"],
                    },
                },
            ),
            analysis_plan={
                "intent": "food_occurrence",
                "time_range": {"kind": "relative", "days": "7"},
                "metrics": ["occurrence_count"],
                "dimensions": ["raw_name"],
            },
        )

        answer = DeterministicComposer().compose("统计最近7天鸡胸肉出现次数", route, context, "normal")

        self.assertIn("数据为空原因", answer)
        self.assertIn("没有找到该食材", answer)
        self.assertNotIn("0 次", answer)

    def test_planning_route_builds_validator_proposal_from_authorized_plan(self):
        route = DeterministicRouter().route("计划 1 天的三餐")
        plan = {
            "people": 1,
            "days": 1,
            "days_plan": [{"breakfast": {}, "lunch": {}, "dinner": {}}],
        }
        proposals = generate_tool_proposals(
            {
                "run_id": "run-1",
                "message": {"content": "计划 1 天的三餐"},
                "authorized_context": {"plan_validator_request": {"plan": plan}},
            },
            route,
        )

        self.assertEqual("planning", route.intent)
        self.assertEqual("plan_validator", proposals[0]["tool_name"])
        self.assertEqual(plan, proposals[0]["input"]["plan"])

    def test_composer_does_not_hide_plan_validation_issues(self):
        route = DeterministicRouter().route("计划 1 天的三餐")
        context = Context(
            messages=({"message_id": "m1"},),
            summary=None,
            memories=(),
            unresolved_slots=(),
            sources={"message_id": ("m1",), "summary_id": (), "memory_id": (), "citation_id": (), "invocation_id": ("inv-plan",)},
            tool_results=(
                {
                    "tool_name": "plan_validator",
                    "status": "failed",
                    "error_code": "PLAN_CONSTRAINTS_UNSATISFIED",
                    "rows": [{"valid": False, "issues": ["缺少 dinner"]}],
                },
            ),
        )

        answer = DeterministicComposer().compose("计划 1 天的三餐", route, context, "normal")

        self.assertIn("校验未通过", answer)
        self.assertIn("缺少 dinner", answer)


if __name__ == "__main__":
    unittest.main()

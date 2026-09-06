import unittest

from agent_core import Context, ContextBuilder, RouteDecision, generate_memory_candidates


class MemoryContextTest(unittest.TestCase):
    def context_for(self, content: str) -> Context:
        return Context(
            messages=(
                {"message_id": "assistant-1", "role": "assistant", "content": "好的"},
                {"message_id": "message-1", "role": "user", "content": content},
            ),
            summary=None,
            memories=(),
            unresolved_slots=(),
            sources={"message_id": ("assistant-1", "message-1")},
        )

    def test_extracts_stable_preferences_into_structured_candidates(self):
        content = "我喜欢清淡，我不吃香菜，我的预算是每天80元，我通常晚上7点吃饭，我不会做饭，以后回答请简洁"

        candidates = generate_memory_candidates(self.context_for(content), content, max_candidates=6)

        self.assertEqual(
            {
                ("preference", "diet_style"),
                ("constraint", "avoid_foods"),
                ("budget_habit", "daily_budget"),
                ("time_habit", "meal_time"),
                ("cooking_skill", "self_reported_level"),
                ("interaction_preference", "response_style"),
            },
            {(item["memory_type"], item["memory_key"]) for item in candidates},
        )
        self.assertTrue(all(item["source_message_ids"] == ["message-1"] for item in candidates))
        self.assertTrue(all(len(item["memory_value"]) == 1 for item in candidates))

    def test_does_not_turn_one_shot_request_or_health_fact_into_memory(self):
        one_shot = "今天请给我安排一份低脂晚餐计划"
        health = "我有糖尿病，营养目标是每天摄入1200卡"

        self.assertEqual([], generate_memory_candidates(self.context_for(one_shot), one_shot))
        self.assertEqual([], generate_memory_candidates(self.context_for(health), health))

    def test_context_filters_memory_types_status_and_duplicate_keys(self):
        command = {
            "authorized_context": {
                "long_term_memories": [
                    {"memory_id": "m1", "memory_type": "preference", "memory_key": "diet"},
                    {"memory_id": "m2", "memory_type": "plan", "memory_key": "week"},
                    {"memory_id": "m3", "memory_type": "preference", "memory_key": "diet"},
                    {
                        "memory_id": "m4",
                        "memory_type": "constraint",
                        "memory_key": "avoid_foods",
                        "confirmation_status": "conflict",
                    },
                ]
            }
        }

        context = ContextBuilder().build(command, RouteDecision("planning", "simple", "low"))

        self.assertEqual(("m1",), context.sources["memory_id"])
        self.assertEqual(("m1",), tuple(item["memory_id"] for item in context.memories))

    def test_source_falls_back_to_latest_context_source_for_legacy_message_shape(self):
        content = "我喜欢清淡"
        context = Context(
            messages=({"message_id": "legacy-message", "content": content},),
            summary=None,
            memories=(),
            unresolved_slots=(),
            sources={"message_id": ("legacy-message",)},
        )

        candidates = generate_memory_candidates(context, content)

        self.assertEqual(["legacy-message"], candidates[0]["source_message_ids"])


if __name__ == "__main__":
    unittest.main()

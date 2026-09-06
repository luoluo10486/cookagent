"""Structured SQL planning for the read-only database_query tool.

The planner produces a bounded candidate query. Java remains responsible for
schema authorization, user/tenant predicates, AST validation, and execution.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
import json
import os
from typing import Any

from model_provider import ModelProviderError, ModelRequest, ModelRouter, ProviderAttempt


MAX_SQL_LENGTH = 8_192
MAX_DAYS = 90
MAX_LIMIT = 500
_TIME_PATTERN = re.compile(r"(?:最近|过去|近)\s*(\d{1,3})\s*天")
_FOOD_QUERY_PATTERN = re.compile(
    r"^(?:查询|统计|看看|请问)?\s*(.+?)(?:出现了?几次|出现次数|吃了?几次|吃过几次)$"
)
_FOOD_AFTER_QUERY_PATTERN = re.compile(
    r"(?:出现次数|出现了?几次|吃了?几次|吃过几次)\s*(?:是|的)?\s*(.+)$"
)
_UNSUPPORTED_FIELD_TERMS = (
    "钠",
    "钙",
    "铁",
    "维生素",
    "膳食纤维",
    "胆固醇",
    "糖分",
    "血糖",
    "体重",
    "bmi",
)
_AMBIGUOUS_FOOD_NAMES = frozenset({"鸡肉", "牛肉", "鱼", "米饭", "鸡蛋"})


class SqlPlannerError(ModelProviderError):
    """必须向上层暴露、且不得自动生成备用查询的稳定规划失败。"""

    def __init__(
        self,
        code: str,
        message: str,
        missing_slots: tuple[str, ...] = (),
        attempts: list[ProviderAttempt] | None = None,
        retryable: bool = False,
    ):
        super().__init__(code, f"{code}: {message}", retryable)
        self.missing_slots = missing_slots
        if attempts is not None:
            self.attempts = list(attempts)


@dataclass(frozen=True)
class SqlPlan:
    status: str
    intent: str
    time_range: dict[str, str] | None
    metrics: tuple[str, ...]
    dimensions: tuple[str, ...]
    filters: dict[str, str]
    candidate_sql: str | None
    planner_mode: str
    planner_version: str
    missing_slots: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "intent": self.intent,
            "time_range": self.time_range,
            "metrics": list(self.metrics),
            "dimensions": list(self.dimensions),
            "filters": dict(self.filters),
            "candidate_sql": self.candidate_sql,
            "planner_mode": self.planner_mode,
            "planner_version": self.planner_version,
            "missing_slots": list(self.missing_slots),
        }

    @classmethod
    def from_model_output(cls, value: Any, mode: str, version: str) -> "SqlPlan":
        if not isinstance(value, dict):
            raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "planner response must be an object")
        status = value.get("status")
        intent = value.get("intent")
        if status not in {"ready", "need_clarification"} or intent not in {
            "nutrition_summary",
            "food_occurrence",
            "meal_plan_completion",
            "shopping_list_missing",
            "meal_plan",
            "shopping_list",
            "nutrition_food",
        }:
            raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "planner response status or intent is invalid")
        metrics = _bounded_strings(value.get("metrics"), "metrics", 6)
        dimensions = _bounded_strings(value.get("dimensions"), "dimensions", 4)
        filters = value.get("filters")
        if not isinstance(filters, dict) or any(
            not isinstance(key, str) or not isinstance(item, str) or len(key) > 64 or len(item) > 128
            for key, item in filters.items()
        ):
            raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "planner filters are invalid")
        time_range = value.get("time_range")
        if time_range is not None:
            if not isinstance(time_range, dict) or set(time_range) - {
                "kind",
                "days",
                "timezone",
                "label",
            }:
                raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "planner time range is invalid")
            if time_range.get("kind") != "relative" or not str(time_range.get("days", "")).isdigit():
                raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "planner time range is invalid")
            days = int(time_range["days"])
            if not 1 <= days <= MAX_DAYS:
                raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "planner time range is invalid")
            label = time_range.get("label")
            if label is not None and label not in {"today", "yesterday"}:
                raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "planner time range is invalid")
            time_range = {
                "kind": "relative",
                "days": str(days),
                "timezone": str(time_range.get("timezone") or "Asia/Shanghai"),
            }
            if label is not None:
                time_range["label"] = label
        missing_slots = _bounded_strings(value.get("missing_slots", []), "missing_slots", 4)
        candidate_sql = value.get("candidate_sql")
        if status == "need_clarification":
            if candidate_sql is not None or not missing_slots:
                raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "clarification response is incomplete")
        else:
            if not isinstance(candidate_sql, str):
                raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "ready response has no candidate SQL")
            candidate_sql = normalize_candidate_sql(candidate_sql)
            validate_candidate_sql(candidate_sql)
        return cls(
            status,
            intent,
            time_range,
            metrics,
            dimensions,
            dict(filters),
            candidate_sql,
            mode,
            version,
            missing_slots,
        )


def _bounded_strings(value: Any, name: str, maximum: int) -> tuple[str, ...]:
    if not isinstance(value, list) or len(value) > maximum or any(
        not isinstance(item, str) or not item or len(item) > 64 for item in value
    ):
        raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", f"planner {name} are invalid")
    return tuple(value)


def _time_where(field: str, time_range: dict[str, str] | None) -> list[str]:
    if not isinstance(time_range, dict):
        raise SqlPlannerError("SQL_PLANNER_TIME_RANGE_REQUIRED", "a bounded time range is required")
    label = time_range.get("label")
    if label == "today":
        return [
            f"{field} >= CURRENT_DATE",
            f"{field} < CURRENT_DATE + INTERVAL '1 day'",
        ]
    if label == "yesterday":
        return [
            f"{field} >= CURRENT_DATE - INTERVAL '1 day'",
            f"{field} < CURRENT_DATE",
        ]
    return [f"{field} >= CURRENT_TIMESTAMP - INTERVAL '{time_range['days']} days'"]


def _sql_literal(value: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > 64:
        raise SqlPlannerError("SQL_PLANNER_FOOD_NAME_INVALID", "food name is invalid")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise SqlPlannerError("SQL_PLANNER_FOOD_NAME_INVALID", "food name is invalid")
    return value.replace("'", "''")


class DeterministicSqlPlanner:
    """Maps a small nutrition-query vocabulary to reviewed SQL templates."""

    mode = "stub"
    version = "m2-2-deterministic-v1"

    def plan(self, question: str, intent_hint: str | None = None) -> SqlPlan:
        text = str(question or "").strip()
        if not text or len(text) > 2_000:
            raise SqlPlannerError("SQL_PLANNER_INPUT_INVALID", "query text is empty or too large")
        intent = self._intent(text, intent_hint)
        unsupported = self._unsupported_field(text)
        if unsupported:
            raise SqlPlannerError(
                "SQL_PLANNER_FIELD_UNSUPPORTED",
                f"unsupported nutrition field: {unsupported}",
            )
        time_range = self._time_range(text)
        metrics = self._metrics(text, intent)
        dimensions = self._dimensions(text, intent)
        filters = self._filters(text, intent)

        if intent in {"nutrition_summary", "food_occurrence"} and time_range is None:
            return SqlPlan(
                "need_clarification",
                intent,
                None,
                metrics,
                dimensions,
                filters,
                None,
                self.mode,
                self.version,
                ("time_range",),
            )
        if intent == "food_occurrence":
            food_name = self._food_name(text)
            if not food_name or food_name in _AMBIGUOUS_FOOD_NAMES:
                return SqlPlan(
                    "need_clarification",
                    intent,
                    time_range,
                    metrics,
                    dimensions,
                    filters,
                    None,
                    self.mode,
                    self.version,
                    ("food_name",),
                )
            filters["food_name"] = food_name
        sql = self._template(intent, time_range, metrics, dimensions, filters)
        validate_candidate_sql(sql)
        return SqlPlan(
            "ready",
            intent,
            time_range,
            metrics,
            dimensions,
            filters,
            sql,
            self.mode,
            self.version,
        )

    @staticmethod
    def _intent(text: str, hint: str | None) -> str:
        allowed = {
            "nutrition_summary",
            "food_occurrence",
            "meal_plan_completion",
            "shopping_list_missing",
            "meal_plan",
            "shopping_list",
            "nutrition_food",
        }
        if hint in allowed:
            return hint
        if any(word in text for word in ("出现次数", "出现了几次", "吃了几次", "吃过几次")):
            return "food_occurrence"
        if "完成度" in text and any(word in text for word in ("计划", "餐食", "饮食")):
            return "meal_plan_completion"
        if "缺项" in text and any(word in text for word in ("购物清单", "采购清单")):
            return "shopping_list_missing"
        if any(word in text for word in ("购物清单", "采购清单")):
            return "shopping_list"
        if any(word in text for word in ("餐食计划", "饮食计划", "菜单", "食谱计划")):
            return "meal_plan"
        if any(word in text for word in ("营养目录", "食材营养", "食物营养")):
            return "nutrition_food"
        return "nutrition_summary"

    @staticmethod
    def _time_range(text: str) -> dict[str, str] | None:
        match = _TIME_PATTERN.search(text)
        if match:
            days = int(match.group(1))
        elif "最近一周" in text or "过去一周" in text or "近一周" in text:
            days = 7
        elif "昨天" in text:
            return {
                "kind": "relative",
                "days": "1",
                "timezone": "Asia/Shanghai",
                "label": "yesterday",
            }
        elif "今天" in text or "今日" in text:
            return {
                "kind": "relative",
                "days": "1",
                "timezone": "Asia/Shanghai",
                "label": "today",
            }
        else:
            return None
        if not 1 <= days <= MAX_DAYS:
            raise SqlPlannerError("SQL_PLANNER_TIME_RANGE_INVALID", "time range is outside the approved bound")
        return {"kind": "relative", "days": str(days), "timezone": "Asia/Shanghai"}

    @staticmethod
    def _metrics(text: str, intent: str) -> tuple[str, ...]:
        if intent == "food_occurrence":
            return ("occurrence_count",)
        if intent == "meal_plan_completion":
            return ("completion_ratio",)
        if intent == "shopping_list_missing":
            return ("missing_item_groups",)
        if intent != "nutrition_summary":
            return ()
        mapping = (
            ("蛋白质", "protein_g"),
            ("蛋白", "protein_g"),
            ("热量", "calories_kcal"),
            ("卡路里", "calories_kcal"),
            ("脂肪", "fat_g"),
            ("碳水", "carbs_g"),
        )
        values = []
        for keyword, metric in mapping:
            if keyword in text and metric not in values:
                values.append(metric)
        return tuple(values or ("calories_kcal", "protein_g"))

    @staticmethod
    def _dimensions(text: str, intent: str) -> tuple[str, ...]:
        if intent != "nutrition_summary":
            return ()
        return ("meal_type",) if "按餐次" in text else ()

    @staticmethod
    def _filters(text: str, intent: str) -> dict[str, str]:
        filters: dict[str, str] = {}
        if intent == "nutrition_food":
            filters["review_status"] = "approved"
        if "早餐" in text:
            filters["meal_type"] = "breakfast"
        elif "午餐" in text:
            filters["meal_type"] = "lunch"
        elif "晚餐" in text:
            filters["meal_type"] = "dinner"
        return filters

    @staticmethod
    def _unsupported_field(text: str) -> str | None:
        lower = text.lower()
        return next((term for term in _UNSUPPORTED_FIELD_TERMS if term in lower), None)

    @staticmethod
    def _food_name(text: str) -> str | None:
        quoted = re.search(r"[「“\"]([^」”\"]{1,64})[」”\"]", text)
        if quoted:
            return quoted.group(1).strip()
        match = _FOOD_QUERY_PATTERN.search(text.strip())
        if match:
            value = match.group(1).strip()
        else:
            match = _FOOD_AFTER_QUERY_PATTERN.search(text.strip())
            value = match.group(1).strip() if match else ""
        value = re.sub(r"^(?:分析|统计|查询|看看|请问|我想知道)\s*", "", value)
        value = re.sub(r"^(?:(?:最近|过去|近)\s*\d{1,3}\s*天|今天|今日|昨天)\s*", "", value)
        value = re.sub(r"^(?:我|我的|记录中的|食材)\s*", "", value)
        value = re.sub(r"^(?:查询|统计|看看)\s*", "", value)
        return value[:64] if value else None

    @staticmethod
    def _template(
        intent: str,
        time_range: dict[str, str] | None,
        metrics: tuple[str, ...],
        dimensions: tuple[str, ...],
        filters: dict[str, str],
    ) -> str:
        if intent == "food_occurrence":
            food_name = filters.get("food_name")
            if not food_name:
                raise SqlPlannerError("SQL_PLANNER_FOOD_NAME_REQUIRED", "food name is required")
            where = _time_where("f.meal_time", time_range)
            if "meal_type" in filters:
                where.append("f.meal_type = '" + filters["meal_type"] + "'")
            where.append(f"i.raw_name = '{_sql_literal(food_name)}'")
            return (
                "SELECT i.raw_name AS food_name, COUNT(i.food_log_item_id) AS occurrence_count "
                "FROM food_logs f JOIN food_log_items i ON i.food_log_id = f.food_log_id "
                "WHERE "
                + " AND ".join(where)
                + " GROUP BY i.raw_name ORDER BY COUNT(i.food_log_item_id) DESC LIMIT 500"
            )
        if intent == "meal_plan_completion":
            return (
                "SELECT meal_plan_id, plan_name, days, status, "
                "CASE WHEN status = 'saved' THEN 1.0 WHEN status = 'validated' THEN 0.5 ELSE 0.0 END "
                "AS completion_ratio FROM meal_plans LIMIT 500"
            )
        if intent == "shopping_list_missing":
            return (
                "SELECT shopping_list_id, meal_plan_id, status, "
                "CASE WHEN status = 'confirmed' THEN 0 ELSE 1 END AS missing_item_groups "
                "FROM shopping_lists ORDER BY shopping_list_id DESC LIMIT 500"
            )
        if intent == "meal_plan":
            return "SELECT meal_plan_id, plan_name, days, status, updated_at FROM meal_plans ORDER BY updated_at DESC LIMIT 500"
        if intent == "shopping_list":
            return "SELECT shopping_list_id, meal_plan_id, status FROM shopping_lists ORDER BY shopping_list_id DESC LIMIT 500"
        if intent == "nutrition_food":
            return (
                "SELECT standard_name, basis_unit, calories_kcal_per_100, protein_g_per_100 "
                "FROM nutrition_foods WHERE review_status = 'approved' "
                "ORDER BY standard_name LIMIT 500"
            )

        if time_range is None:
            raise SqlPlannerError("SQL_PLANNER_TIME_RANGE_REQUIRED", "nutrition summary requires a time range")
        selected = [f"SUM(i.{metric}) AS {metric}" for metric in metrics]
        selected = [f"f.{dimension}" for dimension in dimensions] + selected
        group_by = ", ".join(f"f.{dimension}" for dimension in dimensions)
        where = _time_where("f.meal_time", time_range)
        if "meal_type" in filters:
            where.append("f.meal_type = '" + filters["meal_type"] + "'")
        query = (
            "SELECT "
            + ", ".join(selected)
            + " FROM food_logs f JOIN food_log_items i ON i.food_log_id = f.food_log_id AND i.is_deleted = FALSE WHERE "
            + " AND ".join(where)
        )
        if group_by:
            query += " GROUP BY " + group_by + " ORDER BY " + group_by + " LIMIT 500"
        else:
            query += " LIMIT 500"
        return query


class OpenAICompatibleSqlPlanner:
    """供协议单测注入 Provider 的结构化规划器。"""

    mode = "local"
    version = "m2-2-model-v1"

    def __init__(self, provider: Any, model_name: str):
        if provider is None or not model_name:
            raise SqlPlannerError("SQL_PLANNER_CONFIG_MISSING", "local SQL planner is not configured")
        self.provider = provider
        self.model_name = model_name

    @classmethod
    def from_environment(
        cls, environment: dict[str, str] | None = None
    ) -> "ModelRouterSqlPlanner":
        """兼容旧入口，但实际转发到共享 Chat 路由。"""
        return ModelRouterSqlPlanner.from_environment(environment)

    def plan(self, question: str, intent_hint: str | None = None) -> SqlPlan:
        plan, _ = self.plan_with_attempts(question, intent_hint)
        return plan

    def plan_with_attempts(
        self, question: str, intent_hint: str | None = None, governed_route: dict[str, object] | None = None
    ) -> tuple[SqlPlan, list[ProviderAttempt]]:
        text = str(question or "").strip()
        if not text or len(text) > 2_000:
            raise SqlPlannerError("SQL_PLANNER_INPUT_INVALID", "query text is empty or too large")
        prompt = _planner_prompt(text, intent_hint)
        try:
            response = self.provider.complete(
                self.model_name,
                ModelRequest(
                    scene="sql_planner",
                    prompt=prompt,
                    max_output_tokens=768,
                    temperature=0.0,
                    response_format={"type": "json_object"},
                ),
            )
            value = json.loads(response.content)
            return SqlPlan.from_model_output(value, self.mode, self.version), []
        except SqlPlannerError:
            raise
        except ModelProviderError as error:
            raise SqlPlannerError(
                "SQL_PLANNER_MODEL_UNAVAILABLE", error.code, attempts=error.attempts, retryable=error.retryable
            ) from error
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            raise SqlPlannerError("SQL_PLANNER_RESPONSE_INVALID", "local SQL planner response is invalid") from error


class ModelRouterSqlPlanner:
    """通过共享 Chat ModelRouter 进行 SQL 规划。

    规划器保留独立场景和结构化响应契约，但不拥有第二套端点、密钥、模型注册表或价格表。
    """

    mode = "local"
    version = "m2-2-router-v3"
    _allowed_tiers = frozenset({"standard", "high", "economy"})

    def __init__(self, router: ModelRouter, tier: str, timeout_seconds: float):
        if router is None:
            raise SqlPlannerError("SQL_PLANNER_CONFIG_MISSING", "shared model router is not configured")
        if tier not in self._allowed_tiers:
            raise SqlPlannerError("SQL_PLANNER_CONFIG_INVALID", "SQL planner tier is invalid")
        self.router = router
        self.tier = tier
        self.timeout_seconds = timeout_seconds

    @classmethod
    def from_environment(
        cls,
        environment: dict[str, str] | None = None,
        model_router: ModelRouter | None = None,
    ) -> "ModelRouterSqlPlanner":
        env = environment if environment is not None else os.environ
        tier = env.get("FOODMATE_SQL_PLANNER_TIER", "standard").strip().lower()
        if tier not in cls._allowed_tiers:
            raise SqlPlannerError("SQL_PLANNER_CONFIG_INVALID", "SQL planner tier is invalid")
        route = env.get("FOODMATE_MODEL_TIER_" + tier.upper(), "").strip()
        if not route or route.partition(":")[0].strip().lower() == "deterministic":
            raise SqlPlannerError(
                "SQL_PLANNER_CONFIG_MISSING",
                "local SQL planner requires a non-deterministic shared Chat route",
            )
        try:
            timeout = max(0.1, float(env.get("FOODMATE_SQL_PLANNER_TIMEOUT_SECONDS", "30")))
        except (TypeError, ValueError):
            raise SqlPlannerError("SQL_PLANNER_CONFIG_INVALID", "SQL planner timeout is invalid")
        return cls(model_router or ModelRouter(env), tier, timeout)

    def plan(self, question: str, intent_hint: str | None = None) -> SqlPlan:
        plan, _ = self.plan_with_attempts(question, intent_hint)
        return plan

    def plan_with_attempts(
        self,
        question: str,
        intent_hint: str | None = None,
        governed_route: dict[str, object] | None = None,
    ) -> tuple[SqlPlan, list[ProviderAttempt]]:
        text = str(question or "").strip()
        if not text or len(text) > 2_000:
            raise SqlPlannerError("SQL_PLANNER_INPUT_INVALID", "query text is empty or too large")
        safe_route = _cloud_only_governed_route(governed_route)
        prompt = _planner_prompt(text, intent_hint)
        try:
            response, attempts = self.router.invoke(
                ModelRequest(
                    scene="sql_planner",
                    prompt=prompt,
                    max_output_tokens=768,
                    temperature=0.0,
                    response_format={"type": "json_object"},
                    extra_body={"enable_thinking": False},
                    timeout_seconds=self.timeout_seconds,
                ),
                self.tier,
                _cloud_only_fallback_tiers(self.router, self.tier),
                governed_route=safe_route,
            )
            try:
                value = json.loads(response.content)
                return SqlPlan.from_model_output(value, self.mode, self.version), attempts
            except SqlPlannerError as error:
                error.attempts = list(attempts)
                raise
            except (TypeError, ValueError, json.JSONDecodeError) as error:
                raise SqlPlannerError(
                    "SQL_PLANNER_RESPONSE_INVALID",
                    "shared Chat SQL planner response is invalid",
                    attempts=list(attempts),
                ) from error
        except SqlPlannerError:
            raise
        except ModelProviderError as error:
            raise SqlPlannerError(
                "SQL_PLANNER_MODEL_UNAVAILABLE",
                error.code,
                attempts=error.attempts,
                retryable=error.retryable,
            ) from error


def _planner_prompt(question: str, intent_hint: str | None) -> str:
    """只向模型提供已批准的只读 Schema，Java 仍是最终权威边界。"""
    return json.dumps(
        {
            "task": "produce_database_query_plan",
            "question": question,
            "intent_hint": intent_hint,
            "security_rules": [
                "Return JSON only and never execute a query.",
                "Use only the listed tables and columns.",
                "Return one SELECT or WITH query ending in LIMIT <= 500, with no semicolon and no Markdown code fence.",
                "Never select user_id, notes, items_json, nutrition_json, or any unlisted field.",
                "Java adds the current-user and is_deleted predicates; do not invent another user or tenant.",
                "A Java AST guard will reject writes, subqueries, unknown fields, sensitive fields, and unbounded queries.",
            ],
            "approved_schema": {
                "food_logs": ["food_log_id", "meal_time", "meal_type", "is_deleted"],
                "food_log_items": [
                    "food_log_item_id",
                    "food_log_id",
                    "raw_name",
                    "amount",
                    "unit",
                    "calories_kcal",
                    "protein_g",
                    "fat_g",
                    "carbs_g",
                    "nutrition_status",
                    "is_deleted",
                ],
                "meal_plans": ["meal_plan_id", "plan_name", "days", "status", "updated_at", "is_deleted"],
                "shopping_lists": ["shopping_list_id", "meal_plan_id", "status", "is_deleted"],
                "nutrition_foods": [
                    "nutrition_food_id",
                    "standard_name",
                    "chinese_name",
                    "basis_unit",
                    "calories_kcal_per_100",
                    "protein_g_per_100",
                    "fat_g_per_100",
                    "carbs_g_per_100",
                    "review_status",
                    "is_deleted",
                ],
            },
            "approved_sql_examples": {
                "nutrition_summary": (
                    "SELECT SUM(i.protein_g) AS protein_g FROM food_logs f "
                    "JOIN food_log_items i ON i.food_log_id = f.food_log_id "
                    "WHERE f.meal_time >= CURRENT_TIMESTAMP - INTERVAL '7 days' "
                    "LIMIT 500"
                ),
                "food_occurrence": (
                    "SELECT i.raw_name AS food_name, COUNT(i.food_log_item_id) AS occurrence_count "
                    "FROM food_logs f JOIN food_log_items i ON i.food_log_id = f.food_log_id "
                    "WHERE f.meal_time >= CURRENT_TIMESTAMP - INTERVAL '7 days' "
                    "AND i.raw_name = '鸡胸肉' GROUP BY i.raw_name "
                    "ORDER BY COUNT(i.food_log_item_id) DESC LIMIT 500"
                ),
                "meal_plan_completion": (
                    "SELECT meal_plan_id, plan_name, days, status, "
                    "CASE WHEN status = 'saved' THEN 1.0 WHEN status = 'validated' THEN 0.5 ELSE 0.0 END "
                    "AS completion_ratio FROM meal_plans LIMIT 500"
                ),
                "shopping_list_missing": (
                    "SELECT shopping_list_id, meal_plan_id, status, "
                    "CASE WHEN status = 'confirmed' THEN 0 ELSE 1 END AS missing_item_groups "
                    "FROM shopping_lists ORDER BY shopping_list_id DESC LIMIT 500"
                ),
                "meal_plan": "SELECT meal_plan_id, plan_name, days, status, updated_at FROM meal_plans ORDER BY updated_at DESC LIMIT 500",
                "shopping_list": "SELECT shopping_list_id, meal_plan_id, status FROM shopping_lists ORDER BY shopping_list_id DESC LIMIT 500",
                "nutrition_food": (
                    "SELECT standard_name, basis_unit, calories_kcal_per_100, protein_g_per_100 "
                    "FROM nutrition_foods WHERE review_status = 'approved' "
                    "ORDER BY standard_name LIMIT 500"
                ),
            },
            "sql_generation_constraints": [
                "Copy the matching approved_sql_examples shape and change only approved columns or the relative day literal when needed.",
                "Do not invent aliases, aggregate names, date functions, log_time, total_calories, total_protein_g, total_fat_g, or total_carbs_g.",
                "For nutrition_summary, use meal_time for both the time filter and grouping when grouping is explicitly requested; otherwise return a total. log_time is not an approved field. Use only calories_kcal, protein_g, fat_g, or carbs_g aggregates.",
                "For food_occurrence, use raw_name equality and COUNT(food_log_item_id); never use a fuzzy match or expose user_id.",
                "For meal_plan_completion, completion_ratio is saved=1, validated=0.5, draft=0; this is the lifecycle completion definition.",
                "For shopping_list_missing, missing_item_groups is 0 for confirmed and 1 for an unconfirmed list; it is not a count of raw shopping items.",
            ],
            "allowed_intents": [
                "nutrition_summary",
                "food_occurrence",
                "meal_plan_completion",
                "shopping_list_missing",
                "meal_plan",
                "shopping_list",
                "nutrition_food",
            ],
            "required_output": {
                "status": "ready or need_clarification",
                "intent": "approved intent",
                "time_range": {"kind": "relative", "days": "integer string", "timezone": "IANA timezone"},
                "metrics": ["approved metric names"],
                "dimensions": ["approved dimension names"],
                "filters": {"approved_field": "approved literal"},
                "candidate_sql": "single SELECT/WITH SELECT ending in LIMIT <= 500",
                "missing_slots": ["required clarification slots"],
            },
        },
        ensure_ascii=False,
        sort_keys=True,
    )


def _cloud_only_fallback_tiers(router: ModelRouter, tier: str) -> tuple[str, ...]:
    """真实 SQL 规划路由移除 deterministic 备选，避免无提示降级。"""
    environment = getattr(router, "environment", {})
    candidates = []
    for fallback in router.fallback_tiers_for(tier):
        alias = environment.get("FOODMATE_MODEL_TIER_" + fallback.upper(), "").strip()
        if alias and alias.partition(":")[0].strip().lower() != "deterministic":
            candidates.append(fallback)
    return tuple(candidates)


def _cloud_only_governed_route(route: dict[str, object] | None) -> dict[str, object] | None:
    if route is None:
        return None
    safe = dict(route)
    provider = str(safe.get("provider_code") or "").strip().lower()
    if provider == "deterministic":
        raise SqlPlannerError(
            "SQL_PLANNER_CONFIG_MISSING", "local SQL planner cannot use a deterministic governed route"
        )
    fallback_provider = str(safe.get("fallback_provider_code") or "").strip().lower()
    if fallback_provider == "deterministic":
        safe.pop("fallback_provider_code", None)
        safe.pop("fallback_model_name", None)
    return safe


def planner_from_environment(
    environment: dict[str, str] | None = None,
    model_router: ModelRouter | None = None,
):
    """Build exactly one configured planner mode; local never falls back to stub."""
    env = environment if environment is not None else os.environ
    mode = env.get("FOODMATE_SQL_PLANNER_MODE", "stub").strip().lower()
    if mode == "stub":
        return DeterministicSqlPlanner()
    if mode == "local":
        return ModelRouterSqlPlanner.from_environment(env, model_router)
    raise SqlPlannerError("SQL_PLANNER_MODE_INVALID", "SQL planner mode must be stub or local")


def validate_candidate_sql(statement: str) -> None:
    """Apply planner-side cheap checks before the Java AST trust boundary."""
    value = str(statement or "").strip()
    lowered = value.lower()
    if not value or len(value) > MAX_SQL_LENGTH:
        raise SqlPlannerError("SQL_PLANNER_SQL_INVALID", "candidate SQL is empty or too large")
    if not (lowered.startswith("select ") or lowered.startswith("with ")):
        raise SqlPlannerError("SQL_PLANNER_SQL_INVALID", "candidate SQL must be a read query")
    if ";" in value or "--" in value or "/*" in value or "*/" in value:
        raise SqlPlannerError("SQL_PLANNER_SQL_INVALID", "candidate SQL contains rejected syntax")
    if not re.search(r"\blimit\s+([1-9][0-9]{0,2})\s*$", lowered):
        raise SqlPlannerError("SQL_PLANNER_LIMIT_REQUIRED", "candidate SQL must end with a bounded limit")
    limit = int(re.search(r"\blimit\s+([1-9][0-9]{0,2})\s*$", lowered).group(1))
    if limit > MAX_LIMIT:
        raise SqlPlannerError("SQL_PLANNER_LIMIT_INVALID", "candidate SQL limit is too large")


def normalize_candidate_sql(statement: str) -> str:
    """移除模型常见的无语义外壳，保留 Java AST 的严格校验边界。"""
    value = str(statement or "").strip()
    fenced = re.fullmatch(r"```(?:sql)?\s*([\s\S]*?)\s*```", value, re.IGNORECASE)
    if fenced:
        value = fenced.group(1).strip()
    if value.endswith(";"):
        value = value[:-1].rstrip()
    return value

"""营养目录生成器的业务契约测试。"""

from __future__ import annotations

import json
import sys
from pathlib import Path


SCRIPT_DIRECTORY = Path(__file__).parents[2] / "script" / "data" / "nutrition"
sys.path.insert(0, str(SCRIPT_DIRECTORY))

import build_usda_catalog as catalog_builder


def test_food_form_keeps_strongest_food_state() -> None:
    """同一描述同时出现 raw 和 frozen 时，保留更具体的冷冻形态。"""
    assert catalog_builder.food_form("Egg, raw, frozen") == "frozen"
    assert catalog_builder.food_form("Beans, canned, cooked") == "canned"
    assert catalog_builder.food_form("Rice, cooked") == "cooked"
    assert catalog_builder.food_form("Apple, raw") == "raw"


def test_aliases_prefer_specific_rule_and_include_pinyin() -> None:
    """具体食材规则必须覆盖通用词规则，并提供拼音检索别名。"""
    overrides = [
        {"pattern": "rice", "chinese_name": "大米", "pinyin": "da mi", "aliases": ["米"]},
        {
            "pattern": "rice noodles",
            "chinese_name": "米粉",
            "pinyin": "mi fen",
            "aliases": ["米线"],
        },
    ]
    chinese_name, aliases, translated = catalog_builder.aliases_for(
        "Rice noodles, cooked", overrides
    )
    assert translated is True
    assert chinese_name == "米粉"
    assert aliases[:3] == ["米粉", "mi fen", "米线"]


def test_render_sql_contains_no_runtime_id_allocation() -> None:
    """种子 SQL 使用稳定外部标识，不得回退到 MAX(id)+1。"""
    record = {
        "fdc_id": 170001,
        "description": "Spinach, raw",
        "chinese_name": "菠菜",
        "aliases": ["菠菜", "bo cai", "Spinach, raw"],
        "canonical_key": "spinach raw",
        "category": "vegetable",
        "food_form": "raw",
        "nutrition": {
            "calories": catalog_builder.Decimal("23"),
            "protein": catalog_builder.Decimal("2.86"),
            "fat": catalog_builder.Decimal("0.39"),
            "carbs": catalog_builder.Decimal("3.63"),
        },
    }
    conversion = {
        "fdc_id": 170001,
        "portion_id": 900001,
        "seq_num": 1,
        "source_unit": "cup",
        "multiplier": catalog_builder.Decimal("30"),
        "data_points": 1,
        "source_version": "USDA-SR-Legacy-2019-04-01-FoodMate-1 FDC-170001 P-900001",
    }
    sql = catalog_builder.render_sql(
        [record], [conversion], "USDA-SR-Legacy-2019-04-01-FoodMate-1"
    )
    assert "MAX(" not in sql.upper()
    assert "600900001" in sql
    assert "USDA FoodData Central foodPortion" in sql
    assert "菠菜" in sql


def test_generated_catalog_artifact_matches_manifest() -> None:
    """提交的生成物行数和 manifest 必须保持一致。"""
    root = Path(__file__).parents[2]
    manifest_path = (
        root
        / "script"
        / "sql"
        / "FoodMate"
        / "seed"
        / "generated"
        / "V33__nutrition_usda_catalog_rebuild_manifest.json"
    )
    sql_path = manifest_path.with_name("V33__nutrition_usda_catalog_rebuild_seed.sql")
    if not manifest_path.exists() or not sql_path.exists():
        return

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    sql = sql_path.read_text(encoding="utf-8")
    conversion_marker = sql.index("INSERT INTO nutrition_unit_conversions")
    food_sql = sql[:conversion_marker]
    conversion_sql = sql[conversion_marker:]
    assert food_sql.count("\n    (") == manifest["selected_rows"]
    assert conversion_sql.count("\n    (") == manifest["conversion_rows"]
    assert manifest["source_archive_sha256"]
    assert "ON CONFLICT (nutrition_food_id) DO UPDATE SET" in food_sql
    assert "ON CONFLICT (conversion_id) DO UPDATE SET" in conversion_sql

#!/usr/bin/env python3
"""从 USDA FoodData Central SR Legacy CSV 构建可审计的营养目录 SQL。"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


DEFAULT_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
# SR Legacy 使用这组营养素 ID；不要混用 Foundation 或 API 的其他编码。
NUTRIENT_IDS = {"1008": "calories", "1003": "protein", "1004": "fat", "1005": "carbs"}
COMMON_TERMS = {
    "rice": 20,
    "wheat": 14,
    "bread": 12,
    "pasta": 12,
    "oats": 12,
    "potato": 12,
    "chicken": 18,
    "beef": 18,
    "pork": 16,
    "egg": 15,
    "milk": 14,
    "yogurt": 12,
    "cheese": 10,
    "tofu": 14,
    "beans": 10,
    "lentils": 10,
    "salmon": 12,
    "tuna": 10,
    "shrimp": 10,
    "broccoli": 12,
    "spinach": 12,
    "carrot": 10,
    "tomato": 10,
    "apple": 10,
    "banana": 10,
    "orange": 8,
    "peanut": 8,
    "almond": 8,
}
PORTION_UNIT_NAMES = frozenset(
    {
        "cup",
        "tablespoon",
        "teaspoon",
        "liter",
        "milliliter",
        "fl oz",
        "lb",
        "oz",
        "bar",
        "bottle",
        "can",
        "container",
        "breast",
        "chop",
        "drumstick",
        "fillet",
        "large",
        "medium",
        "small",
        "piece",
        "pieces",
        "slice",
        "slices",
        "stalk",
        "leaf",
        "leg",
        "loin",
        "wing",
        "bunch",
        "bulb",
        "chunk",
        "egg",
        "fish",
        "fruit",
        "head",
        "plantain",
        "spear",
        "unit",
        "package",
        "serving",
    }
)
USDA_CATEGORY_NAMES = {
    1: "dairy",
    2: "spice",
    4: "oil",
    5: "meat",
    9: "fruit",
    10: "meat",
    11: "vegetable",
    12: "nut",
    13: "meat",
    15: "fish",
    16: "legume",
    17: "meat",
    20: "grain",
}
EXCLUDED_PHRASES = (
    "babyfood",
    "fast food",
    "restaurant",
    "subway",
    "pillsbury",
    "quaker",
    "tinkyada",
    "de boles",
    "uncle ben",
    "silk ",
    "chobani",
    "ralston",
    "healthy choice",
    "popeyes",
    "olive garden",
    "gluten-free",
    "variety meats and by-products",
    "sweetbread",
    "giblets",
    "patty",
    "tenders",
    "breaded",
    "homemade",
    "fresh-refrigerated",
    "tofu yogurt",
    "with beef",
    "with pork",
    "cured",
    "corned",
    "breakfast strips",
    "separable fat",
    "skin only",
    "fat only",
    "chicken feet",
    "pork ears",
    "meatless",
    "added solution",
    "food distribution program",
    "alaska native",
    "northern plains",
    "shoshone",
    "navajo",
    "southwest",
    "bologna",
    "sausage",
    "luncheon",
    "salami",
    "pepperoni",
    "frankfurter",
    "bratwurst",
    "wurst",
    "loaf",
    "sandwich",
    "nachos",
    "pizza",
    "soup",
    "sauce",
    "gravy",
    "casserole",
    "entree",
    "pudding",
    "cookie",
    "cake",
    "candy",
    "cracker",
    "chips",
    "snack",
    "beverage",
    "drink",
    "cereal bar",
    "protein bar",
    "dry mix",
    "flavor",
)
GENERIC_ALIAS_PATTERNS = frozenset(
    {
        "beans",
        "chicken",
        "corn",
        "crustaceans",
        "fish",
        "mollusks",
        "nuts",
        "oil",
        "rice",
        "seeds",
        "wheat",
    }
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", type=Path, help="已下载的 USDA CSV 压缩包")
    parser.add_argument("--download-url", default=DEFAULT_URL)
    parser.add_argument("--download-to", type=Path, default=Path("tmp/usda-sr-legacy.zip"))
    parser.add_argument("--aliases", type=Path, default=Path("script/data/nutrition/chinese_alias_overrides.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("script/sql/FoodMate/seed/generated"))
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--catalog-version", default="USDA-SR-Legacy-2019-04-01-FoodMate-1")
    return parser.parse_args()


def download(source_url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"下载 USDA 数据：{source_url}", file=sys.stderr)
    with urllib.request.urlopen(source_url, timeout=60) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    return destination


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def csv_name(names: list[str], expected: str) -> str:
    for name in names:
        if Path(name).name.lower() == expected:
            return name
    raise ValueError(f"USDA 压缩包缺少 {expected}")


def read_rows(archive: zipfile.ZipFile, filename: str) -> list[dict[str, str]]:
    with archive.open(filename) as raw:
        return list(csv.DictReader((line.decode("utf-8-sig") for line in raw)))


def read_archive_rows(archive_path: Path, suffix: str) -> list[dict[str, str]]:
    """读取压缩包内指定表，统一处理目录前缀和 UTF-8 BOM。"""
    with zipfile.ZipFile(archive_path) as archive:
        filename = next(
            (name for name in archive.namelist() if name.casefold().endswith(suffix.casefold())),
            None,
        )
        if filename is None:
            return []
        return read_rows(archive, filename)


def decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        number = Decimal(value)
    except InvalidOperation:
        return None
    return number if number >= 0 else None


def canonical_key(description: str) -> str:
    value = description.casefold().strip()
    value = re.sub(r"[^\w\s]+", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def food_form(description: str) -> str:
    value = description.casefold()
    if "canned" in value:
        return "canned"
    if "frozen" in value:
        return "frozen"
    if "cooked" in value or "roasted" in value or "baked" in value or "boiled" in value:
        return "cooked"
    if "raw" in value or "uncooked" in value:
        return "raw"
    return "unspecified"


def catalog_category(category_id: str | None) -> str | None:
    """将 USDA 分类映射为 FoodMate 的稳定分类；未知分类不进入首期目录。"""
    try:
        return USDA_CATEGORY_NAMES.get(int(category_id or "0"))
    except ValueError:
        return None


def category_for_food(category_id: str | None, description: str) -> str | None:
    """将 USDA 分类细化为业务可读分类，单独识别鸡蛋。"""
    category = catalog_category(category_id)
    if category == "dairy" and re.search(r"\begg\b", description.casefold()):
        return "egg"
    return category


def is_eligible(description: str, category_id: str | None) -> bool:
    """仅保留可直接作为食材使用的 USDA 条目，过滤品牌和复合菜。"""
    if catalog_category(category_id) is None:
        return False
    lowered = description.casefold()
    normalized = re.sub(r"[^a-z0-9]+", " ", lowered).strip()
    return not any(
        phrase in lowered
        or re.sub(r"[^a-z0-9]+", " ", phrase.casefold()).strip() in normalized
        for phrase in EXCLUDED_PHRASES
    )


def relevance(description: str) -> int:
    value = description.casefold()
    score = sum(weight for term, weight in COMMON_TERMS.items() if re.search(rf"\b{re.escape(term)}\b", value))
    if " raw" in value or value.endswith("raw"):
        score += 10
    if " cooked" in value or " boiled" in value or " roasted" in value:
        score += 8
    if " frozen" in value:
        score += 4
    score -= value.count(",") * 3
    score -= value.count(" and ") * 4
    if "prepared" in value or "commercially" in value:
        score -= 10
    return score


def sql(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def load_overrides(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def aliases_for(description: str, overrides: list[dict[str, Any]]) -> tuple[str, list[str], bool]:
    lowered = description.casefold()
    matches = [
        item
        for item in overrides
        if re.search(rf"(?<![a-z]){re.escape(item['pattern'].casefold())}(?![a-z])", lowered)
    ]
    if matches:
        item = max(
            matches,
            key=lambda candidate: (
                candidate["pattern"].casefold() not in GENERIC_ALIAS_PATTERNS,
                len(candidate["pattern"]),
            ),
        )
        aliases = list(
            dict.fromkeys(
                [
                    item["chinese_name"],
                    item.get("pinyin", ""),
                    *item.get("aliases", []),
                    description,
                ]
            )
        )
        aliases = [alias for alias in aliases if alias]
        return item["chinese_name"], aliases, True
    return description, [description], False


def portion_unit(portion: dict[str, str], measure_units: dict[str, str]) -> str | None:
    """取得 USDA 份量单位；无法确认单位时不生成猜测规则。"""
    measure_name = (measure_units.get(portion.get("measure_unit_id", "")) or "").casefold().strip()
    modifier = (portion.get("modifier") or "").casefold().strip()
    candidates = [measure_name, modifier]
    for candidate in candidates:
        for unit in sorted(PORTION_UNIT_NAMES, key=lambda value: (-len(value), value)):
            if re.search(rf"(?<![a-z]){re.escape(unit)}(?![a-z])", candidate):
                return unit
    return None


def build_conversions(
    archive_path: Path, records: list[dict[str, Any]], catalog_version: str
) -> list[dict[str, Any]]:
    """按 USDA foodPortion 生成去重后的食材级克重换算规则。"""
    portions = read_archive_rows(archive_path, "/food_portion.csv")
    measure_rows = read_archive_rows(archive_path, "/measure_unit.csv")
    measure_units = {row["id"]: row["name"] for row in measure_rows}
    selected_ids = {str(record["fdc_id"]) for record in records}
    candidates: list[dict[str, Any]] = []
    for portion in portions:
        if portion.get("fdc_id") not in selected_ids:
            continue
        unit = portion_unit(portion, measure_units)
        try:
            amount = Decimal(portion.get("amount") or "0")
            gram_weight = Decimal(portion.get("gram_weight") or "0")
        except InvalidOperation:
            continue
        if unit is None or amount <= 0 or gram_weight <= 0:
            continue
        candidates.append(
            {
                "fdc_id": int(portion["fdc_id"]),
                "portion_id": int(portion["id"]),
                "seq_num": int(portion.get("seq_num") or "0"),
                "source_unit": unit,
                "multiplier": (gram_weight / amount).quantize(Decimal("0.0001")),
                "data_points": int(portion.get("data_points") or "0"),
                "source_version": f"{catalog_version} FDC-{portion['fdc_id']} P-{portion['id']}",
            }
        )

    # 同一食材和单位可能有多个 USDA 份量，优先保留数据点更多且 ID 更稳定的一条。
    selected: dict[tuple[int, str], dict[str, Any]] = {}
    for candidate in candidates:
        key = (candidate["fdc_id"], candidate["source_unit"])
        current = selected.get(key)
        if current is None or (
            candidate["data_points"], -candidate["portion_id"]
        ) > (current["data_points"], -current["portion_id"]):
            selected[key] = candidate
    return sorted(selected.values(), key=lambda item: (item["fdc_id"], item["source_unit"]))


def build_records(archive_path: Path, aliases_path: Path, limit: int, catalog_version: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    overrides = load_overrides(aliases_path)
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        foods = read_rows(archive, csv_name(names, "food.csv"))
        nutrients = read_rows(archive, csv_name(names, "food_nutrient.csv"))

    values: dict[str, dict[str, Decimal]] = defaultdict(dict)
    for row in nutrients:
        nutrient_name = NUTRIENT_IDS.get((row.get("nutrient_id") or "").strip())
        amount = decimal(row.get("amount"))
        if nutrient_name and amount is not None:
            values[row["fdc_id"]][nutrient_name] = amount

    candidates: list[dict[str, Any]] = []
    excluded_rows = 0
    for row in foods:
        description = " ".join((row.get("description") or "").split())
        nutrition = values.get(row.get("fdc_id", ""), {})
        if not description or set(NUTRIENT_IDS.values()) - nutrition.keys():
            continue
        if not is_eligible(description, row.get("food_category_id")):
            excluded_rows += 1
            continue
        chinese_name, aliases, translated = aliases_for(description, overrides)
        candidates.append(
            {
                "fdc_id": int(row["fdc_id"]),
                "description": description,
                "canonical_key": canonical_key(description),
                "chinese_name": chinese_name,
                "aliases": aliases,
                "translated": translated,
                "food_form": food_form(description),
                "category": category_for_food(row.get("food_category_id"), description),
                "nutrition": nutrition,
                "relevance": relevance(description),
            }
        )

    candidates.sort(
        key=lambda item: (
            -item["relevance"],
            len(item["description"]),
            item["fdc_id"],
        )
    )
    all_unique_candidates: list[dict[str, Any]] = []
    all_seen: set[str] = set()
    for candidate in candidates:
        key = candidate["canonical_key"]
        if key in all_seen:
            continue
        all_seen.add(key)
        all_unique_candidates.append(candidate)

    selected_candidates: list[dict[str, Any]] = []
    selected_seen: set[str] = set()
    category_counts: Counter[str] = Counter()
    category_limit = max(1, (limit * 2 + len(USDA_CATEGORY_NAMES) - 1) // len(USDA_CATEGORY_NAMES))
    for candidate in all_unique_candidates:
        key = candidate["canonical_key"]
        if category_counts[candidate["category"]] >= category_limit:
            continue
        selected_seen.add(key)
        selected_candidates.append(candidate)
        category_counts[candidate["category"]] += 1

    # 分类配额不足时用剩余唯一条目补齐目标数量，仍然保持完全相同名称不重复。
    if len(selected_candidates) < limit:
        for candidate in all_unique_candidates:
            key = candidate["canonical_key"]
            if key in selected_seen:
                continue
            selected_seen.add(key)
            selected_candidates.append(candidate)
            if len(selected_candidates) >= limit:
                break

    selected = selected_candidates[:limit]

    manifest = {
        "source_name": "USDA FoodData Central",
        "catalog_version": catalog_version,
        "source_archive_sha256": sha256(archive_path),
        "candidate_rows": len(candidates),
        "excluded_rows": excluded_rows,
        "selected_rows": len(selected),
        "deduplicated_rows": len(candidates) - len(all_unique_candidates),
        "limit_truncated_rows": max(0, len(all_unique_candidates) - len(selected)),
        "translated_rows": sum(1 for item in selected if item["translated"]),
        "untranslated_rows": sum(1 for item in selected if not item["translated"]),
        "categories": dict(sorted(Counter(item["category"] for item in selected).items())),
        "food_forms": {form: sum(1 for item in selected if item["food_form"] == form) for form in sorted({item["food_form"] for item in selected})},
    }
    return selected, manifest


def render_sql(
    records: list[dict[str, Any]], conversions: list[dict[str, Any]], catalog_version: str
) -> str:
    lines = [
        "-- USDA FoodData Central 目录重建结果，由 build_usda_catalog.py 生成。",
        "-- 原始压缩包不提交；执行前必须核对 manifest.json 和 V32 结构校验。",
        "BEGIN;",
        "",
        "INSERT INTO nutrition_foods (",
        "    nutrition_food_id, standard_name, chinese_name, aliases_json, category, basis_unit,",
        "    calories_kcal_per_100, protein_g_per_100, fat_g_per_100, carbs_g_per_100,",
        "    source_name, source_version, review_status, canonical_key, source_food_id,",
        "    catalog_version, food_form, data_type",
        ") VALUES",
    ]
    rows = []
    for item in records:
        nutrition = item["nutrition"]
        aliases_json = json.dumps(item["aliases"], ensure_ascii=False, separators=(",", ":"))
        rows.append(
            "    ("
            + ", ".join(
                [
                    str(item["fdc_id"]),
                    sql(item["description"]),
                    sql(item["chinese_name"]),
                    sql(aliases_json) + "::jsonb",
                    sql(item["category"]),
                    sql("g"),
                    sql(nutrition["calories"].quantize(Decimal("0.0001"))),
                    sql(nutrition["protein"].quantize(Decimal("0.0001"))),
                    sql(nutrition["fat"].quantize(Decimal("0.0001"))),
                    sql(nutrition["carbs"].quantize(Decimal("0.0001"))),
                    sql("USDA FoodData Central"),
                    sql(f"{catalog_version} FDC-{item['fdc_id']}"),
                    sql("approved"),
                    sql(item["canonical_key"]),
                    sql(str(item["fdc_id"])),
                    sql(catalog_version),
                    sql(item["food_form"]),
                    sql("official"),
                ]
            )
            + ")"
        )
    lines.append(",\n".join(rows) + "\nON CONFLICT (nutrition_food_id) DO UPDATE SET")
    lines.extend(
        [
            "    standard_name = EXCLUDED.standard_name,",
            "    chinese_name = EXCLUDED.chinese_name,",
            "    aliases_json = EXCLUDED.aliases_json,",
            "    category = EXCLUDED.category,",
            "    basis_unit = EXCLUDED.basis_unit,",
            "    calories_kcal_per_100 = EXCLUDED.calories_kcal_per_100,",
            "    protein_g_per_100 = EXCLUDED.protein_g_per_100,",
            "    fat_g_per_100 = EXCLUDED.fat_g_per_100,",
            "    carbs_g_per_100 = EXCLUDED.carbs_g_per_100,",
            "    source_name = EXCLUDED.source_name,",
            "    source_version = EXCLUDED.source_version,",
            "    review_status = EXCLUDED.review_status,",
            "    canonical_key = EXCLUDED.canonical_key,",
            "    source_food_id = EXCLUDED.source_food_id,",
            "    catalog_version = EXCLUDED.catalog_version,",
            "    food_form = EXCLUDED.food_form,",
            "    data_type = EXCLUDED.data_type,",
            "    is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP;",
        ]
    )
    if conversions:
        lines.extend(
            [
                "",
                "INSERT INTO nutrition_unit_conversions (",
                "    conversion_id, nutrition_food_id, source_unit, target_unit, multiplier,",
                "    source_name, source_version, review_status",
                ") VALUES",
            ]
        )
        conversion_rows = []
        for conversion in conversions:
            conversion_rows.append(
                "    ("
                + ", ".join(
                    [
                        str(600000000 + conversion["portion_id"]),
                        str(conversion["fdc_id"]),
                        sql(conversion["source_unit"]),
                        sql("g"),
                        sql(conversion["multiplier"]),
                        sql("USDA FoodData Central foodPortion"),
                        sql(conversion["source_version"]),
                        sql("approved"),
                    ]
                )
                + ")"
            )
        lines.append(",\n".join(conversion_rows))
        lines.extend(
            [
                "ON CONFLICT (conversion_id) DO UPDATE SET",
                "    nutrition_food_id = EXCLUDED.nutrition_food_id,",
                "    source_unit = EXCLUDED.source_unit,",
                "    target_unit = EXCLUDED.target_unit,",
                "    multiplier = EXCLUDED.multiplier,",
                "    source_name = EXCLUDED.source_name,",
                "    source_version = EXCLUDED.source_version,",
                "    review_status = EXCLUDED.review_status,",
                "    is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP;",
            ]
        )
    lines.extend(["", "COMMIT;"])
    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    if len(args.catalog_version) > 48:
        raise ValueError("catalog_version 过长，无法放入现有 VARCHAR(64) 溯源字段")
    archive = args.zip or args.download_to
    if not archive.exists():
        download(args.download_url, archive)
    records, manifest = build_records(archive, args.aliases, args.limit, args.catalog_version)
    if not records:
        raise ValueError("没有生成任何满足四项基础营养值的 USDA 食材")
    conversions = build_conversions(archive, records, args.catalog_version)
    manifest["conversion_rows"] = len(conversions)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_sql = args.output_dir / "V33__nutrition_usda_catalog_rebuild_seed.sql"
    manifest_path = args.output_dir / "V33__nutrition_usda_catalog_rebuild_manifest.json"
    output_sql.write_text(render_sql(records, conversions, args.catalog_version), encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output_sql": str(output_sql), "manifest": manifest, "archive": str(archive)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

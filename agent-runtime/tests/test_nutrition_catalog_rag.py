import json
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).parents[1]))

from knowledge_rag import RagSettings
from nutrition_catalog_rag import NutritionCatalogRecord, RedisNutritionCatalogIndex, index_records


class FakePipeline:
    def __init__(self, client):
        self.client = client
        self.operations = []

    def hset(self, key, field, value):
        self.operations.append(("hset", key, field, value))
        return self

    def execute(self):
        for _, key, field, value in self.operations:
            self.client.hashes.setdefault(key, {})[field] = value
        self.operations.clear()


class FakeRedis:
    def __init__(self):
        self.hashes = {}

    def pipeline(self):
        return FakePipeline(self)

    def hset(self, key, field, value):
        self.hashes.setdefault(key, {})[field] = value

    def hgetall(self, key):
        return dict(self.hashes.get(key, {}))


def record(food_id: str, name: str, chinese_name: str) -> NutritionCatalogRecord:
    return NutritionCatalogRecord(
        nutrition_food_id=food_id,
        standard_name=name,
        chinese_name=chinese_name,
        aliases=(),
        food_form="raw",
        basis_unit="g",
        calories_kcal_per_100="100",
        protein_g_per_100="10",
        fat_g_per_100="2",
        carbs_g_per_100="5",
        source_name="USDA",
        source_version="2026",
        catalog_version="catalog-1",
        canonical_key=name,
    )


class NutritionCatalogIndexTests(unittest.TestCase):
    def test_embedding_id_is_stable_and_stub_search_filters_to_published_catalog(self):
        client = FakeRedis()
        index = RedisNutritionCatalogIndex(client=client, prefix="test:nutrition")
        item = record("1", "chicken breast", "鸡胸肉")
        index.upsert([item])

        matches = index.search("鸡胸肉")

        self.assertEqual(item.embedding_id, item.embedding_id)
        self.assertEqual(["1"], [match.nutrition_food_id for match in matches])
        payload = json.loads(client.hgetall("test:nutrition:records")[item.embedding_id])
        self.assertEqual("nutrition_catalog", payload["source_type"])
        self.assertEqual("approved", payload["review_status"])

    def test_stub_batch_index_is_idempotent_by_stable_embedding_id(self):
        client = FakeRedis()
        settings = RagSettings.from_environment({"FOODMATE_RAG_MODE": "stub"})
        items = [record("1", "rice", "米饭"), record("2", "egg", "鸡蛋")]
        index = RedisNutritionCatalogIndex(client=client, prefix="test:nutrition")

        first = index_records(items, settings=settings, backend=index)
        second = index_records(items, settings=settings, backend=index)

        self.assertEqual(2, first["indexed"])
        self.assertEqual(2, second["indexed"])
        self.assertEqual(2, len(client.hgetall("test:nutrition:records")))


if __name__ == "__main__":
    unittest.main()

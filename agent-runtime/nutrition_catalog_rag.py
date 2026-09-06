"""营养目录的独立语义索引与检索适配。"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Iterable

from knowledge_rag import (
    PUBLIC_SCOPE,
    EmbeddingProvider,
    RagError,
    RagSettings,
    _milvus_string,
    _snippet,
    _tokens,
    build_local_embedder,
)


NUTRITION_SOURCE_TYPE = "nutrition_catalog"
_NUTRITION_COLLECTION = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,254}$")


@dataclass(frozen=True)
class NutritionCatalogRecord:
    """用于构建语义索引的营养目录快照。"""

    nutrition_food_id: str
    standard_name: str
    chinese_name: str
    aliases: tuple[str, ...]
    food_form: str
    basis_unit: str
    calories_kcal_per_100: str
    protein_g_per_100: str
    fat_g_per_100: str
    carbs_g_per_100: str
    source_name: str
    source_version: str
    catalog_version: str
    canonical_key: str

    @property
    def embedding_id(self) -> str:
        identity = f"{self.catalog_version}:{self.nutrition_food_id}"
        return "nutr_" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:32]

    @property
    def search_text(self) -> str:
        aliases = "、".join(self.aliases)
        return (
            f"标准名称: {self.standard_name}\n"
            f"中文名称: {self.chinese_name}\n"
            f"别名: {aliases}\n"
            f"食物形态: {self.food_form}\n"
            f"基准单位: {self.basis_unit}\n"
            f"每100{self.basis_unit}热量: {self.calories_kcal_per_100} 千卡\n"
            f"蛋白质: {self.protein_g_per_100} 克\n"
            f"脂肪: {self.fat_g_per_100} 克\n"
            f"碳水化合物: {self.carbs_g_per_100} 克"
        )

    @classmethod
    def from_mapping(cls, value: dict) -> "NutritionCatalogRecord":
        aliases = value.get("aliases") or ()
        if isinstance(aliases, str):
            aliases = (aliases,)
        return cls(
            nutrition_food_id=str(value["nutrition_food_id"]),
            standard_name=str(value.get("standard_name") or ""),
            chinese_name=str(value.get("chinese_name") or ""),
            aliases=tuple(str(item) for item in aliases if str(item).strip()),
            food_form=str(value.get("food_form") or ""),
            basis_unit=str(value.get("basis_unit") or "g"),
            calories_kcal_per_100=str(value.get("calories_kcal_per_100") or "0"),
            protein_g_per_100=str(value.get("protein_g_per_100") or "0"),
            fat_g_per_100=str(value.get("fat_g_per_100") or "0"),
            carbs_g_per_100=str(value.get("carbs_g_per_100") or "0"),
            source_name=str(value.get("source_name") or ""),
            source_version=str(value.get("source_version") or ""),
            catalog_version=str(value.get("catalog_version") or ""),
            canonical_key=str(value.get("canonical_key") or ""),
        )


@dataclass(frozen=True)
class NutritionMatch:
    """营养语义检索候选；营养数值必须回源 PostgreSQL 后才能用于写入。"""

    nutrition_food_id: str
    standard_name: str
    chinese_name: str
    food_form: str
    basis_unit: str
    source_name: str
    source_version: str
    catalog_version: str
    score: float
    snippet: str


def _nutrition_payload(record: NutritionCatalogRecord) -> dict:
    return {
        "source_type": NUTRITION_SOURCE_TYPE,
        "nutrition_food_id": record.nutrition_food_id,
        "standard_name": record.standard_name,
        "chinese_name": record.chinese_name,
        "food_form": record.food_form,
        "basis_unit": record.basis_unit,
        "source_name": record.source_name,
        "source_version": record.source_version,
        "catalog_version": record.catalog_version,
        "canonical_key": record.canonical_key,
        "search_text": record.search_text,
        "review_status": "approved",
        "is_deleted": False,
        "tenant_id": 0,
        "scope": PUBLIC_SCOPE,
        "visibility": "published",
        "indexed": True,
        "deleted": False,
        "current_version": True,
    }


class RedisNutritionCatalogIndex:
    """stub 模式的共享 Redis 营养索引，不读取 API Key，也不连接 Milvus。"""

    def __init__(self, client=None, prefix: str | None = None):
        import redis

        self.client = client or redis.Redis.from_url(
            os.getenv(
                "FOODMATE_REDIS_URL",
                "redis://:foodmate-redis-change-me@localhost:6380",
            ),
            decode_responses=True,
        )
        self.prefix = prefix or os.getenv(
            "FOODMATE_RAG_NUTRITION_STUB_REDIS_PREFIX",
            "foodmate:rag:nutrition:stub",
        )

    @property
    def _records_key(self) -> str:
        return f"{self.prefix}:records"

    def upsert(self, records: Iterable[NutritionCatalogRecord]) -> int:
        records = list(records)
        if not records:
            return 0
        pipe = self.client.pipeline()
        for record in records:
            pipe.hset(
                self._records_key,
                record.embedding_id,
                json.dumps(_nutrition_payload(record), ensure_ascii=False),
            )
        pipe.execute()
        return len(records)

    def search(self, query: str, limit: int = 12) -> list[NutritionMatch]:
        terms = set(_tokens(query))
        ranked: list[tuple[int, str, dict]] = []
        for embedding_id, raw in self.client.hgetall(self._records_key).items():
            value = json.loads(raw)
            if not _visible(value):
                continue
            score = len(terms.intersection(_tokens(value.get("search_text", ""))))
            if score:
                ranked.append((score, embedding_id, value))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        return [
            _match_from_payload(value, float(score))
            for score, _, value in ranked[: max(1, min(limit, 50))]
        ]


class MilvusNutritionCatalogIndex:
    """local 模式的独立 Milvus 营养向量集合。"""

    def __init__(self, settings: RagSettings):
        if settings.mode != "local":
            raise RagError("RAG_MODE_INVALID", "nutrition Milvus index requires local mode")
        collection = os.getenv(
            "FOODMATE_RAG_NUTRITION_MILVUS_COLLECTION",
            "foodmate_nutrition_foods",
        ).strip()
        if not _NUTRITION_COLLECTION.fullmatch(collection):
            raise RagError(
                "RAG_NUTRITION_COLLECTION_INVALID",
                "nutrition Milvus collection name is invalid",
            )
        try:
            from pymilvus import MilvusClient

            self.client = MilvusClient(uri=settings.milvus_uri)
        except ImportError as error:
            raise RagError("RAG_MILVUS_UNAVAILABLE", "pymilvus is not installed") from error
        except Exception as error:
            raise RagError("RAG_MILVUS_UNAVAILABLE", "Milvus is unavailable") from error
        self.collection = collection
        self.fingerprint = settings.index_fingerprint

    def _ensure_collection(self, dimension: int) -> None:
        try:
            if not self.client.has_collection(self.collection):
                self.client.create_collection(
                    self.collection,
                    dimension=dimension,
                    primary_field_name="embedding_id",
                    id_type="string",
                    max_length=128,
                    vector_field_name="vector",
                    metric_type="COSINE",
                    auto_id=False,
                    enable_dynamic_field=True,
                )
                return
            description = self.client.describe_collection(self.collection)
            fields = description.get("fields") or description.get("schema", {}).get("fields", [])
            vector = next((field for field in fields if field.get("name") == "vector"), None)
            actual = (vector or {}).get("params", {}).get("dim") or (vector or {}).get("params", {}).get("dimension")
            if actual is not None and int(actual) != dimension:
                raise RagError(
                    "RAG_NUTRITION_DIMENSION_MISMATCH",
                    "nutrition vector dimension does not match the configured embedding model",
                )
            self._verify_identity()
        except RagError:
            raise
        except Exception as error:
            raise RagError("RAG_MILVUS_UNAVAILABLE", "nutrition collection is unavailable") from error

    def _verify_identity(self) -> None:
        rows = self.client.query(
            collection_name=self.collection,
            filter="",
            output_fields=["embedding_id", "embedding_fingerprint"],
            limit=1,
        )
        if not rows:
            return
        actual = str(rows[0].get("embedding_fingerprint", "")).strip()
        if actual != self.fingerprint:
            raise RagError(
                "RAG_NUTRITION_MODEL_MISMATCH",
                "nutrition collection embedding identity does not match",
            )

    def upsert(
        self,
        records: Iterable[NutritionCatalogRecord],
        vectors: list[list[float]],
    ) -> int:
        records = list(records)
        if not records or len(records) != len(vectors):
            raise RagError("RAG_EMBEDDING_INVALID_RESPONSE", "nutrition vectors are inconsistent")
        dimension = len(vectors[0])
        if dimension == 0 or any(len(vector) != dimension for vector in vectors):
            raise RagError("RAG_EMBEDDING_INVALID_RESPONSE", "nutrition vector dimensions are inconsistent")
        self._ensure_collection(dimension)
        rows = []
        for record, vector in zip(records, vectors, strict=True):
            rows.append(
                {
                    "embedding_id": record.embedding_id,
                    "vector": vector,
                    "embedding_fingerprint": self.fingerprint,
                    **_nutrition_payload(record),
                }
            )
        try:
            self.client.upsert(collection_name=self.collection, data=rows)
            flush = getattr(self.client, "flush", None)
            if callable(flush):
                flush(collection_name=self.collection)
        except Exception as error:
            raise RagError("RAG_NUTRITION_WRITE_FAILED", "nutrition vector upsert failed") from error
        return len(rows)

    def search(
        self,
        query: str,
        embedder: EmbeddingProvider,
        limit: int = 12,
    ) -> list[NutritionMatch]:
        vectors = embedder.embed([query])
        if not vectors or not vectors[0]:
            return []
        self._ensure_collection(len(vectors[0]))
        try:
            hits = self.client.search(
                collection_name=self.collection,
                data=vectors,
                anns_field="vector",
                filter=(
                    'source_type == "nutrition_catalog" and tenant_id == 0 '
                    'and scope == "public_published" and visibility == "published" '
                    'and indexed == true and deleted == false and review_status == "approved" '
                    'and current_version == true '
                    f'and embedding_fingerprint == "{_milvus_string(self.fingerprint)}"'
                ),
                limit=max(1, min(limit, 50)),
                output_fields=[
                    "nutrition_food_id",
                    "standard_name",
                    "chinese_name",
                    "food_form",
                    "basis_unit",
                    "source_name",
                    "source_version",
                    "catalog_version",
                    "search_text",
                ],
            )[0]
        except Exception as error:
            raise RagError("RAG_NUTRITION_SEARCH_FAILED", "nutrition vector search failed") from error
        result = []
        for hit in hits:
            entity = hit.get("entity", hit)
            result.append(_match_from_payload(entity, float(hit.get("distance", 0))))
        return result


def _visible(value: dict) -> bool:
    return (
        value.get("source_type") == NUTRITION_SOURCE_TYPE
        and value.get("tenant_id") == 0
        and value.get("scope") == PUBLIC_SCOPE
        and value.get("visibility") == "published"
        and value.get("indexed") is True
        and value.get("deleted") is False
        and value.get("review_status") == "approved"
        and value.get("current_version") is True
    )


def _match_from_payload(value: dict, score: float) -> NutritionMatch:
    return NutritionMatch(
        nutrition_food_id=str(value.get("nutrition_food_id", "")),
        standard_name=str(value.get("standard_name", "")),
        chinese_name=str(value.get("chinese_name", "")),
        food_form=str(value.get("food_form", "")),
        basis_unit=str(value.get("basis_unit", "g")),
        source_name=str(value.get("source_name", "")),
        source_version=str(value.get("source_version", "")),
        catalog_version=str(value.get("catalog_version", "")),
        score=score,
        snippet=_snippet(str(value.get("search_text", ""))),
    )


def _index_backend(settings: RagSettings):
    if settings.mode == "stub":
        return RedisNutritionCatalogIndex()
    return MilvusNutritionCatalogIndex(settings)


def search_nutrition_catalog(
    query: str,
    settings: RagSettings | None = None,
    limit: int = 12,
) -> list[NutritionMatch]:
    settings = settings or RagSettings.from_environment()
    if not query or not query.strip():
        raise RagError("RAG_QUERY_INVALID", "nutrition query is empty")
    backend = _index_backend(settings)
    if settings.mode == "stub":
        return backend.search(query.strip(), limit)
    return backend.search(query.strip(), build_local_embedder(settings), limit)


def _serialize_records(value: str) -> list[NutritionCatalogRecord]:
    rows = json.loads(value)
    if not isinstance(rows, list):
        raise ValueError("nutrition catalog input must be a JSON array")
    return [NutritionCatalogRecord.from_mapping(row) for row in rows]


def index_records(
    records: list[NutritionCatalogRecord],
    settings: RagSettings | None = None,
    batch_size: int = 32,
    backend=None,
) -> dict:
    settings = settings or RagSettings.from_environment()
    if not records:
        return {"indexed": 0, "batches": 0, "mode": settings.mode}
    if batch_size < 1 or batch_size > 128:
        raise ValueError("nutrition batch size must be between 1 and 128")
    backend = backend or _index_backend(settings)
    indexed = 0
    token_count = 0
    batches = 0
    embedder = None if settings.mode == "stub" else build_local_embedder(settings)
    for start in range(0, len(records), batch_size):
        batch = records[start : start + batch_size]
        if settings.mode == "stub":
            indexed += backend.upsert(batch)
        else:
            result = embedder.embed_with_usage([record.search_text for record in batch])
            backend.upsert(batch, result.vectors)
            indexed += len(batch)
            if result.token_count is not None:
                token_count += result.token_count
        batches += 1
    return {
        "indexed": indexed,
        "batches": batches,
        "mode": settings.mode,
        "model": settings.embedding_model,
        "token_count": token_count,
        "collection": getattr(backend, "collection", None),
        "redis_prefix": getattr(backend, "prefix", None),
    }


def _json_match(match: NutritionMatch) -> dict:
    return {
        "nutrition_food_id": match.nutrition_food_id,
        "standard_name": match.standard_name,
        "chinese_name": match.chinese_name,
        "food_form": match.food_form,
        "basis_unit": match.basis_unit,
        "source_name": match.source_name,
        "source_version": match.source_version,
        "catalog_version": match.catalog_version,
        "score": match.score,
        "snippet": match.snippet,
    }


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit("usage: nutrition_catalog_rag.py --index-stdin | --search QUERY")
    command = sys.argv[1]
    if command == "--index-stdin":
        records = _serialize_records(sys.stdin.read())
        print(json.dumps(index_records(records), ensure_ascii=False, sort_keys=True))
        return 0
    if command == "--search":
        if len(sys.argv) != 3:
            raise SystemExit("usage: nutrition_catalog_rag.py --search QUERY")
        result = search_nutrition_catalog(sys.argv[2])
        print(json.dumps([_json_match(item) for item in result], ensure_ascii=False))
        return 0
    raise SystemExit(f"unknown command: {command}")


if __name__ == "__main__":
    main()

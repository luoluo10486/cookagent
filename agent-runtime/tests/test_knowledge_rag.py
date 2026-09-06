import json
from io import BytesIO
import ssl
import urllib.error
from unittest import TestCase
from unittest.mock import MagicMock
from unittest.mock import Mock
from unittest.mock import patch
import zipfile

from knowledge_rag import (DeterministicEmbedder, KnowledgeChunk, MilvusIndex, OpenAICompatibleEmbedder, RagError, RagSettings, RedisStubIndex, StubIndex, build_local_embedder, chunk_markdown, parse_document, safe_object_key)


class _HashPipeline:
    def __init__(self, client):
        self.client = client
        self.operations = []

    def hdel(self, key, field):
        self.operations.append(("hdel", key, field))

    def hset(self, key, field, value):
        self.operations.append(("hset", key, field, value))

    def execute(self):
        for operation in self.operations:
            if operation[0] == "hdel":
                self.client.hashes.setdefault(operation[1], {}).pop(operation[2], None)
            else:
                self.client.hashes.setdefault(operation[1], {})[operation[2]] = operation[3]


class _HashRedis:
    def __init__(self):
        self.hashes = {}

    def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    def pipeline(self):
        return _HashPipeline(self)


class _MilvusClient:
    def __init__(self):
        self.rows = [
            {"embedding_id": "old", "vector": [1.0], "document_id": "d1", "title": "Guide", "version": "v1", "section_path": "old", "text": "old", "tenant_id": 0, "scope": "public_published", "indexed": True, "visibility": "draft", "deleted": False, "current_version": False},
            {"embedding_id": "new", "vector": [1.0], "document_id": "d1", "title": "Guide", "version": "v2", "section_path": "new", "text": "new", "tenant_id": 0, "scope": "public_published", "indexed": True, "visibility": "draft", "deleted": False, "current_version": True},
        ]
        self.filters = []
        self.upserts = []
        self.deletes = []

    def has_collection(self, _collection):
        return True

    def query(self, **kwargs):
        self.filters.append(kwargs["filter"])
        return [dict(row) for row in self.rows if row["version"] == "v1"]

    def upsert(self, **kwargs):
        self.upserts.append(kwargs["data"])

    def delete(self, **kwargs):
        self.deletes.append(kwargs)


class _VectorMilvusClient:
    def __init__(self, dimension=None):
        self.dimension = dimension
        self.created = []
        self.upserts = []
        self.flushed = []

    def has_collection(self, _collection):
        return self.dimension is not None

    def create_collection(self, *args, **kwargs):
        self.dimension = kwargs["dimension"]
        self.created.append((args, kwargs))

    def describe_collection(self, _collection):
        return {"fields": [{"name": "vector", "params": {"dim": self.dimension}}]}

    def upsert(self, **kwargs):
        self.upserts.append(kwargs["data"])

    def flush(self, **kwargs):
        self.flushed.append(kwargs["collection_name"])


class _IdentityMilvusClient(_VectorMilvusClient):
    def __init__(self, fingerprint):
        super().__init__(dimension=2)
        self.rows = [{"embedding_id": "existing", "embedding_fingerprint": fingerprint}]
        self.queries = []

    def query(self, **kwargs):
        self.queries.append(kwargs)
        return [dict(row) for row in self.rows]


class MilvusIndexTests(TestCase):
    def test_visibility_update_is_limited_to_document_version(self):
        index = MilvusIndex.__new__(MilvusIndex)
        index.client = _MilvusClient()
        index.collection = "public_knowledge"

        index.update_visibility("d1", "published", False, True, "v1")

        self.assertEqual(['document_id == "d1" and version == "v1"'], index.client.filters)
        self.assertEqual("published", index.client.upserts[0][0]["visibility"])
        self.assertEqual("v1", index.client.upserts[0][0]["version"])

    def test_upsert_initializes_collection_from_actual_vector_dimension(self):
        settings = RagSettings(
            mode="local",
            embedding_provider="deterministic",
            milvus_uri="http://milvus",
            milvus_collection="public_knowledge",
            deterministic_dimension=12,
        )
        index = MilvusIndex.__new__(MilvusIndex)
        index.client = _VectorMilvusClient()
        index.collection = settings.milvus_collection
        embedder = DeterministicEmbedder(settings)
        chunks = [KnowledgeChunk("emb-1", "d1", "v1", 0, "Guide", "protein recovery")]

        index.upsert("Guide", chunks, embedder.embed([chunks[0].text]))

        self.assertEqual(12, index.client.created[0][1]["dimension"])
        self.assertEqual(12, len(index.client.upserts[0][0]["vector"]))
        self.assertEqual("public_published", index.client.upserts[0][0]["scope"])
        self.assertEqual(["public_knowledge"], index.client.flushed)

    def test_upsert_rejects_existing_collection_dimension_mismatch(self):
        settings = RagSettings(
            mode="local",
            embedding_provider="deterministic",
            milvus_uri="http://milvus",
            milvus_collection="public_knowledge",
            deterministic_dimension=12,
        )
        index = MilvusIndex.__new__(MilvusIndex)
        index.client = _VectorMilvusClient(dimension=8)
        index.collection = settings.milvus_collection

        with self.assertRaisesRegex(RagError, "does not match") as raised:
            index.upsert("Guide", [KnowledgeChunk("emb-1", "d1", "v1", 0, "", "protein")], [[0.1] * 12])

        self.assertEqual("RAG_MILVUS_DIMENSION_MISMATCH", raised.exception.code)

    def test_upsert_rejects_existing_collection_with_different_embedding_identity(self):
        settings = RagSettings(
            mode="local",
            embedding_provider="openai-compatible",
            embedding_profile="bge-m3",
            embedding_model="BAAI/bge-m3",
            milvus_uri="http://milvus",
            milvus_collection="shared_knowledge",
        )
        index = MilvusIndex.__new__(MilvusIndex)
        index.client = _IdentityMilvusClient("rag_different_model")
        index.collection = settings.milvus_collection
        index.index_fingerprint = settings.index_fingerprint

        with self.assertRaisesRegex(RagError, "embedding identity") as raised:
            index.upsert(
                "Guide",
                [KnowledgeChunk("emb-1", "d1", "v1", 0, "", "protein")],
                [[0.1, 0.2]],
            )

        self.assertEqual("RAG_MILVUS_MODEL_MISMATCH", raised.exception.code)

    def test_delete_is_limited_to_document_version(self):
        index = MilvusIndex.__new__(MilvusIndex)
        index.client = _MilvusClient()
        index.collection = "public_knowledge"

        index.delete_document("d1", "v1")

        self.assertEqual(["old"], index.client.deletes[0]["ids"])
        self.assertIn('document_id == "d1" and version == "v1"', index.client.filters)


class RedisStubIndexTests(TestCase):
    def test_search_covers_section_path_and_no_hit(self):
        client = _HashRedis()
        index = RedisStubIndex(client, "test:rag")
        index.upsert(
            "WHO nutrition guide",
            chunk_markdown(
                "# 健康饮食\n\n## 钠摄入\n\n减少钠摄入有助于健康。",
                "d1",
                "v1",
            ),
        )
        index.update_visibility("d1", "published", True, "v1")

        self.assertEqual("d1", index.search("钠摄入")[0].document_id)
        self.assertEqual([], index.search("zzzxqv-abcmnop"))

    def test_reindex_removes_stale_chunks_for_the_same_version(self):
        client = _HashRedis()
        index = RedisStubIndex(client, "test:rag")
        index.upsert("Guide", [
            KnowledgeChunk("old", "d1", "v1", 0, "", "old"),
            KnowledgeChunk("keep", "d1", "v1", 1, "", "keep"),
        ])
        index.upsert("Guide", [KnowledgeChunk("keep", "d1", "v1", 1, "", "keep")])

        values = client.hgetall("test:rag:chunks")
        self.assertEqual(1, len(values))
        self.assertEqual("keep", json.loads(next(iter(values.values())))["text"])

    def test_visibility_update_does_not_touch_another_version(self):
        client = _HashRedis()
        index = RedisStubIndex(client, "test:rag")
        index.upsert("Guide", [KnowledgeChunk("v1", "d1", "v1", 0, "", "old", current_version=False)])
        index.upsert("Guide", [KnowledgeChunk("v2", "d1", "v2", 0, "", "new")])
        index.update_visibility("d1", "published", True, "v1")

        values = {key: json.loads(value) for key, value in client.hgetall("test:rag:chunks").items()}
        self.assertEqual("published", values["v1"]["visibility"])
        self.assertEqual("draft", values["v2"]["visibility"])


class RagSettingsTests(TestCase):
    def test_stub_needs_no_secret_or_milvus(self):
        settings = RagSettings.from_environment(
            {
                "FOODMATE_RAG_MODE": "stub",
                "FOODMATE_RAG_EMBEDDING_PROVIDER": "openai-compatible",
                "FOODMATE_RAG_EMBEDDING_BASE_URL": "https://embedding.example.test/v1",
                "FOODMATE_RAG_EMBEDDING_API_KEY": "must-not-be-retained",
                "FOODMATE_RAG_EMBEDDING_PROFILE": "invalid-paid-profile",
                "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                "FOODMATE_RAG_MILVUS_COLLECTION": "paid_vectors",
            }
        )

        self.assertEqual("stub", settings.mode)
        self.assertEqual("deterministic", settings.embedding_provider)
        self.assertEqual("deterministic-local-v1", settings.embedding_model)
        self.assertEqual("", settings.embedding_base_url)
        self.assertEqual("", settings.embedding_api_key)
        self.assertEqual("", settings.milvus_uri)
        self.assertEqual("", settings.milvus_collection)
        self.assertEqual("", settings.embedding_profile)

    def test_local_fails_closed_when_configuration_is_missing(self):
        with self.assertRaisesRegex(RagError, "incomplete") as raised:
            RagSettings.from_environment({"FOODMATE_RAG_MODE": "local"})
        self.assertEqual("RAG_EMBEDDING_BASE_URL_MISSING", raised.exception.code)

    def test_local_accepts_complete_audited_configuration(self):
        settings = RagSettings.from_environment({
            "FOODMATE_RAG_MODE": "local", "FOODMATE_RAG_EMBEDDING_BASE_URL": "http://embedding/v1",
            "FOODMATE_RAG_EMBEDDING_API_KEY": "test", "FOODMATE_RAG_EMBEDDING_MODEL": "embedding",
            "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530", "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
            "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1", "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "1",
            "FOODMATE_RAG_BATCH_COST_LIMIT": "1", "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
            "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "1", "FOODMATE_RAG_PRICE_VERSION": "test-v1",
        })
        self.assertEqual(4, settings.index_concurrency)

    def test_local_deterministic_provider_needs_no_real_embedding_credentials(self):
        settings = RagSettings.from_environment({
            "FOODMATE_RAG_MODE": "local",
            "FOODMATE_RAG_EMBEDDING_PROVIDER": "deterministic",
            "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
            "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
            "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
            "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
            "FOODMATE_RAG_BATCH_COST_LIMIT": "0",
            "FOODMATE_RAG_DAILY_COST_LIMIT": "0",
            "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "0",
            "FOODMATE_RAG_PRICE_VERSION": "deterministic-v1",
        })

        self.assertEqual("deterministic", settings.embedding_provider)
        self.assertEqual("deterministic-local-v1", settings.embedding_model)
        self.assertIsInstance(build_local_embedder(settings), DeterministicEmbedder)

    def test_local_deterministic_provider_discards_real_embedding_credentials(self):
        settings = RagSettings.from_environment({
            "FOODMATE_RAG_MODE": "local",
            "FOODMATE_RAG_EMBEDDING_PROVIDER": "deterministic",
            "FOODMATE_RAG_EMBEDDING_BASE_URL": "https://embedding.example/v1",
            "FOODMATE_RAG_EMBEDDING_API_KEY": "must-not-be-retained",
            "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
            "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
            "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
            "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
            "FOODMATE_RAG_BATCH_COST_LIMIT": "0",
            "FOODMATE_RAG_DAILY_COST_LIMIT": "0",
            "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "0",
            "FOODMATE_RAG_PRICE_VERSION": "deterministic-v1",
        })

        self.assertEqual("", settings.embedding_base_url)
        self.assertEqual("", settings.embedding_api_key)

    def test_openai_provider_still_fails_closed_without_api_key(self):
        with self.assertRaisesRegex(RagError, "incomplete") as raised:
            RagSettings.from_environment({
                "FOODMATE_RAG_MODE": "local",
                "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
                "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
                "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
                "FOODMATE_RAG_BATCH_COST_LIMIT": "1",
                "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
                "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "1",
                "FOODMATE_RAG_PRICE_VERSION": "test-v1",
            })
        self.assertEqual("RAG_EMBEDDING_BASE_URL_MISSING", raised.exception.code)

    def test_supported_embedding_profiles_resolve_to_their_model(self):
        for profile, model in (
            ("bge-m3", "BAAI/bge-m3"),
            ("qwen3-embedding-0.6b", "Qwen/Qwen3-Embedding-0.6B"),
        ):
            settings = RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "local",
                    "FOODMATE_RAG_EMBEDDING_PROFILE": profile,
                    "FOODMATE_RAG_EMBEDDING_PROVIDER": "openai-compatible",
                    "FOODMATE_RAG_EMBEDDING_BASE_URL": "http://embedding/v1",
                    "FOODMATE_RAG_EMBEDDING_API_KEY": "test",
                    "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                    "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge_" + profile.replace("-", "_").replace(".", "_"),
                    "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1",
                    "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "1",
                    "FOODMATE_RAG_BATCH_COST_LIMIT": "1",
                    "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
                    "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "1",
                    "FOODMATE_RAG_PRICE_VERSION": "test-v1",
                }
            )
            self.assertEqual(profile, settings.embedding_profile)
            self.assertEqual(model, settings.embedding_model)

    def test_embedding_profiles_use_distinct_index_namespaces(self):
        common = {
            "FOODMATE_RAG_MODE": "local",
            "FOODMATE_RAG_EMBEDDING_PROVIDER": "openai-compatible",
            "FOODMATE_RAG_EMBEDDING_BASE_URL": "http://embedding/v1",
            "FOODMATE_RAG_EMBEDDING_API_KEY": "test",
            "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
            "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
            "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1",
            "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "1",
            "FOODMATE_RAG_BATCH_COST_LIMIT": "1",
            "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
            "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "1",
            "FOODMATE_RAG_PRICE_VERSION": "test-v1",
        }
        bge = RagSettings.from_environment(
            {**common, "FOODMATE_RAG_EMBEDDING_PROFILE": "bge-m3"}
        )
        qwen = RagSettings.from_environment(
            {**common, "FOODMATE_RAG_EMBEDDING_PROFILE": "qwen3-embedding-0.6b"}
        )
        self.assertNotEqual(bge.index_namespace, qwen.index_namespace)

    def test_embedding_profile_rejects_a_different_explicit_model(self):
        with self.assertRaisesRegex(RagError, "do not match") as raised:
            RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "local",
                    "FOODMATE_RAG_EMBEDDING_PROFILE": "bge-m3",
                    "FOODMATE_RAG_EMBEDDING_PROVIDER": "openai-compatible",
                    "FOODMATE_RAG_EMBEDDING_BASE_URL": "http://embedding/v1",
                    "FOODMATE_RAG_EMBEDDING_API_KEY": "test",
                    "FOODMATE_RAG_EMBEDDING_MODEL": "Qwen/Qwen3-Embedding-0.6B",
                }
            )
        self.assertEqual("RAG_EMBEDDING_PROFILE_MISMATCH", raised.exception.code)

    def test_local_rejects_milvus_collection_names_unsupported_by_milvus(self):
        with self.assertRaisesRegex(RagError, "collection name") as raised:
            RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "local",
                    "FOODMATE_RAG_EMBEDDING_PROVIDER": "deterministic",
                    "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                    "FOODMATE_RAG_MILVUS_COLLECTION": "knowledge.v1",
                    "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
                    "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
                    "FOODMATE_RAG_BATCH_COST_LIMIT": "0",
                    "FOODMATE_RAG_DAILY_COST_LIMIT": "0",
                    "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "0",
                    "FOODMATE_RAG_PRICE_VERSION": "deterministic-v1",
                }
            )
        self.assertEqual("RAG_MILVUS_COLLECTION_INVALID", raised.exception.code)

    def test_real_profile_requires_openai_compatible_provider(self):
        with self.assertRaisesRegex(RagError, "OpenAI-compatible") as raised:
            RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "local",
                    "FOODMATE_RAG_EMBEDDING_PROVIDER": "deterministic",
                    "FOODMATE_RAG_EMBEDDING_PROFILE": "bge-m3",
                    "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                    "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
                    "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
                    "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
                    "FOODMATE_RAG_BATCH_COST_LIMIT": "0",
                    "FOODMATE_RAG_DAILY_COST_LIMIT": "0",
                    "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "0",
                    "FOODMATE_RAG_PRICE_VERSION": "deterministic-v1",
                }
            )
        self.assertEqual("RAG_EMBEDDING_PROFILE_PROVIDER_MISMATCH", raised.exception.code)

    def test_real_embedding_endpoint_rejects_embedded_credentials_or_query(self):
        base = {
            "FOODMATE_RAG_MODE": "local",
            "FOODMATE_RAG_EMBEDDING_PROVIDER": "openai-compatible",
            "FOODMATE_RAG_EMBEDDING_API_KEY": "test",
            "FOODMATE_RAG_EMBEDDING_MODEL": "BAAI/bge-m3",
            "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
            "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
            "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
            "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
            "FOODMATE_RAG_BATCH_COST_LIMIT": "1",
            "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
            "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "1",
            "FOODMATE_RAG_PRICE_VERSION": "test-v1",
        }
        for endpoint in ("https://user:password@embedding.example/v1", "https://embedding.example/v1?token=secret"):
            with self.subTest(endpoint=endpoint):
                with self.assertRaisesRegex(RagError, "without credentials") as raised:
                    RagSettings.from_environment({**base, "FOODMATE_RAG_EMBEDDING_BASE_URL": endpoint})
                self.assertEqual("RAG_EMBEDDING_BASE_URL_INVALID", raised.exception.code)

    def test_real_embedding_configuration_does_not_reuse_chat_provider_credentials(self):
        with self.assertRaisesRegex(RagError, "incomplete") as raised:
            RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "local",
                    "FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_BASE_URL": "https://chat.example/v1",
                    "FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_API_KEY": "chat-key-must-not-be-used",
                    "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                    "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
                    "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
                    "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
                    "FOODMATE_RAG_BATCH_COST_LIMIT": "1",
                    "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
                    "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "1",
                    "FOODMATE_RAG_PRICE_VERSION": "test-v1",
                }
            )
        self.assertEqual("RAG_EMBEDDING_BASE_URL_MISSING", raised.exception.code)


class OpenAICompatibleEmbedderConfigurationTests(TestCase):
    @staticmethod
    def _response(body):
        response = MagicMock()
        response.read.return_value = body
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        return response

    def _settings(self):
        return RagSettings(
            mode="local",
            embedding_provider="openai-compatible",
            embedding_base_url="https://embedding.example/v1",
            embedding_api_key="test-key",
            embedding_model="BAAI/bge-m3",
        )

    def test_invalid_json_fails_closed(self):
        response = self._response(b"not-json")
        with patch("urllib.request.urlopen", return_value=response):
            with self.assertRaisesRegex(RagError, "invalid embedding response") as raised:
                OpenAICompatibleEmbedder(self._settings()).embed(["hello"])
        self.assertEqual("RAG_EMBEDDING_INVALID_RESPONSE", raised.exception.code)

    def test_non_object_vector_and_mismatched_dimensions_fail_closed(self):
        payloads = (
            {"data": [{"index": 0, "embedding": "not-an-array"}]},
            {"data": [{"index": 0, "embedding": [1.0]}, {"index": 1, "embedding": [1.0, 2.0]}]},
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                response = self._response(json.dumps(payload).encode("utf-8"))
                with patch("urllib.request.urlopen", return_value=response):
                    with self.assertRaises(RagError) as raised:
                        OpenAICompatibleEmbedder(self._settings()).embed(["one", "two"])
                self.assertEqual("RAG_EMBEDDING_INVALID_RESPONSE", raised.exception.code)

    def test_real_profile_rejects_zero_price(self):
        with self.assertRaisesRegex(RagError, "greater than zero") as raised:
            RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "local",
                    "FOODMATE_RAG_EMBEDDING_PROVIDER": "openai-compatible",
                    "FOODMATE_RAG_EMBEDDING_PROFILE": "bge-m3",
                    "FOODMATE_RAG_EMBEDDING_BASE_URL": "https://api.siliconflow.cn/v1",
                    "FOODMATE_RAG_EMBEDDING_API_KEY": "test-key",
                    "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                    "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
                    "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
                    "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
                    "FOODMATE_RAG_BATCH_COST_LIMIT": "1",
                    "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
                    "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "0",
                    "FOODMATE_RAG_PRICE_VERSION": "test-v1",
                }
            )
        self.assertEqual("RAG_PRICE_INVALID", raised.exception.code)

    def test_invalid_timeout_is_a_stable_rag_error(self):
        with self.assertRaisesRegex(RagError, "positive") as raised:
            RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "stub",
                    "FOODMATE_RAG_ITEM_TIMEOUT_SECONDS": "not-a-number",
                }
            )
        self.assertEqual("RAG_ITEM_TIMEOUT_INVALID", raised.exception.code)

    def test_negative_budget_is_rejected(self):
        with self.assertRaisesRegex(RagError, "non-negative") as raised:
            RagSettings.from_environment(
                {
                    "FOODMATE_RAG_MODE": "stub",
                    "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "-1",
                }
            )
        self.assertEqual("RAG_BUDGET_INVALID", raised.exception.code)


class DeterministicEmbedderTests(TestCase):
    def test_vectors_are_stable_non_zero_and_have_configured_dimension(self):
        settings = RagSettings(mode="local", embedding_provider="deterministic", deterministic_dimension=16)
        embedder = DeterministicEmbedder(settings)

        first = embedder.embed(["Protein supports recovery.", "Protein supports recovery."])

        self.assertEqual(first[0], first[1])
        self.assertEqual(16, len(first[0]))
        self.assertGreater(sum(item * item for item in first[0]), 0)

    def test_provider_mismatch_does_not_silently_fallback(self):
        settings = RagSettings(mode="local", embedding_provider="openai-compatible")

        with self.assertRaisesRegex(RagError, "explicit local provider"):
            DeterministicEmbedder(settings)


class OpenAICompatibleEmbedderTests(TestCase):
    class _Response:
        def __init__(self, payload, headers=None):
            self.payload = payload
            self.headers = headers or {}

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps(self.payload).encode("utf-8")

    def _settings(self):
        return RagSettings.from_environment(
            {
                "FOODMATE_RAG_MODE": "local",
                "FOODMATE_RAG_EMBEDDING_PROVIDER": "openai-compatible",
                "FOODMATE_RAG_EMBEDDING_PROFILE": "bge-m3",
                "FOODMATE_RAG_EMBEDDING_BASE_URL": "https://api.siliconflow.cn/v1",
                "FOODMATE_RAG_EMBEDDING_API_KEY": "test-key",
                "FOODMATE_RAG_MILVUS_URI": "http://milvus:19530",
                "FOODMATE_RAG_MILVUS_COLLECTION": "public_knowledge",
                "FOODMATE_RAG_BATCH_TOKEN_LIMIT": "1000",
                "FOODMATE_RAG_DAILY_TOKEN_LIMIT": "10000",
                "FOODMATE_RAG_BATCH_COST_LIMIT": "1",
                "FOODMATE_RAG_DAILY_COST_LIMIT": "1",
                "FOODMATE_RAG_PRICE_PER_MILLION_TOKENS": "1",
                "FOODMATE_RAG_PRICE_VERSION": "test-v1",
            }
        )

    @patch("urllib.request.urlopen")
    def test_sends_siliconflow_openai_embedding_contract(self, urlopen):
        urlopen.return_value = self._Response(
            {
                "data": [
                    {"index": 1, "embedding": [0.0, 1.0]},
                    {"index": 0, "embedding": [1.0, 0.0]},
                ]
            }
        )

        vectors = OpenAICompatibleEmbedder(self._settings()).embed(["first", "second"])

        request = urlopen.call_args.args[0]
        body = json.loads(request.data.decode("utf-8"))
        self.assertEqual("https://api.siliconflow.cn/v1/embeddings", request.full_url)
        self.assertEqual("BAAI/bge-m3", body["model"])
        self.assertEqual(["first", "second"], body["input"])
        self.assertEqual("float", body["encoding_format"])
        self.assertEqual([[1.0, 0.0], [0.0, 1.0]], vectors)
        self.assertEqual("Bearer test-key", request.headers["Authorization"])

    @patch("urllib.request.urlopen")
    def test_reads_provider_usage_and_request_id_without_exposing_input(self, urlopen):
        urlopen.return_value = self._Response(
            {
                "id": "embedding-request-1",
                "data": [{"index": 0, "embedding": [1.0, 0.0]}],
                "usage": {"prompt_tokens": 11, "total_tokens": 11},
            }
        )

        result = OpenAICompatibleEmbedder(self._settings()).embed_with_usage(["first"])

        self.assertEqual([[1.0, 0.0]], result.vectors)
        self.assertEqual(11, result.token_count)
        self.assertEqual("embedding-request-1", result.provider_request_id)

    @patch("urllib.request.urlopen")
    def test_reads_siliconflow_trace_id_from_response_header(self, urlopen):
        urlopen.return_value = self._Response(
            {
                "id": "embedding-request-1",
                "data": [{"index": 0, "embedding": [1.0, 0.0]}],
                "usage": {"prompt_tokens": 11, "total_tokens": 11},
            },
            {"x-siliconcloud-trace-id": "trace-embedding-1"},
        )

        result = OpenAICompatibleEmbedder(self._settings()).embed_with_usage(["first"])

        self.assertEqual("trace-embedding-1", result.provider_trace_id)

    @patch("urllib.request.urlopen")
    def test_rejects_malformed_provider_usage(self, urlopen):
        urlopen.return_value = self._Response(
            {
                "data": [{"index": 0, "embedding": [1.0, 0.0]}],
                "usage": {"prompt_tokens": "11"},
            }
        )

        with self.assertRaisesRegex(RagError, "invalid embedding response") as raised:
            OpenAICompatibleEmbedder(self._settings()).embed_with_usage(["first"])

        self.assertEqual("RAG_EMBEDDING_INVALID_RESPONSE", raised.exception.code)

    @patch("urllib.request.urlopen")
    def test_rejects_non_object_embedding_item(self, urlopen):
        urlopen.return_value = self._Response({"data": ["invalid"]})

        with self.assertRaisesRegex(RagError, "invalid embedding response") as raised:
            OpenAICompatibleEmbedder(self._settings()).embed(["first"])

        self.assertEqual("RAG_EMBEDDING_INVALID_RESPONSE", raised.exception.code)

    @patch("urllib.request.urlopen")
    def test_maps_rate_limit_to_a_stable_provider_code(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(
            "https://api.siliconflow.cn/v1/embeddings", 429, "ignored", {}, None
        )

        with self.assertRaises(RagError) as raised:
            OpenAICompatibleEmbedder(self._settings()).embed(["first"])

        self.assertEqual("RAG_EMBEDDING_RATE_LIMITED", raised.exception.code)

    @patch("urllib.request.urlopen")
    def test_maps_provider_failures_without_retaining_response_body(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(
            "https://api.siliconflow.cn/v1/embeddings", 503, "secret response", {}, None
        )

        with self.assertRaises(RagError) as raised:
            OpenAICompatibleEmbedder(self._settings()).embed(["first"])

        self.assertEqual("RAG_EMBEDDING_UNAVAILABLE", raised.exception.code)
        self.assertNotIn("secret response", str(raised.exception))

    @patch("urllib.request.urlopen")
    def test_maps_authentication_failures_to_a_stable_code(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(
            "https://api.siliconflow.cn/v1/embeddings", 401, "ignored", {}, None
        )

        with self.assertRaises(RagError) as raised:
            OpenAICompatibleEmbedder(self._settings()).embed(["first"])

        self.assertEqual("RAG_EMBEDDING_AUTH_FAILED", raised.exception.code)

    @patch("urllib.request.urlopen")
    def test_maps_tls_handshake_failures_without_disabling_certificate_validation(self, urlopen):
        urlopen.side_effect = urllib.error.URLError(ssl.SSLEOFError("handshake closed"))

        with self.assertRaises(RagError) as raised:
            OpenAICompatibleEmbedder(self._settings()).embed(["first"])

        self.assertEqual("RAG_EMBEDDING_TLS_ERROR", raised.exception.code)
        self.assertNotIn("handshake closed", str(raised.exception))


class StubIndexTests(TestCase):
    def test_chunking_preserves_heading_hierarchy_and_stable_overlap(self):
        text = (
            "# 饮食基础\n\n"
            "## 蛋白质\n\n"
            "蛋白质支持组织维护，豆类、鸡蛋和鱼类都是常见来源。"
            "选择多样食物有助于保持均衡。\n\n"
            "备餐时应关注份量和烹饪方式，优先使用少油方法，并记录实际摄入。\n\n"
            "### 实践建议\n\n"
            "每次备餐都可以先安排蔬菜，再加入蛋白质来源和适量主食。"
        )

        chunks = chunk_markdown(
            text,
            "chunk-1",
            "v1",
            max_chars=100,
            target_chars=60,
            overlap_chars=10,
        )
        repeated = chunk_markdown(
            text,
            "chunk-1",
            "v1",
            max_chars=100,
            target_chars=60,
            overlap_chars=10,
        )

        self.assertGreaterEqual(len(chunks), 3)
        self.assertTrue(all(len(chunk.text) <= 100 for chunk in chunks))
        self.assertEqual(chunks, repeated)
        self.assertIn("饮食基础 > 蛋白质", [chunk.section_path for chunk in chunks])
        self.assertIn("饮食基础 > 蛋白质 > 实践建议", [chunk.section_path for chunk in chunks])
        same_section = [
            chunk
            for index, chunk in enumerate(chunks)
            if index > 0 and chunk.section_path == chunks[index - 1].section_path
        ]
        self.assertTrue(same_section)
        self.assertTrue(any(chunks[index - 1].text[-10:] in chunks[index].text for index in range(1, len(chunks))))

    def test_keyword_search_covers_title_section_and_no_hit(self):
        index = StubIndex()
        index.upsert(
            "WHO 营养指南",
            chunk_markdown(
                "# 健康饮食\n\n## 膳食纤维\n\n蔬菜、豆类和全谷物可以提供膳食纤维。",
                "doc-1",
                "v1",
            ),
        )

        self.assertEqual("doc-1", index.search("膳食纤维")[0].document_id)
        self.assertEqual("doc-1", index.search("WHO")[0].document_id)
        self.assertEqual([], index.search("zzzxqv-abcmnop"))

    def test_fixed_public_query_samples_are_explainable(self):
        index = StubIndex()
        samples = {
            "蛋白质": "doc-protein",
            "钠": "doc-sodium",
            "食品安全": "doc-safety",
            "身体活动": "doc-activity",
            "膳食纤维": "doc-fiber",
        }
        for query, document_id in samples.items():
            index.upsert(
                f"公共{query}指南",
                chunk_markdown(
                    f"# 公共指南\n\n## {query}\n\n本指南介绍{query}的基础建议。",
                    document_id,
                    "v1",
                ),
            )

        for query, document_id in samples.items():
            self.assertEqual(document_id, index.search(query)[0].document_id)
        self.assertEqual([], index.search("zzzxqv-abcmnop"))

    def test_public_filter_citation_limit_and_determinism(self):
        index = StubIndex()
        index.upsert("Nutrition guide", chunk_markdown("# Calories\nProtein and calories are important.\n\nMore protein facts.", "1", "v1", 40))
        citations = index.search("protein calories")
        self.assertLessEqual(len(citations), 2)
        self.assertEqual("Nutrition guide", citations[0].title)
        self.assertFalse(hasattr(citations[0], "storage_key"))

    def test_stub_search_matches_chinese_phrases_without_spaces(self):
        index = StubIndex()
        index.upsert(
            "Public guide",
            chunk_markdown(
                "# 饮食指南\n低盐饮食应查看每份食物的钠含量。",
                "cn-1",
                "v1",
            ),
        )

        citations = index.search("低盐饮食 钠含量")

        self.assertEqual(["cn-1"], [item.document_id for item in citations])

    def test_object_key_cannot_escape_knowledge_namespace(self):
        self.assertEqual("knowledge/1/a.txt", safe_object_key("knowledge/1/a.txt"))
        with self.assertRaisesRegex(RagError, "outside"):
            safe_object_key("knowledge/../secret")

    def test_stub_excludes_non_current_public_chunks(self):
        index = StubIndex()
        index.upsert(
            "Nutrition guide",
            [
                KnowledgeChunk("old", "1", "v1", 0, "", "protein", current_version=False),
                KnowledgeChunk("current", "1", "v2", 0, "", "protein"),
            ],
        )
        citations = index.search("protein")
        self.assertEqual(["current"], [item.chunk_id for item in citations])

    def test_docx_parser_extracts_text_without_executing_relationships(self):
        content = BytesIO()
        with zipfile.ZipFile(content, "w") as archive:
            archive.writestr(
                "word/document.xml",
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Protein guide</w:t></w:r></w:p></w:body></w:document>',
            )
        self.assertEqual("Protein guide", parse_document("guide.docx", content.getvalue()))

    def test_docx_external_relationship_is_rejected(self):
        content = BytesIO()
        with zipfile.ZipFile(content, "w") as archive:
            archive.writestr("word/document.xml", "<document />")
            archive.writestr(
                "word/_rels/document.xml.rels",
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship TargetMode="External" Target="https://example.invalid" /></Relationships>',
            )
        with self.assertRaisesRegex(RagError, "external"):
            parse_document("unsafe.docx", content.getvalue())

    def test_pdf_parser_reads_a_real_pdf_container(self):
        from pypdf import PdfWriter

        output = BytesIO()
        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        writer.write(output)
        self.assertEqual("", parse_document("blank.pdf", output.getvalue()))

    def test_text_parser_rejects_basic_personal_identifiers(self):
        for value in (
            b"Contact alice@example.com for the guide.",
            "联系电话 13812345678。".encode(),
            "身份证 11010519491231002X。".encode(),
        ):
            with self.assertRaisesRegex(RagError, "personal identifier") as raised:
                parse_document("notes.txt", value)
            self.assertEqual("RAG_PII_DETECTED", raised.exception.code)

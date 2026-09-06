"""FoodMate Agent Runtime V1, dependency-free local implementation."""

import json
import logging
import os
import threading
import urllib.error
import urllib.request
import base64
import hashlib
import uuid
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from runtime_env import load_project_env
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
load_project_env()

LOGGER = logging.getLogger("foodmate.agent-runtime")

from agent_core import DeterministicPlanner, DeterministicRouter, InMemoryCheckpoint, run_deterministic, split_answer
from eval.metrics import EvalMetrics, RuntimeMetrics
from model_provider import ModelProviderError, ModelRouter
from sql_planner import SqlPlannerError
from recovery_protocol import checkpoint_digest, validate_recovery_command
from knowledge_rag import MilvusIndex, PUBLIC_SCOPE, RagError, RagSettings, RedisStubIndex, build_local_embedder
from nutrition_catalog_rag import search_nutrition_catalog

JAVA_CALLBACK_URL = os.getenv("JAVA_CALLBACK_URL", "http://localhost:8080")
CONTRACT_VERSION = os.getenv("FOODMATE_CONTRACT_VERSION", "v1")
JWT_ENABLED = os.getenv("FOODMATE_SERVICE_JWT_ENABLED", "true").lower() == "true"
PYTHON_PRIVATE_KEY = os.getenv("FOODMATE_PYTHON_PRIVATE_KEY", "")
PYTHON_KID = os.getenv("FOODMATE_PYTHON_KID", "")
JAVA_PUBLIC_KEY = os.getenv("FOODMATE_JAVA_PUBLIC_KEY", "")
JAVA_PUBLIC_KEYS = os.getenv("FOODMATE_JAVA_PUBLIC_KEYS", "")
JAVA_PUBLIC_KEY_KID = os.getenv("FOODMATE_JAVA_PUBLIC_KEY_KID", "")
STATE_FILE = os.getenv("FOODMATE_RUNTIME_STATE_FILE", "")
_cancelled: set[str] = set()
_dispatches: dict[str, dict] = {}
_lock = threading.Lock()
_event_publisher = None
_proposal_publisher = None
_result_waiters: dict[str, dict] = {}
_result_condition = threading.Condition(_lock)
_eval_metrics = EvalMetrics()
_runtime_metrics = RuntimeMetrics()
_runtime_started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
_mq_runtime = None
_model_router = ModelRouter()
MAX_EVENT_ID_LENGTH = 64
DEFAULT_STREAM_CHUNK_MAX_BYTES = 2048
DEFAULT_STREAM_CHUNK_INTERVAL_MS = 150
MAX_STREAM_CHUNK_INTERVAL_MS = 10000


def _bounded_event_id(event_id: str) -> str:
    """Keep the persisted event identifier within the V1 database contract."""
    if len(event_id) <= MAX_EVENT_ID_LENGTH:
        return event_id
    digest = hashlib.sha256(event_id.encode("utf-8")).hexdigest()[:16]
    prefix_length = MAX_EVENT_ID_LENGTH - len(digest) - 1
    return event_id[:prefix_length] + "-" + digest


def _new_checkpoint():
    # 本地默认内存后端；启用 Redis 时必须同时配置 checkpoint 加密密钥。
    if os.getenv("FOODMATE_AGENT_CHECKPOINT_BACKEND", "inmemory").lower() == "redis":
        from mq_runtime import RedisCheckpoint
        return RedisCheckpoint()
    return InMemoryCheckpoint()


_checkpoint = _new_checkpoint()


def _route_payload(command: dict) -> dict[str, object]:
    """Build the stable route fact before any model or tool call can fail."""
    content = str((command.get("message") or {}).get("content", ""))
    route = DeterministicRouter().route(content)
    plan = DeterministicPlanner().plan(route)
    return {
        "status": "routed",
        "intent": route.intent,
        "complexity": route.complexity,
        "risk_level": route.risk_level,
        "missing_slots": list(route.missing_slots),
        "plan_version": plan.plan_version,
    }


def _record_execution_eval(execution, elapsed_ms: int) -> None:
    _eval_metrics.record(execution.eval.result, execution.eval.reason, elapsed_ms)


def _record_provider_failure(error: ModelProviderError, elapsed_ms: int) -> None:
    """Count a failed composer or Judge call without retaining provider prompts or answers."""
    reason = (
        "EVAL_PROVIDER_UNAVAILABLE"
        if any(attempt.scene == "eval" for attempt in error.attempts)
        else error.code
    )
    _eval_metrics.record("degrade", reason, elapsed_ms)


def _record_model_attempts(attempts, transport: str | None = None) -> None:
    """将模型调用写入固定标签的运行统计，不保留动态供应商标识。"""
    for attempt in attempts:
        result = "success" if attempt.status == "success" else "timeout" if attempt.status == "timeout" else "failed"
        _runtime_metrics.record_model_attempt(
            attempt.scene,
            result,
            attempt.error_code,
            attempt.latency_ms,
            transport,
        )


def _context_source_payload(context) -> dict[str, object]:
    """Expose source identifiers only; context text remains Java-authorized data."""
    source_ids: dict[str, list[str]] = {}
    for source_type in ("message_id", "summary_id", "memory_id", "citation_id"):
        source_ids[source_type] = [
            str(value)[:128]
            for value in context.sources.get(source_type, ())
            if str(value).strip()
        ][:16]
    return {"source_ids": source_ids}


def _eval_payload(execution) -> dict[str, object]:
    """Expose the quality-gate fact without retaining the candidate answer or prompt."""
    return {
        "result": execution.eval.result,
        "reason": execution.eval.reason,
        "score": getattr(execution.eval, "score", None),
        "evaluator_version": getattr(execution.eval, "evaluator_version", "deterministic-eval-v1"),
    }


def _stream_chunk_interval_ms() -> int:
    """读取回答事件间隔，避免把回答按模型 token 逐条发送到消息总线。"""
    raw_value = os.getenv(
        "FOODMATE_AGENT_STREAM_CHUNK_INTERVAL_MS",
        str(DEFAULT_STREAM_CHUNK_INTERVAL_MS),
    ).strip()
    try:
        interval_ms = int(raw_value)
    except ValueError as error:
        raise RuntimeError("RUNTIME_STREAM_CONFIG_INVALID") from error
    if interval_ms < 0 or interval_ms > MAX_STREAM_CHUNK_INTERVAL_MS:
        raise RuntimeError("RUNTIME_STREAM_CONFIG_INVALID")
    return interval_ms


def _emit_answer_chunks(command: dict, prefix: str, next_sequence: int, answer: str) -> int:
    """按字节上限和可配置时间间隔发布回答分片。"""
    max_bytes = int(
        os.getenv(
            "FOODMATE_AGENT_STREAM_CHUNK_MAX_BYTES",
            str(DEFAULT_STREAM_CHUNK_MAX_BYTES),
        )
    )
    chunks = split_answer(answer, max_bytes)
    interval_seconds = _stream_chunk_interval_ms() / 1000
    for index, chunk in enumerate(chunks, start=1):
        emit(
            command,
            prefix + f"-answer-{index}",
            next_sequence,
            "run.answer_stream",
            {"text": chunk, "status": "evaluated"},
        )
        next_sequence += 1
        if index < len(chunks) and interval_seconds > 0:
            time.sleep(interval_seconds)
    return next_sequence


def _redis_client():
    candidates = [
        getattr(_checkpoint, "client", None),
        getattr(getattr(_event_publisher, "outbox", None), "client", None),
        getattr(getattr(_mq_runtime, "inbox", None), "client", None),
    ]
    return next((client for client in candidates if client is not None), None)


def _readiness() -> tuple[int, dict[str, object]]:
    backend = os.getenv("FOODMATE_AGENT_CHECKPOINT_BACKEND", "inmemory").lower()
    transport = os.getenv("FOODMATE_AGENT_TRANSPORT", "http").lower()
    problems: list[str] = []
    rag_settings = None
    try:
        rag_settings = RagSettings.from_environment()
        rag_dependency = _rag_readiness_payload(rag_settings)
    except RagError as error:
        rag_dependency = {
            "status": "unavailable",
            "error_code": error.code,
        }
        problems.append("rag")
    dependencies: dict[str, object] = {
        "checkpoint_backend": {"name": backend, "status": "ready"},
        "redis": {"status": "disabled"},
        "rag": rag_dependency,
        "rocketmq_event_producer": {"status": "disabled"},
        "rocketmq_proposal_producer": {"status": "disabled"},
        "rocketmq_command_consumer": {"status": "disabled"},
        "rocketmq_result_consumer": {"status": "disabled"},
    }
    needs_redis = (
        backend == "redis"
        or transport == "rocketmq"
        or (rag_settings is not None and rag_settings.mode == "stub")
    )
    if needs_redis:
        client = _redis_client()
        try:
            if client is None:
                raise RuntimeError("redis client missing")
            client.ping()
            dependencies["redis"] = {"status": "ready"}
        except Exception:
            dependencies["redis"] = {"status": "unavailable"}
            problems.append("redis")

    if transport == "rocketmq":
        event_ready = _event_publisher is not None and getattr(_event_publisher, "producer", None) is not None
        proposal_ready = _proposal_publisher is not None and getattr(_proposal_publisher, "producer", None) is not None
        consumer_ready = _mq_runtime is not None and _mq_runtime.healthy
        result_ready = consumer_ready and getattr(_mq_runtime, "result_consumer", None) is not None
        dependencies["rocketmq_event_producer"] = {"status": "ready" if event_ready else "unavailable"}
        dependencies["rocketmq_proposal_producer"] = {"status": "ready" if proposal_ready else "unavailable"}
        dependencies["rocketmq_command_consumer"] = {"status": "ready" if consumer_ready else "unavailable"}
        dependencies["rocketmq_result_consumer"] = {"status": "ready" if result_ready else "unavailable"}
        for name, ready in (
            ("rocketmq_event_producer", event_ready),
            ("rocketmq_proposal_producer", proposal_ready),
            ("rocketmq_command_consumer", consumer_ready),
            ("rocketmq_result_consumer", result_ready),
        ):
            if not ready:
                problems.append(name)

    _runtime_metrics.queue_depth("active_dispatches", len(_dispatches))
    _runtime_metrics.queue_depth("result_waiters", len(_result_waiters))
    payload: dict[str, object] = {
        "status": "UP" if not problems else "DOWN",
        "contract_version": CONTRACT_VERSION,
        "transport": transport,
        "started_at": _runtime_started_at,
        "dependencies": dependencies,
        "eval": _eval_metrics.snapshot(),
        "runtime": _runtime_metrics.snapshot(),
    }
    if problems:
        payload["code"] = "RUNTIME_COORDINATION_UNAVAILABLE"
        payload["unavailable_dependencies"] = problems
        return 503, payload
    return 200, payload


def _rag_readiness_payload(settings: RagSettings) -> dict[str, object]:
    """Expose the effective RAG route without exposing credentials or source data."""
    payload: dict[str, object] = {
        "status": "ready",
        "mode": settings.mode,
        "backend": "redis" if settings.mode == "stub" else "milvus",
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
    }
    if settings.embedding_profile:
        payload["embedding_profile"] = settings.embedding_profile
    if settings.mode == "local":
        payload["milvus_collection"] = settings.milvus_collection
    return payload


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")


def _digest(value):
    import hashlib
    return "sha256:" + hashlib.sha256(_canonical(value)).hexdigest()


def _headers(scope="agent:event"):
    headers = {"Content-Type": "application/json", "X-Contract-Version": CONTRACT_VERSION}
    if JWT_ENABLED:
        headers["Authorization"] = "Bearer " + _sign("foodmate-agent-runtime", "foodmate-control-plane", scope)
    return headers


def _notify_java_runtime_recovered():
    """Notify Java after MQ startup; Java still decides which stale Runs are recoverable."""
    if os.getenv("FOODMATE_AGENT_TRANSPORT", "http").lower() != "rocketmq":
        return
    body = json.dumps({
        "schema_version": CONTRACT_VERSION,
        "runtime_instance_id": os.getenv("HOSTNAME", "python-runtime") + "-" + uuid.uuid4().hex,
        "started_at": _runtime_started_at,
    }).encode("utf-8")
    try:
        request = urllib.request.Request(
            JAVA_CALLBACK_URL.rstrip("/") + "/foodmate/internal/v1/runtime/recovered",
            data=body,
            headers=_headers("runtime:recovery"),
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5):
            pass
    except Exception as error:
        # Startup must remain available when Java is temporarily restarting; the next startup
        # notification or the scheduled Java scan will retry the reconciliation.
        LOGGER.warning(
            "runtime recovery notification unavailable error_type=%s",
            type(error).__name__,
        )


def _b64(value):
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _sign(issuer, audience, scope):
    if not PYTHON_PRIVATE_KEY or not PYTHON_KID:
        raise ValueError("Python service JWT signing key is not configured")
    now = int(datetime.now(timezone.utc).timestamp())
    header = _b64(json.dumps({"alg": "EdDSA", "typ": "JWT", "kid": PYTHON_KID}, separators=(",", ":")).encode())
    payload = _b64(json.dumps({"iss": issuer, "sub": issuer, "aud": audience, "scope": scope, "iat": now, "exp": now + 60, "jti": str(uuid.uuid4())}, separators=(",", ":")).encode())
    unsigned = f"{header}.{payload}".encode("ascii")
    key = serialization.load_der_private_key(base64.b64decode(PYTHON_PRIVATE_KEY), password=None)
    return unsigned.decode("ascii") + "." + _b64(key.sign(unsigned))


def _verify(token, issuer, audience, scope):
    if not JWT_ENABLED:
        return True
    public_keys = _public_key_ring()
    if not public_keys:
        return False
    try:
        header, payload, signature = token.split(".")
        header_json = json.loads(_decode(header))
        claims = json.loads(_decode(payload))
        kid = header_json.get("kid")
        if header_json.get("alg") != "EdDSA" or header_json.get("typ") != "JWT" or not kid:
            return False
        key_value = public_keys.get(kid) or public_keys.get("*")
        if not key_value:
            return False
        key = serialization.load_der_public_key(base64.b64decode(key_value))
        key.verify(_decode(signature), f"{header}.{payload}".encode("ascii"))
        return claims.get("iss") == issuer and claims.get("aud") == audience and scope in claims.get("scope", "").split() and claims.get("exp", 0) > int(datetime.now(timezone.utc).timestamp()) and bool(claims.get("jti"))
    except Exception:
        return False


def _public_key_ring() -> dict[str, str]:
    """Load the Java verification key ring, retaining legacy single-key support."""
    entries = JAVA_PUBLIC_KEYS.strip()
    result: dict[str, str] = {}
    if entries:
        for entry in entries.replace(";", ",").split(","):
            value = entry.strip()
            if "=" not in value:
                return {}
            kid, key = value.split("=", 1)
            kid, key = kid.strip(), key.strip()
            if not kid or not key or kid in result:
                return {}
            result[kid] = key
        return result
    if JAVA_PUBLIC_KEY.strip():
        result[JAVA_PUBLIC_KEY_KID.strip() or "*"] = JAVA_PUBLIC_KEY.strip()
    return result


def emit(command, event_id, sequence, event_type, payload=None):
    # Runtime 只回传协议事件，不直接写 FoodMate 业务表；状态投影由 Java 完成。
    event_id = _bounded_event_id(event_id)
    request_id = "req_evt_" + uuid.uuid4().hex
    occurred_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    stable = {
        "schema_version": CONTRACT_VERSION,
        "run_id": command["run_id"],
        "dispatch_id": command["dispatch_id"],
        "attempt": command["attempt"],
        "event_id": event_id,
        "event_seq": sequence,
        "occurred_at": occurred_at,
        "event_type": event_type,
        "payload": payload or {},
    }
    body = json.dumps({
        "schema_version": CONTRACT_VERSION,
        "event_id": event_id,
        "run_id": command["run_id"],
        "dispatch_id": command["dispatch_id"],
        "attempt": command["attempt"],
        "event_seq": sequence,
        "request_id": request_id,
        "trace_id": command.get("trace_id", "trace_stub"),
        "request_hash": _digest(stable),
        "occurred_at": occurred_at,
        "event_type": event_type,
        "payload": payload or {},
    }).encode("utf-8")
    if _event_publisher is not None:
        _event_publisher.publish(json.loads(body.decode("utf-8")))
        _runtime_metrics.record("event", "success", "rocketmq")
        return
    request = urllib.request.Request(
        JAVA_CALLBACK_URL.rstrip("/") + "/foodmate/internal/v1/agent-events",
        data=body,
        headers=_headers(),
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10):
        pass
    _runtime_metrics.record("event", "success", "http")


def _on_result(result: dict):
    """只按 proposal_id 暂存一次结果，真正的业务幂等由 Redis Result Inbox 保证。"""
    proposal_id = str(result.get("proposal_id", ""))
    if not proposal_id:
        return
    with _result_condition:
        _result_waiters[proposal_id] = result
        _result_condition.notify_all()
    _runtime_metrics.record("result", str(result.get("status", "success")), "received")


def _await_result(proposal_id: str, timeout_seconds: float) -> dict:
    end = datetime.now(timezone.utc).timestamp() + timeout_seconds
    with _result_condition:
        while proposal_id not in _result_waiters:
            remaining = end - datetime.now(timezone.utc).timestamp()
            if remaining <= 0:
                raise TimeoutError("TOOL_RESULT_TIMEOUT")
            _result_condition.wait(remaining)
        return _result_waiters.pop(proposal_id)


def _enrich_tool_result(result: dict, proposal: dict) -> dict:
    """Attach only proposal metadata needed by the follow-up Composer."""
    enriched = dict(result)
    tool_name = str(proposal.get("tool_name") or "")
    if tool_name and not enriched.get("tool_name"):
        enriched["tool_name"] = tool_name
    if tool_name == "database_query":
        raw_plan = proposal.get("input") or {}
        enriched["query_plan"] = {
            "intent": raw_plan.get("intent"),
            "time_range": raw_plan.get("time_range"),
            "metrics": list(raw_plan.get("metrics") or ()),
            "dimensions": list(raw_plan.get("dimensions") or ()),
            "filters": dict(raw_plan.get("filters") or {}),
        }
    if tool_name == "plan_validator":
        raw_input = proposal.get("input") or {}
        if isinstance(raw_input.get("plan"), dict):
            enriched["plan"] = raw_input["plan"]
    return enriched


def _save_tool_wait_checkpoint(
    command: dict, proposals: list[dict], completed_invocation_ids: list[str] | None = None
) -> dict[str, object]:
    """Persist the only resumable boundary before a Java-owned tool invocation."""
    budget = ((command.get("runtime_options") or {}).get("budget_snapshot") or command.get("budget_snapshot") or {})
    checkpoint = {
        "schema_version": "v1",
        "workflow_version": "foodmate-m1-4-v1",
        "prompt_version": str((command.get("runtime_options") or {}).get("prompt_set_version", "")),
        "run_id": str(command["run_id"]),
        "dispatch_id": str(command["dispatch_id"]),
        "attempt": int(command["attempt"]),
        "current_node": "tool_wait",
        "deadline_at": command["deadline_at"],
        "budget_revision": int(budget.get("revision", 1)),
        "completed_invocation_ids": list(completed_invocation_ids or []),
        "pending_proposals": proposals,
        "event_seq": 1,
    }
    version = _checkpoint.save(f"{command['run_id']}:{command['dispatch_id']}", checkpoint)
    # Keep the event-referenced boundary immutable even when the live technical
    # checkpoint advances after a Java Tool Result is applied.
    _checkpoint.save(f"{command['run_id']}:{command['dispatch_id']}:recovery", checkpoint)
    return _checkpoint_event_payload(
        checkpoint,
        version,
        [str(item.get("invocation_id")) for item in proposals if item.get("invocation_id")],
    )


def _mark_tool_results_applied(command: dict, results: list[dict]) -> None:
    """Advance the resumable checkpoint before the follow-up Composer call."""
    key = f"{command['run_id']}:{command['dispatch_id']}"
    loaded = _checkpoint.load(key)
    if loaded is None:
        raise RuntimeError("CHECKPOINT_NOT_FOUND")
    version, checkpoint = loaded
    checkpoint = dict(checkpoint)
    checkpoint["current_node"] = "execution"
    checkpoint["completed_invocation_ids"] = sorted(
        {str(item["invocation_id"]) for item in results if item.get("invocation_id")}
    )
    checkpoint["pending_proposals"] = []
    checkpoint["event_seq"] = 2
    _checkpoint.save(key, checkpoint, version)


def _save_clarification_checkpoint(command: dict) -> dict[str, object]:
    """Persist a small, deterministic boundary that Java can reconcile and resume."""
    options = command.get("runtime_options") or {}
    budget = options.get("budget_snapshot") or command.get("budget_snapshot") or {}
    checkpoint = {
        "schema_version": "v1",
        "workflow_version": "foodmate-m1-4-v1",
        "prompt_version": str(options.get("prompt_set_version", "")),
        "run_id": str(command["run_id"]),
        "dispatch_id": str(command["dispatch_id"]),
        "attempt": int(command["attempt"]),
        "current_node": "execution",
        "deadline_at": command["deadline_at"],
        "budget_revision": int(budget.get("revision", 1)),
        "completed_invocation_ids": [],
        "pending_proposals": [],
        "event_seq": 2,
    }
    version = _checkpoint.save(f"{command['run_id']}:{command['dispatch_id']}", checkpoint)
    return _checkpoint_event_payload(checkpoint, version, [])


def _checkpoint_event_payload(
    checkpoint: dict[str, object], version: int, pending_invocation_ids: list[str]
) -> dict[str, object]:
    """Expose only reconciliation metadata; proposal inputs remain in the checkpoint store."""
    return {
        "checkpoint_version": version,
        "checkpoint_digest": checkpoint_digest(checkpoint),
        "workflow_version": checkpoint.get("workflow_version"),
        "prompt_version": checkpoint.get("prompt_version"),
        "current_node": checkpoint.get("current_node"),
        "budget_revision": checkpoint.get("budget_revision"),
        "completed_invocation_ids": checkpoint.get("completed_invocation_ids", []),
        "pending_invocation_ids": pending_invocation_ids,
    }


def execute(command):
    prefix = command["dispatch_id"]
    started = time.monotonic()
    next_sequence = 3
    try:
        emit(command, prefix + "-accepted", 1, "run.accepted", {"status": "queued"})
        if command["run_id"] in _cancelled:
            emit(command, prefix + "-cancel-ack", 2, "run.cancel_acknowledged", {"reason": "user_requested"})
            emit(command, prefix + "-cancelled", 3, "run.cancelled", {"reason": "user_requested"})
            return
        # Java requires contiguous event_seq. Publish the route fact before
        # recovery, tools, and model calls so failures cannot create a gap.
        emit(command, prefix + "-routed", 2, "run.routed", _route_payload(command))
        command = _attach_public_citations(command)
        recovered = validate_recovery_command(command, _checkpoint)
        if recovered is not None:
            authorized = dict(command.get("authorized_context") or {})
            completed_results = (command.get("recovery_context") or {}).get("completed_tool_results") or []
            if completed_results:
                authorized["tool_results"] = completed_results
            command = dict(command)
            command["authorized_context"] = authorized
        execution_command = dict(command)
        execution_command["_checkpoint_key"] = (
            str(command["run_id"]) + ":" + str(command["dispatch_id"]) + ":state"
        )

        def observe_context(context) -> None:
            nonlocal next_sequence
            emit(
                command,
                prefix + f"-context-{next_sequence}",
                next_sequence,
                "run.context_assembled",
                _context_source_payload(context),
            )
            next_sequence += 1

        execution_command["_context_observer"] = observe_context
        execution = run_deterministic(
            execution_command, _checkpoint, model_router=_model_router
        )
        all_results: list[dict] = []
        while execution.proposals:
            if _proposal_publisher is None:
                raise RuntimeError("TOOL_RUNTIME_UNAVAILABLE")
            checkpoint_payload = _save_tool_wait_checkpoint(
                command,
                execution.proposals,
                [
                    str(item["invocation_id"])
                    for item in all_results
                    if item.get("invocation_id")
                ],
            )
            emit(
                command,
                prefix + "-checkpoint-" + str(next_sequence),
                next_sequence,
                "run.checkpoint_saved",
                checkpoint_payload,
            )
            next_sequence += 1
            # 仅用于本地故障演练：暂停点让测试可以在 checkpoint 已落 Redis、Tool 尚未发送前终止进程。
            # 默认 0，不改变生产路径，也不把测试状态写入业务协议。
            pause_after_checkpoint = float(os.getenv("FOODMATE_TEST_PAUSE_AFTER_CHECKPOINT_SECONDS", "0"))
            if pause_after_checkpoint > 0:
                time.sleep(pause_after_checkpoint)
            results = []
            for proposal in execution.proposals:
                # Tool 的开始/结束事实和 checkpoint 同属运行轨迹，保证 Java 能看见
                # Python 等待外部 Tool 的边界；事件只携带标识和结果状态，不回传 SQL 原文。
                emit(command, prefix + "-tool-started-" + str(proposal["proposal_id"]), next_sequence,
                     "run.tool_started", {
                         "proposal_id": proposal["proposal_id"],
                         "invocation_id": proposal.get("payload", {}).get("invocation_id"),
                         "tool_type": proposal.get("proposal_type"),
                     })
                next_sequence += 1
                _proposal_publisher.publish(proposal)
                result = _await_result(
                    proposal["proposal_id"],
                    float(os.getenv("FOODMATE_AGENT_TOOL_RESULT_TIMEOUT_SECONDS", "30")),
                )
                result = _enrich_tool_result(result, proposal)
                results.append(result)
                emit(command, prefix + "-tool-finished-" + str(proposal["proposal_id"]), next_sequence,
                     "run.tool_finished", {
                         "proposal_id": proposal["proposal_id"],
                         "invocation_id": proposal.get("payload", {}).get("invocation_id"),
                         "status": result.get("status"),
                         "error_code": result.get("error_code"),
                     })
                next_sequence += 1
            all_results.extend(results)
            approval_result = next(
                (
                    item
                    for item in results
                    if item.get("tool_name") in {"food_log_writer", "meal_plan.save_plan"}
                    and item.get("status") == "confirmation_required"
                    and item.get("confirmation_ref")
                ),
                None,
            )
            if approval_result is not None:
                checkpoint_payload = _save_clarification_checkpoint(command)
                checkpoint_payload["approval_request_id"] = approval_result["confirmation_ref"]
                emit(
                    command,
                    prefix + "-approval-checkpoint",
                    next_sequence,
                    "run.checkpoint_saved",
                    checkpoint_payload,
                )
                next_sequence += 1
                _record_model_attempts(execution.model_attempts)
                for index, attempt in enumerate(execution.model_attempts, start=1):
                    emit(
                        command,
                        prefix + f"-model-{index}",
                        next_sequence,
                        "run.model_usage",
                        attempt.event_payload(),
                    )
                    next_sequence += 1
                emit(
                    command,
                    prefix + "-approval-eval",
                    next_sequence,
                    "run.eval_decided",
                    _eval_payload(execution),
                )
                next_sequence += 1
                tool_name = str(approval_result.get("tool_name") or "")
                is_meal_plan = tool_name == "meal_plan.save_plan"
                safe_details = (approval_result.get("rows") or [{}])[0]
                emit(
                    command,
                    prefix + "-approval-required",
                    next_sequence,
                    "run.clarification_requested",
                    {
                        "reason": "TOOL_CONFIRMATION_REQUIRED",
                        "tool_name": tool_name,
                        "approval_request_id": approval_result["confirmation_ref"],
                        "operation": "save_plan" if is_meal_plan else "create",
                        "resource_type": "meal_plan" if is_meal_plan else "food_log",
                        "details": safe_details,
                    },
                )
                return
            _mark_tool_results_applied(command, all_results)
            resumed = dict(command)
            resumed["_checkpoint_key"] = (
                str(command["run_id"]) + ":" + str(command["dispatch_id"]) + ":state"
            )
            authorized = dict(resumed.get("authorized_context") or {})
            authorized["tool_results"] = all_results
            query_result = next(
                (
                    item
                    for item in reversed(all_results)
                    if item.get("tool_name") == "database_query"
                ),
                None,
            )
            if query_result and query_result.get("query_plan"):
                authorized["database_query_plan"] = query_result["query_plan"]
            resumed["authorized_context"] = authorized
            resumed["_context_observer"] = observe_context
            follow_up = run_deterministic(
                resumed, _checkpoint, model_router=_model_router
            )
            follow_up.model_attempts = execution.model_attempts + follow_up.model_attempts
            follow_up.usage.tokens += execution.usage.tokens
            follow_up.usage.cost_cny += execution.usage.cost_cny
            follow_up.usage.model_calls += execution.usage.model_calls
            execution = follow_up
        missing_slots = tuple(getattr(execution.route, "missing_slots", ()))
        if missing_slots:
            _record_execution_eval(execution, int((time.monotonic() - started) * 1000))
            checkpoint_payload = _save_clarification_checkpoint(command)
            emit(command, prefix + "-checkpoint", next_sequence, "run.checkpoint_saved", checkpoint_payload)
            next_sequence += 1
            emit(command, prefix + "-eval", next_sequence, "run.eval_decided", _eval_payload(execution))
            next_sequence += 1
            emit(command, prefix + "-clarification", next_sequence, "run.clarification_requested", {
                "missing_slots": list(missing_slots),
                "reason": "REQUIRED_PARAMETER_MISSING",
            })
            return
        _record_model_attempts(execution.model_attempts)
        for index, attempt in enumerate(execution.model_attempts, start=1):
            emit(command, prefix + f"-model-{index}", next_sequence, "run.model_usage", attempt.event_payload())
            next_sequence += 1
        emit(command, prefix + "-eval", next_sequence, "run.eval_decided", _eval_payload(execution))
        next_sequence += 1
        if command["run_id"] in _cancelled:
            emit(command, prefix + "-cancel-ack", next_sequence, "run.cancel_acknowledged", {"reason": "user_requested"})
            emit(command, prefix + "-cancelled", next_sequence + 1, "run.cancelled", {"reason": "user_requested"})
            return
        answer = execution.answer
        if execution.eval.result == "pass":
            next_sequence = _emit_answer_chunks(command, prefix, next_sequence, answer)
        if command["run_id"] in _cancelled:
            emit(command, prefix + "-cancel-ack", next_sequence, "run.cancel_acknowledged", {"reason": "user_requested"})
            emit(command, prefix + "-cancelled", next_sequence + 1, "run.cancelled", {"reason": "user_requested"})
            return
        emit(command, prefix + "-completed", next_sequence, "run.completed", {
            "answer": answer, "status": "completed", "eval_result": execution.eval.result,
            "eval_reason": execution.eval.reason, "budget_mode": execution.budget_mode,
            "eval_score": getattr(execution.eval, "score", None),
            "evaluator_version": getattr(execution.eval, "evaluator_version", "deterministic-eval-v1"),
            "result_type": "normal" if execution.eval.result == "pass" else "safety_degraded",
            "requires_confirmation": bool(execution.budget_actions.get("requires_confirmation", False)),
            "budget_actions": execution.budget_actions,
            "workflow": execution.workflow,
            "usage": execution.usage.__dict__, "memory_candidates": execution.memory_candidates,
            "proposals": execution.proposals,
            "citations": (command.get("authorized_context") or {}).get("citations", []),
        })
        _record_execution_eval(execution, int((time.monotonic() - started) * 1000))
        _runtime_metrics.record("dispatch", "success", "completed", int((time.monotonic() - started) * 1000))
    except SqlPlannerError as error:
        # SQL 规划属于受控业务错误，保留具体错误码和已发生的模型 attempt，
        # 让 Java 能区分配置、供应商和候选计划校验失败。
        _record_model_attempts(error.attempts)
        for index, attempt in enumerate(error.attempts, start=1):
            emit(
                command,
                prefix + f"-model-{index}",
                next_sequence,
                "run.model_usage",
                attempt.event_payload(),
            )
            next_sequence += 1
        _record_provider_failure(error, int((time.monotonic() - started) * 1000))
        emit(
            command,
            prefix + "-failed",
            next_sequence,
            "run.failed",
            {"code": error.code, "retryable": error.retryable},
        )
        _runtime_metrics.record("dispatch", "failed", error.code, int((time.monotonic() - started) * 1000))
    except ModelProviderError as error:
        # 模型失败也必须回到 Java 状态机，不能由 Runtime 静默吞掉。
        _record_model_attempts(error.attempts)
        for index, attempt in enumerate(error.attempts, start=1):
            emit(command, prefix + f"-model-{index}", next_sequence, "run.model_usage", attempt.event_payload())
            next_sequence += 1
        _record_provider_failure(error, int((time.monotonic() - started) * 1000))
        emit(command, prefix + "-failed", next_sequence, "run.failed", {"code": error.code, "retryable": error.retryable})
        _runtime_metrics.record("dispatch", "failed", error.code, int((time.monotonic() - started) * 1000))
    except TimeoutError as error:
        emit(command, prefix + "-failed", next_sequence, "run.failed", {"code": str(error), "retryable": True})
        _runtime_metrics.record("dispatch", "failed", "timeout", int((time.monotonic() - started) * 1000))
    except urllib.error.URLError:
        # 超时和重试由 Java 控制面负责，Runtime 不直接写业务状态。
        return
    except Exception as error:
        # 未预期异常也必须留下终态事件，避免 Java/前端永久停在 routed。
        # 只记录稳定错误类型，不把异常文本、Prompt 或业务载荷写入日志。
        LOGGER.error(
            "runtime execution failed run_id=%s error_type=%s",
            command.get("run_id"),
            type(error).__name__,
        )
        try:
            emit(command, prefix + "-failed", next_sequence, "run.failed", {"code": "RUNTIME_EXECUTION_FAILED", "retryable": False})
            _runtime_metrics.record("dispatch", "failed", "execution_error", int((time.monotonic() - started) * 1000))
        except Exception:
            LOGGER.error("runtime failure event emission failed error_type=%s", type(error).__name__)


def _attach_public_citations(command: dict) -> dict:
    """The fixed Java-authorized scope cannot be widened by a client or model."""
    authorized = dict(command.get("authorized_context") or {})
    if authorized.get("knowledge_scope") != PUBLIC_SCOPE:
        authorized["citations"] = []
    else:
        try:
            query = str((command.get("message") or {}).get("content", ""))
            authorized["citations"] = _citation_payload(_search_public_knowledge(query))
        except (RagError, RuntimeError):
            authorized["citations"] = []
    copy = dict(command); copy["authorized_context"] = authorized
    return copy


def _search_public_knowledge(query: str):
    """Search only the Java-authorized public scope in the configured backend."""
    settings = RagSettings.from_environment()
    return (
        RedisStubIndex().search(query, PUBLIC_SCOPE)
        if settings.mode == "stub"
        else MilvusIndex(settings).search(
            query, build_local_embedder(settings), PUBLIC_SCOPE
        )
    )


def _citation_payload(citations) -> list[dict[str, str]]:
    return [
        {
            "citation_id": item.chunk_id,
            "document_id": item.document_id,
            "title": item.title,
            "version": item.version,
            "section_path": item.section_path,
            "snippet": item.snippet,
        }
        for item in citations
    ]


def _nutrition_match_payload(matches) -> list[dict[str, object]]:
    return [
        {
            "nutrition_food_id": item.nutrition_food_id,
            "standard_name": item.standard_name,
            "chinese_name": item.chinese_name,
            "food_form": item.food_form,
            "basis_unit": item.basis_unit,
            "source_name": item.source_name,
            "source_version": item.source_version,
            "catalog_version": item.catalog_version,
            "score": item.score,
            "snippet": item.snippet,
        }
        for item in matches
    ]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/foodmate/internal/metrics":
            if not self._authenticated():
                self._json(401, {"code": "RUNTIME_AUTH_INVALID"})
                return
            self._json(
                200,
                {
                    "contract_version": CONTRACT_VERSION,
                    "started_at": _runtime_started_at,
                    "eval": _eval_metrics.snapshot(),
                    "runtime": _runtime_metrics.snapshot(),
                },
            )
            return
        if self.path not in {"/foodmate/internal/health/live", "/foodmate/internal/health/ready"}:
            self.send_error(404)
            return
        if self.path.endswith("/ready"):
            status, payload = _readiness()
            self._json(status, payload)
            return
        self._json(200, {"status": "UP", "contract_version": CONTRACT_VERSION})

    def do_POST(self):
        is_dispatch = self.path == "/foodmate/internal/v1/runs"
        is_cancel = self.path.startswith("/foodmate/internal/v1/runs/") and self.path.endswith("/cancel")
        is_knowledge_search = self.path == "/foodmate/internal/v1/knowledge/search"
        is_nutrition_search = self.path == "/foodmate/internal/v1/nutrition/search"
        if not is_dispatch and not is_cancel and not is_knowledge_search and not is_nutrition_search:
            self.send_error(404)
            return
        if not self._authenticated() or self.headers.get("X-Contract-Version", CONTRACT_VERSION) != CONTRACT_VERSION:
            self._json(401, {"code": "RUNTIME_AUTH_INVALID"})
            return
        try:
            command = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            if is_dispatch:
                self._dispatch(command)
            elif is_knowledge_search:
                self._knowledge_search(command)
            elif is_nutrition_search:
                self._nutrition_search(command)
            else:
                self._cancel(command, self.path.split("/")[-2])
        except (KeyError, ValueError, json.JSONDecodeError):
            self._json(400, {"code": "RUNTIME_CONTRACT_INVALID"})

    def _knowledge_search(self, command):
        if not isinstance(command, dict):
            self._json(400, {"code": "RUNTIME_CONTRACT_INVALID"})
            return
        if command.get("knowledge_scope") != PUBLIC_SCOPE:
            self._json(403, {"code": "RAG_SCOPE_DENIED"})
            return
        query = command.get("query")
        if not isinstance(query, str) or not query.strip() or len(query) > 2000:
            self._json(400, {"code": "RAG_QUERY_INVALID"})
            return
        try:
            citations = _search_public_knowledge(query.strip())
        except RagError as error:
            status = 403 if error.code == "RAG_SCOPE_DENIED" else 503
            self._json(status, {"code": error.code})
            return
        self._json(
            200,
            {"knowledge_scope": PUBLIC_SCOPE, "citations": _citation_payload(citations)},
        )

    def _nutrition_search(self, command):
        """只查询营养向量候选，营养写入仍由 Java 回源 PostgreSQL 决定。"""
        if not isinstance(command, dict):
            self._json(400, {"code": "RUNTIME_CONTRACT_INVALID"})
            return
        if command.get("knowledge_scope") != PUBLIC_SCOPE:
            self._json(403, {"code": "RAG_SCOPE_DENIED"})
            return
        query = command.get("query")
        if not isinstance(query, str) or not query.strip() or len(query) > 255:
            self._json(400, {"code": "RAG_QUERY_INVALID"})
            return
        try:
            matches = search_nutrition_catalog(query.strip())
        except RagError as error:
            status = 403 if error.code == "RAG_SCOPE_DENIED" else 503
            self._json(status, {"code": error.code})
            return
        self._json(
            200,
            {
                "knowledge_scope": PUBLIC_SCOPE,
                "matches": _nutrition_match_payload(matches),
            },
        )

    def _dispatch(self, command):
        for required in ("run_id", "dispatch_id", "deadline_at", "attempt"):
            if required not in command:
                raise KeyError(required)
        with _lock:
            existing = _dispatches.get(command["dispatch_id"])
            if existing is not None:
                if existing != command:
                    self._json(409, {"code": "RUNTIME_DISPATCH_IDEMPOTENCY_CONFLICT"})
                    return
                self._json(202, {"accepted": True, "duplicate": True, "dispatch_id": command["dispatch_id"]})
                _runtime_metrics.record("dispatch", "duplicate", "http")
                return
            _dispatches[command["dispatch_id"]] = command
        threading.Thread(target=execute, args=(command,), daemon=True).start()
        _runtime_metrics.record("dispatch", "accepted", "http")
        self._json(202, {"accepted": True, "duplicate": False, "dispatch_id": command["dispatch_id"]})

    def _cancel(self, command, path_run_id):
        if "run_id" not in command or "cancel_id" not in command:
            raise KeyError("run_id/cancel_id")
        if command["run_id"] != path_run_id:
            self._json(409, {"code": "RUNTIME_STATE_CONFLICT"})
            return
        with _lock:
            _cancelled.add(command["run_id"])
        self._json(202, {"accepted": True, "cancel_id": command["cancel_id"]})

    def _authenticated(self):
        # Local development can intentionally disable service JWT; production keeps
        # the normal Bearer verification path below.
        if not JWT_ENABLED:
            return True
        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return False
        required_scope = (
            "runtime:dispatch"
            if self.path.endswith("/runs")
            else "runtime:knowledge-search"
            if self.path == "/foodmate/internal/v1/knowledge/search"
            else "runtime:nutrition-search"
            if self.path == "/foodmate/internal/v1/nutrition/search"
            else "runtime:metrics"
            if self.path == "/foodmate/internal/metrics"
            else "runtime:cancel"
        )
        return _verify(authorization[7:], "foodmate-control-plane", "foodmate-agent-runtime", required_scope)

    def _json(self, status, value):
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    transport = os.getenv("FOODMATE_AGENT_TRANSPORT", "http").lower()
    mq_runtime = None
    knowledge_consumer = None
    if transport == "rocketmq":
        from mq_runtime import RocketMqEventPublisher, RocketMqProposalPublisher, RocketMqRuntime
        _event_publisher = RocketMqEventPublisher()
        _proposal_publisher = RocketMqProposalPublisher()
        _mq_runtime = RocketMqRuntime(
            execute,
            publisher=_event_publisher,
            proposal_publisher=_proposal_publisher,
            on_result=_on_result,
            metrics=_runtime_metrics.record,
        )
        _mq_runtime.start()
        if os.getenv("FOODMATE_KNOWLEDGE_INDEX_WORKER_ENABLED", "false").lower() == "true":
            from knowledge_worker import start_rocketmq_worker
            knowledge_consumer = start_rocketmq_worker()
        _notify_java_runtime_recovered()
        mq_runtime = _mq_runtime
    try:
        bind_host = os.getenv("FOODMATE_BIND_HOST", "127.0.0.1")
        ThreadingHTTPServer((bind_host, int(os.getenv("PORT", "9000"))), Handler).serve_forever()
    finally:
        if mq_runtime is not None:
            mq_runtime.close()
        if knowledge_consumer is not None:
            for consumer in knowledge_consumer:
                if consumer is not None:
                    consumer.shutdown()

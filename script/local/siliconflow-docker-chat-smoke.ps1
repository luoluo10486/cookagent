[CmdletBinding()]
param(
    [ValidateSet("standard", "high", "eval")]
    [string]$Tier = "standard",
    [switch]$ExecuteRequest
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$composeFile = Join-Path $repoRoot "docker/compose.yml"
$envFile = Join-Path $repoRoot ".env"
$composeArgs = @("--env-file", $envFile, "-f", $composeFile)
# Compose 将宿主机 .env 中的 FOODMATE_DOCKER_MODEL_PROVIDER_CLOUD_PRIMARY_API_KEY
# 映射为仅容器可见的供应商变量；脚本绝不把密钥作为进程参数传递或打印。

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is required"
}
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "Docker Compose file is missing: $composeFile"
}
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw "Project .env is missing; prepare local Docker configuration first"
}

& docker compose @composeArgs config --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose configuration is invalid"
}

$agentPort = [Environment]::GetEnvironmentVariable("FOODMATE_AGENT_PORT")
if ([string]::IsNullOrWhiteSpace($agentPort)) {
    $agentPort = "9002"
}

function Test-AgentRuntimeReady {
    $uri = "http://localhost:$agentPort/foodmate/internal/health/ready"
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 10
        if ($response.StatusCode -ne 200) {
            throw "HTTP $($response.StatusCode)"
        }
    }
    catch {
        throw "agent-runtime readiness check failed: $uri; $($_.Exception.Message)"
    }
}

function Invoke-AgentPython([string]$source, [string[]]$arguments) {
    $encodedSource = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($source))
    $bootstrap = "import base64,sys;exec(base64.b64decode(sys.argv[1]))"
    # 命令契约固定为 docker compose exec -T agent-runtime python -c。
    & docker compose @composeArgs exec -T agent-runtime python -c $bootstrap $encodedSource @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "agent-runtime Docker Chat smoke failed"
    }
}

Test-AgentRuntimeReady

$preflightSource = @'
import json
import os
import sys

tier = sys.argv[2].upper()
alias = os.environ.get("FOODMATE_MODEL_TIER_" + tier, "").strip()
provider, separator, model = alias.partition(":")
base_url = os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_BASE_URL", "").strip()
api_key = os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_API_KEY", "").strip()
if not separator or provider != "cloud_primary" or not model:
    raise SystemExit("requested Docker Chat tier is not routed to cloud_primary")
if not base_url or not api_key:
    raise SystemExit("Docker Chat provider endpoint or API key is not configured")
print(json.dumps({
    "tier": tier.lower(),
    "provider": provider,
    "model": model,
    "has_base_url": True,
    "has_api_key": True,
}, sort_keys=True))
'@
$preflightOutput = & docker compose @composeArgs exec -T agent-runtime python -c "import base64,sys;exec(base64.b64decode(sys.argv[1]))" ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($preflightSource))) $Tier
if ($LASTEXITCODE -ne 0) {
    throw "Docker Chat provider is not configured for tier $Tier"
}
$preflight = (($preflightOutput -join [Environment]::NewLine).Trim() | ConvertFrom-Json)
Write-Output "docker_chat_smoke_preflight=passed"
Write-Output "chat_tier=$($preflight.tier)"
Write-Output "chat_provider=$($preflight.provider)"
Write-Output "chat_model=$($preflight.model)"
Write-Output "agent_runtime_port=$agentPort"

if (-not $ExecuteRequest) {
    Write-Output "chat_request=skipped"
    exit 0
}

$requestSource = @'
import json
import os
import sys
import time
import urllib.error
import urllib.request

tier = sys.argv[2].upper()
alias = os.environ.get("FOODMATE_MODEL_TIER_" + tier, "").strip()
provider, separator, model = alias.partition(":")
base_url = os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_BASE_URL", "").strip()
api_key = os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_API_KEY", "").strip()
if not separator or provider != "cloud_primary" or not model or not base_url or not api_key:
    raise SystemExit("Docker Chat provider configuration is incomplete")
payload = json.dumps({
    "model": model,
    "messages": [{"role": "user", "content": "Return one short Chinese smoke-test sentence."}],
    "temperature": 0,
    "max_tokens": 32,
    "enable_thinking": False,
}).encode("utf-8")
request = urllib.request.Request(
    base_url.rstrip("/") + "/chat/completions",
    data=payload,
    headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
    method="POST",
)
started = time.perf_counter()
try:
    with urllib.request.urlopen(request, timeout=float(os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_TIMEOUT_SECONDS", "30"))) as response:
        body = json.loads(response.read().decode("utf-8"))
except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as error:
    raise SystemExit("Chat request failed: " + type(error).__name__)
choices = body.get("choices")
if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
    raise SystemExit("Chat response choices are invalid")
message = choices[0].get("message")
content = message.get("content") if isinstance(message, dict) else None
if not isinstance(content, str) or not content.strip():
    raise SystemExit("Chat response content is invalid")
usage = body.get("usage")
total_tokens = usage.get("total_tokens") if isinstance(usage, dict) else None
latency_ms = round((time.perf_counter() - started) * 1000, 2)
print("chat_tier=" + tier.lower())
print("chat_provider=" + provider)
print("chat_model=" + model)
print("total_tokens=" + (str(total_tokens) if total_tokens is not None else "unknown"))
print("latency_ms=" + str(latency_ms))
print("chat_smoke_status=passed")
'@
Invoke-AgentPython $requestSource @($Tier)

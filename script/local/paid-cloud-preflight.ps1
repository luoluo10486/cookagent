[CmdletBinding()]
param(
    [ValidateSet("rag", "food-log", "meal-plan", "sql-agent")]
    [string]$Scenario = "rag",
    [switch]$ExecutePaid
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$composeFile = Join-Path $repoRoot "docker/compose.yml"
$envFile = Join-Path $repoRoot ".env"
$composeArgs = @("--env-file", $envFile, "-f", $composeFile)

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is required"
}
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "Docker Compose file is missing: $composeFile"
}
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw "Project .env is missing; prepare local Docker configuration first"
}

if (-not $ExecutePaid) {
    Write-Output "paid_execution=skipped"
    Write-Output "提示：只有显式传入 -ExecutePaid 才会启用真实付费轮次门禁；此预检不会调用云服务"
    exit 0
}

# 以下变量只存在于当前进程，由 Compose 插值后传入容器；PowerShell 进程退出后即消失。
# 凭据由 Compose 从 .env 读取，绝不变成脚本参数或标准输出内容。
$env:FOODMATE_DOCKER_PAID_EXECUTION_ENABLED = "true"
$env:FOODMATE_DOCKER_PAID_MAX_SCENARIOS = "4"
$env:FOODMATE_DOCKER_PAID_MAX_TOTAL_COST_CNY = "5"
$env:FOODMATE_DOCKER_PAID_NO_RETRY = "true"
$env:FOODMATE_DOCKER_PAID_REQUIRE_CLOUD = "true"

try {
    & docker compose @composeArgs config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose configuration is invalid"
    }

    & docker compose @composeArgs up -d --force-recreate agent-runtime
    if ($LASTEXITCODE -ne 0) {
        throw "agent-runtime recreation failed"
    }

    $pythonSource = @'
import json
import sys

from paid_execution import PaidExecutionSession

session = PaidExecutionSession.from_environment()
# python -c 的第一个参数是 base64 源代码，业务场景位于第二个参数。
session.begin_scenario(sys.argv[2])
print(json.dumps({
    "paid_execution": session.settings.enabled,
    "scenario": session.scenarios[0],
    "max_scenarios": session.settings.max_scenarios,
    "max_total_cost_cny": format(session.settings.max_total_cost_cny, "f"),
    "no_retry": session.settings.no_retry,
    "require_cloud": session.settings.require_cloud,
}, sort_keys=True))
'@
    $encodedSource = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pythonSource))
    $bootstrap = "import base64,sys;exec(base64.b64decode(sys.argv[1]))"
    $output = & docker compose @composeArgs exec -T agent-runtime python -c $bootstrap $encodedSource $Scenario
    if ($LASTEXITCODE -ne 0) {
        throw "agent-runtime paid execution gate verification failed"
    }
    Write-Output "paid_execution_preflight=passed"
    $output | ForEach-Object { Write-Output $_ }
}
finally {
    Remove-Item Env:FOODMATE_DOCKER_PAID_EXECUTION_ENABLED -ErrorAction SilentlyContinue
    Remove-Item Env:FOODMATE_DOCKER_PAID_MAX_SCENARIOS -ErrorAction SilentlyContinue
    Remove-Item Env:FOODMATE_DOCKER_PAID_MAX_TOTAL_COST_CNY -ErrorAction SilentlyContinue
    Remove-Item Env:FOODMATE_DOCKER_PAID_NO_RETRY -ErrorAction SilentlyContinue
    Remove-Item Env:FOODMATE_DOCKER_PAID_REQUIRE_CLOUD -ErrorAction SilentlyContinue
}

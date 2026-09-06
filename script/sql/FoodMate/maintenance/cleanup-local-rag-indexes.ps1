[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$DatabaseName = "FoodMate",
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$')]
    [string]$PostgresContainer = "foodmate-postgres",
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$')]
    [string]$RedisContainer = "foodmate-redis",
    [string]$MilvusUri = "http://127.0.0.1:19530",
    [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]{0,254}$')]
    [string]$MilvusCollection = "foodmate_knowledge_chunks_qwen3_embedding_0_6b",
    [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]{0,254}$')]
    [string]$NutritionMilvusCollection = "foodmate_nutrition_foods",
    [ValidatePattern('^[A-Za-z0-9:_-]{1,128}$')]
    [string]$RedisPrefix = "foodmate:rag:stub",
    [string]$RedisPassword = "",
    [switch]$Execute,
    [string]$Confirmation = ""
)

$ErrorActionPreference = "Stop"
$confirmationPhrase = "CLEAN_LOCAL_RAG_INDEXES"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../../..")).Path
$python = Join-Path $repoRoot "agent-runtime\.venv\Scripts\python.exe"
$legacyTestCollections = @(
    "foodmate_knowledge_codex_chunks_20260823",
    "foodmate_knowledge_codex_audit_20260823",
    "foodmate_knowledge_codex_m22_20260823"
)

function Get-LocalEnvValue([string]$Name) {
    $envFile = Join-Path $repoRoot ".env"
    if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
        return ""
    }
    $pattern = "^\s*$([regex]::Escape($Name))=(.*)$"
    $line = Get-Content -LiteralPath $envFile -Encoding UTF8 |
        Where-Object { $_ -match $pattern } |
        Select-Object -First 1
    if ($null -eq $line) {
        return ""
    }
    return ([regex]::Match($line, $pattern)).Groups[1].Value.Trim()
}

function Invoke-Psql {
    param(
        [Parameter(Mandatory)]
        [string]$Sql
    )

    $output = & docker exec $PostgresContainer psql --no-psqlrc --quiet --tuples-only --no-align `
        --set ON_ERROR_STOP=1 --username postgres --dbname $DatabaseName --command $Sql 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL 命令执行失败：$($output.Trim())"
    }
    return $output.Trim()
}

function Invoke-Redis {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $output = & docker exec $RedisContainer redis-cli --no-auth-warning -a $RedisPassword @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Redis 命令执行失败：$($output.Trim())"
    }
    return $output.Trim()
}

function Invoke-Milvus([string[]]$Collections, [ValidateSet("inspect", "clear")] [string]$Action) {
    if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
        throw "缺少项目 Python 环境：$python"
    }
    $script = @'
import json
import sys

from pymilvus import MilvusClient


uri = sys.argv[1]
action = sys.argv[2]
collections = [item for item in sys.argv[3:] if item]
client = MilvusClient(uri=uri)


def read_ids(name):
    iterator = client.query_iterator(
        collection_name=name,
        batch_size=1000,
        limit=-1,
        filter="",
        output_fields=["embedding_id"],
    )
    ids = []
    try:
        while True:
            batch = iterator.next()
            if not batch:
                break
            ids.extend(row.get("embedding_id") for row in batch if row.get("embedding_id"))
    finally:
        iterator.close()
    return ids


def inspect_collection(name):
    if not client.has_collection(name):
        return {"collection": name, "exists": False, "rows": 0}
    return {"collection": name, "exists": True, "rows": len(read_ids(name))}


result = []
for name in collections:
    before = inspect_collection(name)
    current = {"collection": name, "before": before}
    if action == "clear" and before["exists"] and before["rows"]:
        ids = read_ids(name)
        if len(ids) != before["rows"]:
            raise RuntimeError(
                f"collection {name} query returned {len(ids)} ids but iterator counted {before['rows']} rows"
            )
        client.delete(collection_name=name, ids=ids)
        flush = getattr(client, "flush", None)
        if callable(flush):
            flush(collection_name=name)
    current["after"] = inspect_collection(name)
    result.append(current)

print(json.dumps(result, ensure_ascii=False))
'@
    $output = & $python -B -c $script $MilvusUri $Action $Collections 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Milvus 命令执行失败：$($output.Trim())"
    }
    return $output.Trim() | ConvertFrom-Json
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "需要 Docker CLI"
}
$postgresRunning = (& docker inspect --format '{{.State.Running}}' $PostgresContainer 2>$null | Out-String).Trim()
if ($postgresRunning -ne "true") {
    throw "PostgreSQL 容器未运行：$PostgresContainer"
}
$redisRunning = (& docker inspect --format '{{.State.Running}}' $RedisContainer 2>$null | Out-String).Trim()
if ($redisRunning -ne "true") {
    throw "Redis 容器未运行：$RedisContainer"
}
if ($MilvusCollection -eq $NutritionMilvusCollection) {
    throw "公共知识集合不能与营养集合相同"
}
if ([string]::IsNullOrWhiteSpace($RedisPassword)) {
    $RedisPassword = $env:REDIS_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($RedisPassword)) {
    $RedisPassword = Get-LocalEnvValue "REDIS_PASSWORD"
}
if ([string]::IsNullOrWhiteSpace($RedisPassword)) {
    throw "未找到 Redis 密码，请通过 -RedisPassword 或当前 .env/进程环境提供"
}

$activeDocuments = [int](Invoke-Psql "SELECT COUNT(*) FROM knowledge_documents WHERE is_deleted=FALSE;")
$activeChunks = [int](Invoke-Psql "SELECT COUNT(*) FROM knowledge_chunks WHERE is_deleted=FALSE;")
$targetCollections = @($MilvusCollection) + @($legacyTestCollections | Where-Object { $_ -ne $MilvusCollection -and $_ -ne $NutritionMilvusCollection })
$milvusBefore = @(Invoke-Milvus -Collections $targetCollections -Action inspect)
$nutritionBefore = @(Invoke-Milvus -Collections @($NutritionMilvusCollection) -Action inspect)
$redisKey = "$RedisPrefix`:chunks"
$redisExistsBefore = [int](Invoke-Redis -Arguments @("EXISTS", $redisKey))
$redisRowsBefore = if ($redisExistsBefore -eq 1) { [int](Invoke-Redis -Arguments @("HLEN", $redisKey)) } else { 0 }

$report = [ordered]@{
    mode = if ($Execute) { "execute" } else { "dry_run" }
    database = $DatabaseName
    postgres_container = $PostgresContainer
    redis_container = $RedisContainer
    milvus_uri = $MilvusUri
    active_knowledge_documents = $activeDocuments
    active_knowledge_chunks = $activeChunks
    public_milvus_collections = $milvusBefore
    nutrition_milvus_collection = $nutritionBefore
    redis_index = [ordered]@{ key = $redisKey; exists = [bool]$redisExistsBefore; rows = $redisRowsBefore }
    protected_nutrition_collection = $NutritionMilvusCollection
}

if (-not $Execute) {
    $report.status = "preflight_passed"
    $report | ConvertTo-Json -Depth 8
    exit 0
}

if ($Confirmation -cne $confirmationPhrase) {
    throw "执行清理必须显式提供确认短语：$confirmationPhrase"
}
if ($activeDocuments -gt 0 -or $activeChunks -gt 0) {
    throw "PostgreSQL 仍有活动知识文档或切片，拒绝清理公共 RAG 索引；请先完成文档生命周期处理"
}
if (-not $PSCmdlet.ShouldProcess("公共知识 RAG 外部索引", "清理当前集合和明确命名的 codex 测试集合")) {
    exit 0
}

$milvusAfter = @(Invoke-Milvus -Collections $targetCollections -Action clear)
$nutritionAfter = @(Invoke-Milvus -Collections @($NutritionMilvusCollection) -Action inspect)
if ($nutritionBefore[0].rows -ne $nutritionAfter[0].rows) {
    throw "营养 Milvus 集合数量发生变化，停止后续操作"
}
if ($redisExistsBefore -eq 1) {
    [void](Invoke-Redis -Arguments @("DEL", $redisKey))
}
$redisExistsAfter = [int](Invoke-Redis -Arguments @("EXISTS", $redisKey))
$redisRowsAfter = if ($redisExistsAfter -eq 1) { [int](Invoke-Redis -Arguments @("HLEN", $redisKey)) } else { 0 }

$report.status = "completed"
$report.public_milvus_collections_after = $milvusAfter
$report.nutrition_milvus_collection_after = $nutritionAfter
$report.redis_index_after = [ordered]@{ key = $redisKey; exists = [bool]$redisExistsAfter; rows = $redisRowsAfter }
$report | ConvertTo-Json -Depth 8

[CmdletBinding()]
param(
    [switch]$ExecutePaid,
    [ValidateRange(1, 128)]
    [int]$BatchSize = 32
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$composeFile = Join-Path $repoRoot "docker/compose.yml"
$envFile = Join-Path $repoRoot ".env"
$composeArgs = @("--env-file", $envFile, "-f", $composeFile)

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "项目根目录 .env 不存在，不能读取 Docker RAG 配置"
}
if (-not $ExecutePaid) {
    Write-Output "预检通过：未写入 Milvus，也未调用 Embedding。确认执行全量付费索引时请增加 -ExecutePaid。"
    exit 0
}

function Invoke-ContainerPython([string]$Source) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Source))
    $bootstrap = "import base64;exec(base64.b64decode('$encoded'))"
    $output = & docker compose @composeArgs exec -T agent-runtime python -c $bootstrap 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "agent-runtime 配置检查失败：$($output -join ' ')"
    }
    return (($output -join [Environment]::NewLine).Trim())
}

$config = Invoke-ContainerPython @'
import json
import os

def present(name):
    return bool(os.environ.get(name, "").strip())

print(json.dumps({
    "mode": os.environ.get("FOODMATE_RAG_MODE", ""),
    "provider": os.environ.get("FOODMATE_RAG_EMBEDDING_PROVIDER", ""),
    "model": os.environ.get("FOODMATE_RAG_EMBEDDING_MODEL", ""),
    "api_key": present("FOODMATE_RAG_EMBEDDING_API_KEY"),
    "milvus": present("FOODMATE_RAG_MILVUS_URI"),
    "collection": os.environ.get("FOODMATE_RAG_NUTRITION_MILVUS_COLLECTION", ""),
}, sort_keys=True))
'@ | ConvertFrom-Json

if ($config.mode -ne "local" -or $config.provider -ne "openai-compatible") {
    throw "全量营养目录索引只允许 local + openai-compatible，当前为 $($config.mode) + $($config.provider)"
}
if (-not $config.api_key -or -not $config.milvus -or [string]::IsNullOrWhiteSpace([string]$config.collection)) {
    throw "Embedding API Key、Milvus URI 或营养集合未配置"
}

$query = @"
SELECT COALESCE(
    json_agg(
        json_build_object(
            'nutrition_food_id', nutrition_food_id::text,
            'standard_name', standard_name,
            'chinese_name', COALESCE(chinese_name, ''),
            'aliases', COALESCE(aliases_json, '[]'::jsonb),
            'food_form', food_form,
            'basis_unit', basis_unit,
            'calories_kcal_per_100', calories_kcal_per_100::text,
            'protein_g_per_100', protein_g_per_100::text,
            'fat_g_per_100', fat_g_per_100::text,
            'carbs_g_per_100', carbs_g_per_100::text,
            'source_name', source_name,
            'source_version', source_version,
            'catalog_version', catalog_version,
            'canonical_key', canonical_key
        ) ORDER BY nutrition_food_id
    ),
    '[]'::json
)::text
FROM nutrition_foods
WHERE is_deleted = FALSE
  AND review_status = 'approved'
  AND data_type = 'official';
"@

$catalogLines = & docker exec foodmate-postgres psql -U postgres -d FoodMate -At -v ON_ERROR_STOP=1 -c $query 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "读取 nutrition_foods 失败：$($catalogLines -join ' ')"
}
$catalogJson = ($catalogLines -join "").Trim()
if ([string]::IsNullOrWhiteSpace($catalogJson) -or $catalogJson -eq "[]") {
    throw "当前 approved nutrition_foods 目录为空"
}

$source = @'
import json
import sys
from nutrition_catalog_rag import NutritionCatalogRecord, index_records

records = [NutritionCatalogRecord.from_mapping(item) for item in json.loads(sys.stdin.read())]
result = index_records(records, batch_size=__BATCH_SIZE__)
print(json.dumps(result, ensure_ascii=False, sort_keys=True))
'@.Replace("__BATCH_SIZE__", [string]$BatchSize)
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($source))
$bootstrap = "import base64;exec(base64.b64decode('$encoded'))"
$result = $catalogJson | & docker compose @composeArgs exec -T agent-runtime python -c $bootstrap 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "营养目录索引失败：$($result -join ' ')"
}

Write-Output (($result -join [Environment]::NewLine).Trim())

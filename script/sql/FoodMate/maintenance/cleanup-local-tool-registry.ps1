[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$DatabaseName = "FoodMate",
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$')]
    [string]$DockerContainer = "foodmate-postgres",
    [switch]$Execute,
    [string]$Confirmation = ""
)

$ErrorActionPreference = "Stop"
$confirmationPhrase = "CLEAN_LOCAL_TOOL_REGISTRY"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../../..")).Path
$backupScript = Join-Path $PSScriptRoot "../backup-restore.ps1"
$seedFile = Join-Path $PSScriptRoot "../migration/V18__m2_2_tool_registry_seed.sql"
$canonicalTools = @(
    "calculator",
    "time_parser",
    "knowledge_search",
    "database_query",
    "food_log_writer",
    "plan_validator",
    "meal_plan.save_plan"
)

function Invoke-Psql {
    param(
        [Parameter(Mandatory)]
        [string]$Sql
    )

    $output = & docker exec $DockerContainer psql --no-psqlrc --quiet --tuples-only --no-align `
        --set ON_ERROR_STOP=1 --username postgres --dbname $DatabaseName --command $Sql 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL 命令执行失败：$($output.Trim())"
    }
    return $output.Trim()
}

function Invoke-PsqlFile {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $output = $content | & docker exec -i $DockerContainer psql --no-psqlrc `
        --set ON_ERROR_STOP=1 --username postgres --dbname $DatabaseName 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "SQL 文件执行失败：$Path`n$($output.Trim())"
    }
    return $output.Trim()
}

function Invoke-Backup {
    $backupName = "local-tool-registry-preclean-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')).dump"
    $output = & powershell.exe -NoProfile -NonInteractive -File $backupScript `
        -DatabaseName $DatabaseName `
        -Username postgres `
        -DockerContainer $DockerContainer `
        -BackupFile $backupName `
        -Execute 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "工具注册表清理前备份失败：$($output.Trim())"
    }
    return Join-Path $repoRoot "script/sql/FoodMate/backups/$backupName"
}

if (-not (Test-Path -LiteralPath $seedFile -PathType Leaf)) {
    throw "缺少工具注册表种子：$seedFile"
}
$running = (& docker inspect --format '{{.State.Running}}' $DockerContainer 2>$null | Out-String).Trim()
if ($running -ne "true") {
    throw "PostgreSQL 容器未运行：$DockerContainer"
}

$testToolRows = [int](Invoke-Psql @"
SELECT COUNT(*)
FROM tool_registries
WHERE is_deleted=FALSE AND name LIKE 'e2e_tool_%';
"@)
$testToolReferences = [int](Invoke-Psql @"
SELECT COUNT(*)
FROM tool_calls
WHERE tool_name LIKE 'e2e_tool_%' AND is_deleted=FALSE;
"@)
$activeCanonicalRows = [int](Invoke-Psql @"
SELECT COUNT(*)
FROM tool_registries
WHERE is_deleted=FALSE
  AND status='active'
  AND name IN ('calculator','time_parser','knowledge_search','database_query','food_log_writer','plan_validator','meal_plan.save_plan');
"@)

$report = [ordered]@{
    database = $DatabaseName
    docker_container = $DockerContainer
    mode = if ($Execute) { "execute" } else { "dry_run" }
    test_tool_rows = $testToolRows
    test_tool_references = $testToolReferences
    active_canonical_tool_rows_before = $activeCanonicalRows
    canonical_tools = $canonicalTools
}

if (-not $Execute) {
    $report.status = "preflight_passed"
    $report | ConvertTo-Json -Depth 5
    exit 0
}

if ($Confirmation -cne $confirmationPhrase) {
    throw "执行清理必须显式提供确认短语：$confirmationPhrase"
}
if ($testToolReferences -gt 0) {
    throw "发现 e2e 工具调用事实，拒绝删除；请先完成工具调用事实归档：$testToolReferences"
}
if (-not $PSCmdlet.ShouldProcess($DatabaseName, "删除无引用的 e2e 工具注册残留并重建正式种子")) {
    exit 0
}

$backupFile = Invoke-Backup
Invoke-Psql @"
BEGIN;
DELETE FROM tool_schema_versions
WHERE tool_id IN (
    SELECT tool_id FROM tool_registries WHERE is_deleted=FALSE AND name LIKE 'e2e_tool_%'
);
DELETE FROM tool_registries
WHERE is_deleted=FALSE AND name LIKE 'e2e_tool_%';
COMMIT;
"@ | Out-Null
Invoke-PsqlFile -Path $seedFile | Out-Null

$activeCanonicalRowsAfter = [int](Invoke-Psql @"
SELECT COUNT(*)
FROM tool_registries
WHERE is_deleted=FALSE
  AND status='active'
  AND current_version IS NOT NULL
  AND name IN ('calculator','time_parser','knowledge_search','database_query','food_log_writer','plan_validator','meal_plan.save_plan');
"@)
if ($activeCanonicalRowsAfter -ne $canonicalTools.Count) {
    throw "正式工具注册表校验失败：期望 $($canonicalTools.Count)，实际 $activeCanonicalRowsAfter"
}

$report.status = "completed"
$report.backup_file = $backupFile
$report.active_canonical_tool_rows_after = $activeCanonicalRowsAfter
$report.remaining_test_tool_rows = [int](Invoke-Psql "SELECT COUNT(*) FROM tool_registries WHERE is_deleted=FALSE AND name LIKE 'e2e_tool_%';")
$report | ConvertTo-Json -Depth 5

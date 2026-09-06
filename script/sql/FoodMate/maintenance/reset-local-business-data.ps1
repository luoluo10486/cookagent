[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$DatabaseName = "FoodMate",
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$')]
    [string]$DockerContainer = "foodmate-postgres",
    [switch]$Execute,
    [switch]$RebuildReferenceData,
    [string]$Confirmation = ""
)

$ErrorActionPreference = "Stop"
$confirmationPhrase = "RESET_LOCAL_BUSINESS_DATA"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../../..")).Path
$backupScript = Join-Path $PSScriptRoot "../backup-restore.ps1"
$toolSeedFile = Join-Path $PSScriptRoot "../migration/V18__m2_2_tool_registry_seed.sql"
$nutritionSeedFile = Join-Path $PSScriptRoot "../seed/generated/V33__nutrition_usda_catalog_rebuild_seed.sql"
$nutritionValidationFile = Join-Path $PSScriptRoot "../validation/V33__nutrition_usda_catalog_rebuild_seed_validation.sql"
$preservedTables = @(
    "users",
    "user_profiles",
    "nutrition_foods",
    "nutrition_unit_conversions",
    "data_sources",
    "schema_catalogs",
    "model_providers",
    "model_catalog",
    "model_price_versions",
    "model_budget_policies",
    "model_route_rules",
    "data_retention_policies",
    "tool_registries",
    "tool_schema_versions"
)
$breakableConstraints = @(
    "fk_agent_runs_active_dispatch",
    "agent_runs_user_message_id_fkey",
    "fk_messages_agent_run_id"
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

function Quote-Identifier([string]$Value) {
    return '"' + $Value.Replace('"', '""') + '"'
}

function Get-BaseTables {
    return @(
        (Invoke-Psql @"
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
"@) -split "`r?`n" |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ }
    )
}

function Get-ForeignKeys {
    $rows = @(
        (Invoke-Psql @"
SELECT tc.constraint_name || E'\t' || kcu.table_name || E'\t' || ccu.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
ORDER BY kcu.table_name,ccu.table_name;
"@) -split "`r?`n" |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ }
    )
    return @(
        $rows | ForEach-Object {
            $parts = $_ -split "`t", 3
            [pscustomobject]@{ Constraint = $parts[0]; Child = $parts[1]; Parent = $parts[2] }
        }
    )
}

function Get-DeleteOrder([string[]]$CandidateTables, [object[]]$ForeignKeys) {
    $remaining = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($table in $CandidateTables) { [void]$remaining.Add($table) }
    $order = [System.Collections.Generic.List[string]]::new()
    while ($remaining.Count -gt 0) {
        $ready = @(
            $remaining | Where-Object {
                $table = $_
                -not @(
                    $ForeignKeys | Where-Object {
                        $_.Parent -ieq $table -and $_.Child -ine $table -and $remaining.Contains($_.Child)
                    }
                ).Count
            }
        )
        if ($ready.Count -eq 0) {
            throw "检测到未处理的外键环，拒绝清理：$(($remaining | Sort-Object) -join ', ')"
        }
        foreach ($table in ($ready | Sort-Object)) {
            [void]$order.Add($table)
            [void]$remaining.Remove($table)
        }
    }
    return $order.ToArray()
}

function Get-RowCounts([string[]]$Tables) {
    $counts = [ordered]@{}
    foreach ($table in ($Tables | Sort-Object)) {
        $quoted = Quote-Identifier $table
        $counts[$table] = [long](Invoke-Psql "SELECT COUNT(*) FROM public.$quoted;")
    }
    return $counts
}

function Invoke-Backup {
    $backupName = "local-business-data-preclean-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')).dump"
    $output = & powershell.exe -NoProfile -NonInteractive -File $backupScript `
        -DatabaseName $DatabaseName `
        -Username postgres `
        -DockerContainer $DockerContainer `
        -BackupFile $backupName `
        -Execute 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "本地业务数据清理前备份失败：$($output.Trim())"
    }
    return Join-Path $repoRoot "script/sql/FoodMate/backups/$backupName"
}

if (-not (Test-Path -LiteralPath $toolSeedFile -PathType Leaf)) {
    throw "缺少工具注册表种子：$toolSeedFile"
}
if ($RebuildReferenceData -and -not (Test-Path -LiteralPath $nutritionSeedFile -PathType Leaf)) {
    throw "缺少营养目录种子：$nutritionSeedFile"
}
if ($RebuildReferenceData -and -not (Test-Path -LiteralPath $nutritionValidationFile -PathType Leaf)) {
    throw "缺少营养目录校验：$nutritionValidationFile"
}
$running = (& docker inspect --format '{{.State.Running}}' $DockerContainer 2>$null | Out-String).Trim()
if ($running -ne "true") {
    throw "PostgreSQL 容器未运行：$DockerContainer"
}

$baseTables = Get-BaseTables
$candidateTables = @($baseTables | Where-Object { $_ -notin $preservedTables })
$foreignKeys = Get-ForeignKeys
$orderedForeignKeys = @($foreignKeys | Where-Object { $_.Constraint -notin $breakableConstraints })
$deleteOrder = Get-DeleteOrder $candidateTables $orderedForeignKeys
$counts = Get-RowCounts $candidateTables
$report = [ordered]@{
    database = $DatabaseName
    docker_container = $DockerContainer
    mode = if ($Execute) { "execute" } else { "dry_run" }
    rebuild_reference_data = [bool]$RebuildReferenceData
    preserved_tables = @($preservedTables | Where-Object { $_ -in $baseTables })
    candidate_table_count = $candidateTables.Count
    candidate_row_count = [long](($counts.Values | Measure-Object -Sum).Sum)
    row_counts = $counts
    delete_order = $deleteOrder
}

if (-not $Execute) {
    $report.status = "preflight_passed"
    $report | ConvertTo-Json -Depth 8
    exit 0
}

if ($Confirmation -cne $confirmationPhrase) {
    throw "执行清理必须显式提供确认短语：$confirmationPhrase"
}
if (-not $PSCmdlet.ShouldProcess($DatabaseName, "清理本地业务事实并保留正式参考数据")) {
    exit 0
}

$backupFile = Invoke-Backup
$commands = [System.Collections.Generic.List[string]]::new()
[void]$commands.Add("BEGIN;")
if ($baseTables -contains "agent_runs") {
    [void]$commands.Add("UPDATE public.agent_runs SET active_dispatch_id=NULL,user_message_id=NULL,parent_run_id=NULL,superseded_by_run_id=NULL,continuation_reason=NULL;")
}
if ($baseTables -contains "messages") {
    [void]$commands.Add("UPDATE public.messages SET agent_run_id=NULL;")
}
if ($baseTables -contains "auth_refresh_tokens") {
    [void]$commands.Add("UPDATE public.auth_refresh_tokens SET rotated_from_token_id=NULL;")
}
foreach ($table in $deleteOrder) {
    [void]$commands.Add("DELETE FROM public.$(Quote-Identifier $table);")
}
# e2e 工具注册没有被保留为正式配置，且前置校验要求不存在 ToolCall 引用。
[void]$commands.Add("DELETE FROM public.tool_schema_versions WHERE tool_id IN (SELECT tool_id FROM public.tool_registries WHERE is_deleted=FALSE AND name LIKE 'e2e_tool_%');")
[void]$commands.Add("DELETE FROM public.tool_registries WHERE is_deleted=FALSE AND name LIKE 'e2e_tool_%';")
[void]$commands.Add("COMMIT;")
Invoke-Psql ($commands -join "`n") | Out-Null

Invoke-PsqlFile -Path $toolSeedFile | Out-Null
if ($RebuildReferenceData) {
    Invoke-PsqlFile -Path $nutritionSeedFile | Out-Null
    Invoke-PsqlFile -Path $nutritionValidationFile | Out-Null
}

$remaining = Get-RowCounts $candidateTables
$report.status = "completed"
$report.backup_file = $backupFile
$report.remaining_candidate_row_count = [long](($remaining.Values | Measure-Object -Sum).Sum)
$report.remaining_rows = $remaining
$report.active_canonical_tool_rows = [int](Invoke-Psql @"
SELECT COUNT(*) FROM tool_registries
WHERE is_deleted=FALSE AND status='active' AND current_version IS NOT NULL
  AND name IN ('calculator','time_parser','knowledge_search','database_query','food_log_writer','plan_validator','meal_plan.save_plan');
"@)
$report.nutrition_active_rows = [int](Invoke-Psql "SELECT COUNT(*) FROM nutrition_foods WHERE is_deleted=FALSE AND review_status='approved' AND data_type='official';")
$report.nutrition_active_conversion_rows = [int](Invoke-Psql "SELECT COUNT(*) FROM nutrition_unit_conversions WHERE is_deleted=FALSE AND review_status='approved';")
$report | ConvertTo-Json -Depth 8

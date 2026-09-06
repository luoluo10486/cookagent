[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$DatabaseName = "FoodMate",
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$')]
    [string]$DockerContainer = "foodmate-postgres",
    [switch]$Execute,
    [string]$Confirmation = ""
)

$ErrorActionPreference = "Stop"
$confirmationPhrase = "RESET_LOCAL_DEMO_BASELINE"
$adminUsername = "admin@foodmate.local"
$adminPasswordHash = '$2a$12$0RrZlatmQwFgNhms4CQZ/uPrJPv.beakSkOtInp72kypMOFtPiJHy'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../../..")).Path
$backupScript = Join-Path $PSScriptRoot "../backup-restore.ps1"

# 这些表保存应用静态配置，清理演示数据时必须保留。
$preservedTables = @(
    "flyway_schema_history",
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

function Invoke-Psql {
    param(
        [Parameter(Mandatory)]
        [string]$Sql,
        [switch]$TupleOnly
    )

    $arguments = @(
        "exec",
        $DockerContainer,
        "psql",
        "--no-psqlrc",
        "--set",
        "ON_ERROR_STOP=1",
        "--username",
        "postgres",
        "--dbname",
        $DatabaseName
    )
    if ($TupleOnly) {
        $arguments += @("--tuples-only", "--no-align", "--field-separator", "`t")
    }
    $arguments += @("--command", $Sql)
    $output = & docker @arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL 命令执行失败：$($output.Trim())"
    }
    return $output.Trim()
}

function Quote-Identifier([string]$Value) {
    return '"' + $Value.Replace('"', '""') + '"'
}

function Get-BaseTables {
    $sql = @"
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name
"@
    return @(
        (Invoke-Psql -Sql $sql -TupleOnly) -split "`r?`n" |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ }
    )
}

function Get-ForeignKeys {
    $sql = @"
SELECT constraint_row.constraint_name || E'\t' || child.table_name || E'\t' || parent.table_name
FROM information_schema.table_constraints constraint_row
JOIN information_schema.key_column_usage child_column
  ON child_column.constraint_name = constraint_row.constraint_name
 AND child_column.table_schema = constraint_row.table_schema
JOIN information_schema.constraint_column_usage parent_column
  ON parent_column.constraint_name = constraint_row.constraint_name
 AND parent_column.table_schema = constraint_row.table_schema
JOIN information_schema.tables child
  ON child.table_schema = child_column.table_schema
 AND child.table_name = child_column.table_name
JOIN information_schema.tables parent
  ON parent.table_schema = parent_column.table_schema
 AND parent.table_name = parent_column.table_name
WHERE constraint_row.constraint_type = 'FOREIGN KEY'
  AND constraint_row.table_schema = 'public'
ORDER BY child.table_name, parent.table_name
"@
    $rows = @((Invoke-Psql -Sql $sql -TupleOnly) -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
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
            $cycle = ($remaining | Sort-Object) -join ", "
            throw "检测到未处理的外键环，拒绝生成删除顺序：$cycle"
        }
        foreach ($table in ($ready | Sort-Object)) {
            [void]$order.Add($table)
            [void]$remaining.Remove($table)
        }
    }
    return $order.ToArray()
}

function Get-RowCounts([string[]]$Tables) {
    $counts = [System.Collections.Generic.List[object]]::new()
    foreach ($table in ($Tables | Sort-Object)) {
        $quoted = Quote-Identifier $table
        $count = [long](Invoke-Psql -Sql "SELECT count(*) FROM public.$quoted" -TupleOnly).Trim()
        [void]$counts.Add([pscustomobject]@{ table = $table; rows = $count })
    }
    return $counts.ToArray()
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "需要 Docker CLI"
}
if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) {
    throw "缺少数据库备份脚本：$backupScript"
}
$running = (& docker inspect --format '{{.State.Running}}' $DockerContainer 2>$null | Out-String).Trim()
if ($running -ne "true") {
    throw "PostgreSQL 容器未运行：$DockerContainer"
}

$baseTables = Get-BaseTables
$candidateTables = @($baseTables | Where-Object { $_ -notin $preservedTables })
$foreignKeys = Get-ForeignKeys
# 这些外键在事务中会先置空，排序时忽略对应的可打破关系以消除业务环。
$breakableConstraints = @(
    "fk_agent_runs_active_dispatch",
    "agent_runs_user_message_id_fkey",
    "fk_messages_agent_run_id"
)
$orderForeignKeys = @($foreignKeys | Where-Object { $_.Constraint -notin $breakableConstraints })
$deleteOrder = Get-DeleteOrder $candidateTables $orderForeignKeys
$counts = Get-RowCounts $candidateTables

$report = [ordered]@{
    mode = if ($Execute) { "execute" } else { "dry_run" }
    database = $DatabaseName
    docker_container = $DockerContainer
    preserved_tables = @($preservedTables | Where-Object { $_ -in $baseTables })
    candidate_table_count = $candidateTables.Count
    candidate_row_count = [long](($counts | Measure-Object -Property rows -Sum).Sum)
    delete_order = $deleteOrder
    row_counts = $counts
    administrator = [ordered]@{ username = $adminUsername; password_hash_algorithm = "bcrypt" }
}

if (-not $Execute) {
    $report.status = "preflight_passed"
    $report | ConvertTo-Json -Depth 6
    exit 0
}

if ($Confirmation -cne $confirmationPhrase) {
    throw "执行清理必须显式提供确认短语：$confirmationPhrase"
}
if (-not $PSCmdlet.ShouldProcess($DatabaseName, "清理本地演示数据库并创建管理员")) {
    exit 0
}

$backupName = "local-demo-preclean-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')).dump"
$backupOutput = & powershell.exe -NoProfile -NonInteractive -File $backupScript `
    -DatabaseName $DatabaseName `
    -Username postgres `
    -DockerContainer $DockerContainer `
    -BackupFile $backupName `
    -Execute 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    throw "清理前备份失败：$($backupOutput.Trim())"
}

# 清除自引用字段后再按子表到父表删除，避免破坏外键约束。
$commands = [System.Collections.Generic.List[string]]::new()
[void]$commands.Add("BEGIN;")
[void]$commands.Add("UPDATE public.agent_runs SET active_dispatch_id = NULL, user_message_id = NULL, parent_run_id = NULL, superseded_by_run_id = NULL, continuation_reason = NULL;")
[void]$commands.Add("UPDATE public.messages SET agent_run_id = NULL;")
[void]$commands.Add("UPDATE public.auth_refresh_tokens SET rotated_from_token_id = NULL;")
foreach ($table in $deleteOrder) {
    [void]$commands.Add("DELETE FROM public.$(Quote-Identifier $table);")
}
$userId = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000 + (Get-Random -Minimum 100 -Maximum 999)
$profileId = $userId + 1
$escapedUsername = $adminUsername.Replace("'", "''")
[void]$commands.Add(
    "INSERT INTO public.users (user_id,user_no,username,email,password_hash,nickname,role,status) " +
    "VALUES ($userId,'U$userId','$escapedUsername','$escapedUsername','$adminPasswordHash','FoodMate 管理员','admin','active');"
)
[void]$commands.Add(
    "INSERT INTO public.user_profiles (profile_id,user_id,display_name) " +
    "VALUES ($profileId,$userId,'FoodMate 管理员');"
)
[void]$commands.Add("COMMIT;")
Invoke-Psql -Sql ($commands -join "`n") | Out-Null

$remainingRows = Get-RowCounts $candidateTables
$adminCheck = Invoke-Psql -Sql "SELECT count(*) || E'\t' || count(*) FILTER (WHERE username = '$escapedUsername' AND role = 'admin' AND status = 'active') FROM public.users" -TupleOnly
$report.mode = "execute"
$report.status = "completed"
$report.backup_file = Join-Path $repoRoot "script/sql/FoodMate/backups/$backupName"
$report.backup_output_recorded = $true
$report.remaining_candidate_rows = [long](($remainingRows | Measure-Object -Property rows -Sum).Sum)
$report.administrator_check = $adminCheck.Trim()
$report | ConvertTo-Json -Depth 6

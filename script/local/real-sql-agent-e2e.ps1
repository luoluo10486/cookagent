[CmdletBinding()]
param(
    [string]$JavaBaseUrl = "http://127.0.0.1:8080",
    [int]$RunTimeoutSeconds = 300,
    [switch]$ExecutePaid,
    [switch]$KeepData
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$composeFile = Join-Path $repoRoot "docker/compose.yml"
$envFile = Join-Path $repoRoot ".env"
$composeArgs = @("--env-file", $envFile, "-f", $composeFile)
$AdminUsername = [Environment]::GetEnvironmentVariable("FOODMATE_E2E_ADMIN_USERNAME", "Process")
$AdminPassword = [Environment]::GetEnvironmentVariable("FOODMATE_E2E_ADMIN_PASSWORD", "Process")

$report = [ordered]@{
    status = if ($ExecutePaid) { "running" } else { "preflight_only" }
    execution = if ($ExecutePaid) { "paid_requested" } else { "preflight_only" }
    started_at = (Get-Date).ToUniversalTime().ToString("o")
    paid_gate = $null
    chat = $null
    sql_planner = $null
    run_id = $null
    session_id = $null
    sse = $null
    tool_calls = $null
    sql_audit = $null
    cleanup = [ordered]@{
        requested = (-not $KeepData)
        session_soft_deleted = $false
        errors = @()
    }
    error_code = $null
    error_summary = $null
}

$context = $null
$paidEnvironmentNames = @(
    "FOODMATE_DOCKER_PAID_EXECUTION_ENABLED",
    "FOODMATE_DOCKER_PAID_MAX_SCENARIOS",
    "FOODMATE_DOCKER_PAID_MAX_TOTAL_COST_CNY",
    "FOODMATE_DOCKER_PAID_NO_RETRY",
    "FOODMATE_DOCKER_PAID_REQUIRE_CLOUD"
)
$previousPaidEnvironment = @{}
$paidEnvironmentChanged = $false

function Get-Field([object]$Object, [string[]]$Names) {
    if ($null -eq $Object) { return $null }
    foreach ($name in $Names) {
        $property = $Object.PSObject.Properties[$name]
        if ($null -ne $property) { return $property.Value }
    }
    return $null
}

function Get-SafeSummary([object]$ErrorRecord) {
    $exception = if ($null -ne $ErrorRecord.Exception) { $ErrorRecord.Exception } else { $ErrorRecord }
    $message = if ($null -ne $exception) { [string]$exception.Message } else { "unknown error" }
    if (-not [string]::IsNullOrWhiteSpace($AdminPassword)) { $message = $message.Replace($AdminPassword, "[redacted]") }
    if (-not [string]::IsNullOrWhiteSpace($AdminUsername)) { $message = $message.Replace($AdminUsername, "[redacted]") }
    $message = [regex]::Replace($message, '(?i)(api[_ -]?key|authorization|bearer|password|token)s*[:=]\s*\S+', '$1=[redacted]')
    $message = [regex]::Replace($message, '(?i)https?://\S+', "[url]")
    $message = [regex]::Replace($message, '\s+', " ").Trim()
    if ([string]::IsNullOrWhiteSpace($message)) { $message = "unknown error" }
    if ($message.Length -gt 256) { $message = $message.Substring(0, 256) }
    return $message
}

function Get-ErrorCode([object]$ErrorRecord) {
    $exception = if ($null -ne $ErrorRecord.Exception) { $ErrorRecord.Exception } else { $ErrorRecord }
    if ($null -ne $exception -and $null -ne $exception.Data -and $exception.Data.Contains("foodmate_error_code")) {
        return [string]$exception.Data["foodmate_error_code"]
    }
    return "SQL_AGENT_E2E_FAILED"
}

function Add-CleanupError([string]$Message) {
    $report.cleanup.errors = @($report.cleanup.errors) + $Message
}

function New-HttpFailure([string]$Method, [int]$StatusCode, [string]$Body) {
    $code = "HTTP_$StatusCode"
    try {
        $json = $Body | ConvertFrom-Json
        $errorNode = Get-Field $json @("error", "data")
        $candidate = Get-Field $errorNode @("code", "error_code")
        if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) { $code = [string]$candidate }
    } catch { }
    $exception = [System.Exception]::new("$Method returned HTTP $StatusCode")
    [void]$exception.Data.Add("foodmate_error_code", $code)
    return $exception
}

function New-ApiContext {
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(45)
    return [pscustomobject]@{ Handler = $handler; Client = $client }
}

function Invoke-Api(
    [object]$ApiContext,
    [string]$Method,
    [string]$Url,
    [object]$Payload = $null,
    [System.Net.Http.HttpContent]$Content = $null,
    [hashtable]$Headers = @{}
) {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Url)
    try {
        if ($null -ne $Payload) {
            $body = $Payload | ConvertTo-Json -Depth 32 -Compress
            $request.Content = [System.Net.Http.StringContent]::new($body, [Text.Encoding]::UTF8, "application/json")
        } elseif ($null -ne $Content) {
            $request.Content = $Content
        }
        foreach ($header in $Headers.GetEnumerator()) {
            [void]$request.Headers.TryAddWithoutValidation([string]$header.Key, [string]$header.Value)
        }
        $response = $ApiContext.Client.SendAsync($request).GetAwaiter().GetResult()
        try {
            $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            if (-not $response.IsSuccessStatusCode) {
                throw (New-HttpFailure $Method ([int]$response.StatusCode) $responseBody)
            }
            if ([string]::IsNullOrWhiteSpace($responseBody)) { return $null }
            return $responseBody | ConvertFrom-Json
        } finally {
            $response.Dispose()
        }
    } finally {
        $request.Dispose()
    }
}

function Get-Csrf([object]$ApiContext) {
    $cookies = $ApiContext.Handler.CookieContainer.GetCookies([Uri]$JavaBaseUrl)
    $cookie = $cookies | Where-Object Name -eq "foodmate_csrf" | Select-Object -First 1
    if ($null -eq $cookie) { throw "foodmate_csrf cookie is missing after login" }
    return $cookie.Value
}

function Invoke-Login([object]$ApiContext) {
    if ([string]::IsNullOrWhiteSpace($AdminUsername) -or [string]::IsNullOrWhiteSpace($AdminPassword)) {
        throw "FOODMATE_E2E_ADMIN_USERNAME and FOODMATE_E2E_ADMIN_PASSWORD are required with -ExecutePaid"
    }
    [void](Invoke-Api -ApiContext $ApiContext -Method "POST" -Url "$JavaBaseUrl/api/auth/login" -Payload (@{ username_or_email = $AdminUsername; password = $AdminPassword }))
    return Get-Csrf $ApiContext
}

function Invoke-AgentPython([string]$Source, [string[]]$Arguments = @()) {
    $encodedSource = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Source))
    $bootstrap = "import base64,sys;exec(base64.b64decode(sys.argv[1]))"
    $output = & docker compose @composeArgs exec -T agent-runtime python -c $bootstrap $encodedSource @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "agent-runtime helper failed" }
    return (($output -join [Environment]::NewLine).Trim())
}

function Get-SqlAgentConfig {
    $source = @'
import json
import os

def alias_for(tier):
    raw = os.environ.get("FOODMATE_MODEL_TIER_" + tier.upper(), "").strip()
    provider, separator, model = raw.partition(":")
    return {"provider": provider, "model": model if separator else ""}

planner_tier = os.environ.get("FOODMATE_SQL_PLANNER_TIER", "standard").strip().lower()
print(json.dumps({
    "mode": os.environ.get("FOODMATE_SQL_PLANNER_MODE", "").strip().lower(),
    "planner_tier": planner_tier,
    "planner_route": alias_for(planner_tier),
    "composer_route": alias_for("high"),
    "base_url_configured": bool(os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_BASE_URL", "").strip()),
    "key_configured": bool(os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_API_KEY", "").strip()),
    "fallback_enabled": os.environ.get("FOODMATE_MODEL_FALLBACK_ENABLED", "false").strip().lower(),
    "price_audit_required": os.environ.get("FOODMATE_MODEL_PRICE_AUDIT_REQUIRED", "false").strip().lower(),
}, sort_keys=True))
'@
    return (Invoke-AgentPython $source) | ConvertFrom-Json
}

function Assert-RealSqlConfig([object]$Config) {
    if ([string]$Config.mode -ne "local") { throw "real SQL Agent execution requires FOODMATE_SQL_PLANNER_MODE=local" }
    $planner = $Config.planner_route
    $composer = $Config.composer_route
    foreach ($route in @($planner, $composer)) {
        if ([string]$route.provider -ne "cloud_primary" -or [string]::IsNullOrWhiteSpace([string]$route.model)) {
            throw "real SQL Agent execution requires cloud Chat routes for planner and composer"
        }
    }
    if (-not [bool]$Config.base_url_configured -or -not [bool]$Config.key_configured) {
        throw "real SQL Agent execution requires a configured cloud Chat provider"
    }
    if ([string]$Config.fallback_enabled -ne "false") { throw "SQL Agent paid execution requires model fallback to be disabled" }
    if ([string]$Config.price_audit_required -ne "true") { throw "SQL Agent paid execution requires model price audit" }
}

function Invoke-PaidGate {
    $source = @'
import json
from paid_execution import PaidExecutionSession

session = PaidExecutionSession.from_environment()
session.begin_scenario("sql-agent")
print(json.dumps({
    "enabled": session.settings.enabled,
    "max_scenarios": session.settings.max_scenarios,
    "max_total_cost_cny": format(session.settings.max_total_cost_cny, "f"),
    "no_retry": session.settings.no_retry,
    "require_cloud": session.settings.require_cloud,
    "scenario": session.scenarios[0],
}, sort_keys=True))
'@
    return (Invoke-AgentPython $source) | ConvertFrom-Json
}

function Wait-HttpReady([string]$Name, [string]$Url, [int]$TimeoutSeconds = 90) {
    $deadline = (Get-Date).ToUniversalTime().AddSeconds($TimeoutSeconds)
    $last = "unknown readiness failure"
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 10
            if ($response.StatusCode -eq 200) { return }
            $last = "HTTP $($response.StatusCode)"
        } catch { $last = Get-SafeSummary $_ }
        Start-Sleep -Seconds 2
    } while ((Get-Date).ToUniversalTime() -lt $deadline)
    throw "$Name readiness did not recover: $last"
}

function Read-Sse(
    [string]$Url,
    [string]$LastEventId,
    [string]$Csrf,
    [int]$TimeoutSeconds,
    [string[]]$StopOnEventTypes = @()
) {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
    $response = $null
    $reader = $null
    $events = [System.Collections.Generic.List[object]]::new()
    $eventId = $null
    $eventType = $null
    $dataLines = [System.Collections.Generic.List[string]]::new()
    try {
        if (-not [string]::IsNullOrWhiteSpace($LastEventId)) { [void]$request.Headers.TryAddWithoutValidation("Last-Event-ID", $LastEventId) }
        if (-not [string]::IsNullOrWhiteSpace($Csrf)) { [void]$request.Headers.TryAddWithoutValidation("X-CSRF-Token", $Csrf) }
        $response = $context.Client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            throw (New-HttpFailure "GET" ([int]$response.StatusCode) $body)
        }
        $reader = [IO.StreamReader]::new($response.Content.ReadAsStream())
        $deadline = (Get-Date).ToUniversalTime().AddSeconds($TimeoutSeconds)
        $lineTask = $null
        while ((Get-Date).ToUniversalTime() -lt $deadline) {
            if ($null -eq $lineTask) { $lineTask = $reader.ReadLineAsync() }
            if (-not $lineTask.Wait(250)) { continue }
            $line = $lineTask.Result
            $lineTask = $null
            if ($null -eq $line) { break }
            if ($line.StartsWith("id:")) { $eventId = $line.Substring(3).Trim(); continue }
            if ($line.StartsWith("event:")) { $eventType = $line.Substring(6).Trim(); continue }
            if ($line.StartsWith("data:")) { [void]$dataLines.Add($line.Substring(5).TrimStart()); continue }
            if ($line -ne "") { continue }
            if (-not [string]::IsNullOrWhiteSpace($eventId) -and -not [string]::IsNullOrWhiteSpace($eventType)) {
                $payload = $null
                $rawData = ($dataLines -join "`n")
                if (-not [string]::IsNullOrWhiteSpace($rawData)) {
                    try { $payload = $rawData | ConvertFrom-Json } catch { $payload = $null }
                }
                [void]$events.Add([pscustomobject]@{
                        sse_event_id = $eventId
                        event_type = $eventType
                        payload = $payload
                    })
                if ($StopOnEventTypes -contains $eventType) { break }
            }
            $eventId = $null
            $eventType = $null
            $dataLines.Clear()
        }
    } finally {
        if ($null -ne $reader) { $reader.Dispose() }
        if ($null -ne $response) { $response.Dispose() }
        $request.Dispose()
    }
    return $events.ToArray()
}

function Assert-UniqueSseIds([object[]]$Events) {
    if ($Events.Count -eq 0) { throw "SQL Agent SSE returned no persisted events" }
    $ids = @($Events | ForEach-Object { [string]$_.sse_event_id })
    if (@($ids | Select-Object -Unique).Count -ne $ids.Count) { throw "SQL Agent SSE returned duplicate event ids" }
    return $ids
}

function Assert-CloudUsage([object[]]$Events, [object]$Config) {
    $usage = @($Events | Where-Object event_type -eq "run.model_usage")
    $scenes = @{}
    foreach ($scene in @("sql_planner", "composer")) {
        $match = $usage | Where-Object {
            [string](Get-Field $_.payload @("scene")) -eq $scene -and
            [string](Get-Field $_.payload @("provider_code", "provider")) -eq "cloud_primary"
        } | Select-Object -First 1
        if ($null -eq $match) { throw "SQL Agent did not record a cloud model usage event for $scene" }
        $scenes[$scene] = [ordered]@{
            provider = [string](Get-Field $match.payload @("provider_code", "provider"))
            model = [string](Get-Field $match.payload @("model_name", "model"))
            status = [string](Get-Field $match.payload @("status"))
        }
        if ($scenes[$scene].model -ne [string]$Config.composer_route.model -and $scene -eq "composer") {
            throw "SQL Agent composer used an unexpected configured model"
        }
        if ($scenes[$scene].model -ne [string]$Config.planner_route.model -and $scene -eq "sql_planner") {
            throw "SQL Agent planner used an unexpected configured model"
        }
    }
    return [ordered]@{ total_model_usage_events = $usage.Count; scenes = $scenes }
}

function Invoke-PostgresJson([long]$RunId) {
    $query = "SELECT json_build_object('sql_audits', (SELECT json_build_object('total', COUNT(*), 'executed', COUNT(*) FILTER (WHERE status='executed'), 'failed', COUNT(*) FILTER (WHERE status NOT IN ('executed'))) FROM sql_query_audits WHERE agent_run_id=$RunId AND is_deleted=FALSE), 'tool_calls', (SELECT COALESCE(json_agg(tool_name ORDER BY tool_call_id), '[]'::json) FROM tool_calls WHERE agent_run_id=$RunId AND is_deleted=FALSE));"
    $raw = & docker exec foodmate-postgres psql -U postgres -d FoodMate -At -v ON_ERROR_STOP=1 -c $query 2>&1
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL SQL Agent evidence query failed" }
    $text = ($raw -join [Environment]::NewLine).Trim()
    if ([string]::IsNullOrWhiteSpace($text)) { throw "PostgreSQL SQL Agent evidence query returned no result" }
    try { return $text | ConvertFrom-Json } catch { throw "PostgreSQL SQL Agent evidence query returned invalid JSON" }
}

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker CLI is required" }
    if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) { throw "Docker Compose file is missing" }
    if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) { throw "project .env is missing" }
    if ($RunTimeoutSeconds -lt 120 -or $RunTimeoutSeconds -gt 900) { throw "RunTimeoutSeconds must be between 120 and 900" }

    if ($ExecutePaid) {
        foreach ($name in $paidEnvironmentNames) {
            $previousPaidEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
        }
        $env:FOODMATE_DOCKER_PAID_EXECUTION_ENABLED = "true"
        $env:FOODMATE_DOCKER_PAID_MAX_SCENARIOS = "1"
        $env:FOODMATE_DOCKER_PAID_MAX_TOTAL_COST_CNY = "5"
        $env:FOODMATE_DOCKER_PAID_NO_RETRY = "true"
        $env:FOODMATE_DOCKER_PAID_REQUIRE_CLOUD = "true"
        $paidEnvironmentChanged = $true
    }

    & docker compose @composeArgs config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose configuration is invalid" }
    if ($ExecutePaid) {
        & docker compose @composeArgs up -d --force-recreate agent-runtime | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "agent-runtime recreation failed" }
    }
    Wait-HttpReady "Java" "$JavaBaseUrl/actuator/health/readiness"
    $agentPort = [Environment]::GetEnvironmentVariable("FOODMATE_AGENT_PORT")
    if ([string]::IsNullOrWhiteSpace($agentPort)) { $agentPort = "9002" }
    Wait-HttpReady "agent-runtime" "http://127.0.0.1:$agentPort/foodmate/internal/health/ready"

    $config = Get-SqlAgentConfig
    Assert-RealSqlConfig $config
    $report.chat = [ordered]@{
        provider = [string]$config.composer_route.provider
        model = [string]$config.composer_route.model
        base_url_configured = [bool]$config.base_url_configured
        key_configured = [bool]$config.key_configured
        fallback_enabled = [string]$config.fallback_enabled
    }
    $report.sql_planner = [ordered]@{
        mode = [string]$config.mode
        tier = [string]$config.planner_tier
        provider = [string]$config.planner_route.provider
        model = [string]$config.planner_route.model
        price_audit_required = [string]$config.price_audit_required
    }
    if (-not $ExecutePaid) {
        $report.finished_at = (Get-Date).ToUniversalTime().ToString("o")
        $report.status = "preflight_passed"
    } else {
        $report.paid_gate = Invoke-PaidGate
        if (-not $report.paid_gate.enabled -or $report.paid_gate.scenario -ne "sql-agent" -or
            -not $report.paid_gate.require_cloud -or -not $report.paid_gate.no_retry) {
            throw "paid execution gate is not fail-closed for sql-agent"
        }

        $context = New-ApiContext
        $csrf = Invoke-Login $context
        $prompt = "请分析我最近 7 天按餐次的蛋白质和热量摄入，只查询我已保存的饮食记录。只读查询，不要修改记录，也不要编造数据。"
        $runResponse = Invoke-Api -ApiContext $context -Method "POST" -Url "$JavaBaseUrl/api/chat/runs" -Payload (@{ prompt = $prompt }) -Headers (@{ "X-CSRF-Token" = $csrf })
        $runData = Get-Field $runResponse @("data")
        $report.run_id = [string](Get-Field $runData @("run_id", "runId"))
        $report.session_id = [string](Get-Field $runData @("session_id", "sessionId"))
        if ([string]::IsNullOrWhiteSpace($report.run_id) -or [string]::IsNullOrWhiteSpace($report.session_id)) { throw "SQL Agent Run identifiers are missing" }
        $runIdNumber = 0L
        if (-not [long]::TryParse($report.run_id, [ref]$runIdNumber) -or $runIdNumber -lt 1) { throw "SQL Agent Run id is invalid" }

        $events = @(Read-Sse "$JavaBaseUrl/api/agent-runs/$($report.run_id)/stream" "0" $csrf $RunTimeoutSeconds @("run.completed", "run.failed", "run.cancelled"))
        $eventIds = @(Assert-UniqueSseIds $events)
        $terminalEvents = @($events | Where-Object { @("run.completed", "run.failed", "run.cancelled") -contains $_.event_type })
        $completedEvents = @($events | Where-Object event_type -eq "run.completed")
        if ($completedEvents.Count -ne 1 -or $terminalEvents.Count -ne 1) { throw "SQL Agent did not produce exactly one completed terminal event" }
        $completedPayload = $completedEvents[0].payload
        $answer = [string](Get-Field $completedPayload @("answer"))
        if ([string]::IsNullOrWhiteSpace($answer)) { throw "SQL Agent run.completed answer is empty" }
        if ([string](Get-Field $completedPayload @("result_type")) -notin @("normal", "safety_degraded")) { throw "SQL Agent terminal result type is invalid" }
        $report.sse = [ordered]@{
            event_count = $events.Count
            first_event_id = $eventIds[0]
            last_event_id = $eventIds[-1]
            terminal_event_count = $terminalEvents.Count
            terminal = "run.completed"
            cloud_usage = Assert-CloudUsage $events $config
        }

        $evidence = Invoke-PostgresJson $runIdNumber
        $toolNames = @((Get-Field $evidence @("tool_calls"))) | ForEach-Object { [string]$_ }
        foreach ($requiredTool in @("time_parser", "database_query")) {
            if ($toolNames -notcontains $requiredTool) { throw "SQL Agent did not execute required tool: $requiredTool" }
        }
        $sqlAudits = Get-Field $evidence @("sql_audits")
        if ([int](Get-Field $sqlAudits @("total")) -lt 1 -or [int](Get-Field $sqlAudits @("executed")) -lt 1) { throw "SQL Agent did not create an executed SQL audit" }
        $report.tool_calls = [ordered]@{ names = $toolNames; required = @("time_parser", "database_query") }
        $report.sql_audit = [ordered]@{
            total = [int](Get-Field $sqlAudits @("total"))
            executed = [int](Get-Field $sqlAudits @("executed"))
            failed = [int](Get-Field $sqlAudits @("failed"))
        }

        if ($eventIds.Count -lt 2) { throw "SQL Agent SSE stream is too short for replay assertion" }
        $replayEvents = @(Read-Sse "$JavaBaseUrl/api/agent-runs/$($report.run_id)/stream" $eventIds[$eventIds.Count - 2] $csrf $RunTimeoutSeconds @("run.completed", "run.failed", "run.cancelled"))
        $replayIds = @(Assert-UniqueSseIds $replayEvents)
        if (@($replayEvents | Where-Object event_type -eq "run.completed").Count -ne 1) { throw "SQL Agent Last-Event-ID replay did not return the terminal event" }
        if ($replayIds[-1] -ne $eventIds[-1]) { throw "SQL Agent Last-Event-ID replay ended at a different event" }
        $report.sse.replay_event_count = $replayEvents.Count
        $report.sse.replay_terminal_count = @($replayEvents | Where-Object event_type -eq "run.completed").Count
        $report.status = "passed"
    }
} catch {
    $report.status = "failed"
    $report.error_code = Get-ErrorCode $_
    $report.error_summary = Get-SafeSummary $_
} finally {
    if (-not $KeepData -and $null -ne $context) {
        try { $csrfForCleanup = Get-Csrf $context } catch { $csrfForCleanup = $null }
        if (-not [string]::IsNullOrWhiteSpace([string]$report.session_id) -and $null -ne $csrfForCleanup) {
            try {
                [void](Invoke-Api -ApiContext $context -Method "DELETE" -Url "$JavaBaseUrl/api/sessions/$($report.session_id)" -Headers (@{ "X-CSRF-Token" = $csrfForCleanup }))
                $report.cleanup.session_soft_deleted = $true
            } catch { Add-CleanupError "session cleanup failed" }
        }
        $context.Client.Dispose()
    }
    if ($paidEnvironmentChanged) {
        foreach ($name in $paidEnvironmentNames) {
            $oldValue = $previousPaidEnvironment[$name]
            if ($null -eq $oldValue) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } else { Set-Item "Env:$name" $oldValue }
        }
        try {
            & docker compose @composeArgs up -d --force-recreate agent-runtime | Out-Null
            if ($LASTEXITCODE -ne 0) { Add-CleanupError "runtime configuration restore failed" }
        } catch { Add-CleanupError "runtime configuration restore failed" }
    }
    $report.finished_at = (Get-Date).ToUniversalTime().ToString("o")
}

$report.cleanup.errors = @($report.cleanup.errors)
Write-Output ($report | ConvertTo-Json -Depth 24)
if ($report.status -eq "failed") { exit 1 }

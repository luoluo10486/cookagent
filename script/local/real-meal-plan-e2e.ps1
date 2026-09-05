[CmdletBinding()]
param(
    [string]$JavaBaseUrl = "http://127.0.0.1:8080",
    [int]$RunTimeoutSeconds = 240,
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
    run_id = $null
    session_id = $null
    approval_request_id = $null
    run_initial_sse = $null
    run_terminal_sse = $null
    approval = $null
    meal_plan = $null
    shopping_list = $null
    cleanup = [ordered]@{
        requested = (-not $KeepData)
        meal_plan_deleted = $false
        session_soft_deleted = $false
        errors = @()
    }
    error_code = $null
    error_summary = $null
}

$context = $null
$mealPlanId = $null
$mealPlanRevision = $null
$sessionId = $null
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
    return "MEAL_PLAN_E2E_FAILED"
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

function New-ApiContext([int]$TimeoutSeconds = 45) {
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds([math]::Max(45, $TimeoutSeconds))
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

function Get-ChatConfig {
    $source = @'
import json
import os

alias = os.environ.get("FOODMATE_MODEL_TIER_HIGH", "").strip()
provider, separator, model = alias.partition(":")
print(json.dumps({
    "provider": provider,
    "model": model if separator else "",
    "base_url_configured": bool(os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_BASE_URL", "").strip()),
    "key_configured": bool(os.environ.get("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_API_KEY", "").strip()),
    "fallback_enabled": os.environ.get("FOODMATE_MODEL_FALLBACK_ENABLED", "false").strip().lower(),
}, sort_keys=True))
'@
    return (Invoke-AgentPython $source) | ConvertFrom-Json
}

function Assert-RealChatConfig([object]$Config) {
    if ([string]$Config.provider -ne "cloud_primary" -or
        [string]::IsNullOrWhiteSpace([string]$Config.model) -or
        -not [bool]$Config.base_url_configured -or
        -not [bool]$Config.key_configured) {
        throw "real meal plan execution requires a configured cloud Chat provider"
    }
    if ([string]$Config.fallback_enabled -ne "false") {
        throw "meal plan paid execution requires model fallback to be disabled"
    }
}

function Invoke-PaidGate {
    $source = @'
import json
from paid_execution import PaidExecutionSession

session = PaidExecutionSession.from_environment()
session.begin_scenario("meal-plan")
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
        } catch {
            $last = Get-SafeSummary $_
        }
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
    if ($Events.Count -eq 0) { throw "AgentRun SSE returned no persisted events" }
    $ids = @($Events | ForEach-Object { [string]$_.sse_event_id })
    if (@($ids | Select-Object -Unique).Count -ne $ids.Count) { throw "AgentRun SSE returned duplicate event ids" }
    return $ids
}

function Assert-CloudModelUsage([object[]]$Events, [object]$Config) {
    $matches = @($Events | Where-Object {
            if ($_.event_type -ne "run.model_usage") { return $false }
            $provider = [string](Get-Field $_.payload @("provider_code", "provider"))
            $model = [string](Get-Field $_.payload @("model_name", "model"))
            $provider -eq [string]$Config.provider -and $model -eq [string]$Config.model
        })
    if ($matches.Count -eq 0) { throw "AgentRun did not record the configured cloud Chat provider/model" }
    return $matches.Count
}

function Assert-MealPlanCandidate([object]$Payload) {
    $details = Get-Field $Payload @("details")
    $plan = Get-Field $details @("plan")
    if ($null -eq $plan) { throw "meal plan clarification does not contain a safe plan candidate" }
    if ([string]::IsNullOrWhiteSpace([string](Get-Field $plan @("plan_name")))) { throw "meal plan candidate name is missing" }
    $days = [int](Get-Field $plan @("days"))
    $daysPlan = @(Get-Field $plan @("days_plan"))
    if ($days -lt 1 -or $days -gt 7 -or $daysPlan.Count -ne $days) { throw "meal plan candidate days are invalid" }
    foreach ($field in @("people", "budget")) {
        if ($null -eq (Get-Field $plan @($field))) { throw "meal plan candidate field is missing: $field" }
    }
    return $plan
}

function Assert-MealPlanResponse([object]$Response, [string]$ExpectedId) {
    $data = Get-Field $Response @("data")
    $id = [string](Get-Field $data @("meal_plan_id", "mealPlanId"))
    if ($id -ne $ExpectedId) { throw "meal plan response id does not match execution result" }
    if ([string](Get-Field $data @("status")) -ne "saved") { throw "meal plan did not reach saved status" }
    if ([bool](Get-Field $data @("deleted"))) { throw "meal plan is unexpectedly deleted" }
    return $data
}

function Assert-ShoppingListResponse([object]$Response, [string]$ExpectedPlanId) {
    $data = Get-Field $Response @("data")
    $planId = [string](Get-Field $data @("meal_plan_id", "mealPlanId"))
    $listId = [string](Get-Field $data @("shopping_list_id", "shoppingListId"))
    if ($planId -ne $ExpectedPlanId -or [string]::IsNullOrWhiteSpace($listId)) { throw "shopping list is missing or bound to another plan" }
    if ((@(Get-Field $data @("items"))).Count -eq 0) { throw "shopping list has no generated items" }
    return $data
}

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker CLI is required" }
    if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) { throw "Docker Compose file is missing" }
    if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) { throw "project .env is missing" }
    if ($RunTimeoutSeconds -lt 60 -or $RunTimeoutSeconds -gt 900) { throw "RunTimeoutSeconds must be between 60 and 900" }

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

    $chatConfig = Get-ChatConfig
    Assert-RealChatConfig $chatConfig
    $report.chat = [ordered]@{
        provider = [string]$chatConfig.provider
        model = [string]$chatConfig.model
        base_url_configured = [bool]$chatConfig.base_url_configured
        key_configured = [bool]$chatConfig.key_configured
        fallback_enabled = [string]$chatConfig.fallback_enabled
    }
    if (-not $ExecutePaid) {
        $report.finished_at = (Get-Date).ToUniversalTime().ToString("o")
        $report.status = "preflight_passed"
    } else {
        $report.paid_gate = Invoke-PaidGate
        if (-not $report.paid_gate.enabled -or $report.paid_gate.scenario -ne "meal-plan" -or
            -not $report.paid_gate.require_cloud -or -not $report.paid_gate.no_retry) {
            throw "paid execution gate is not fail-closed for meal-plan"
        }

        # SSE 请求会持续整个 AgentRun，云端 Proposal 生成可能超过普通控制面请求的短超时。
        $context = New-ApiContext ($RunTimeoutSeconds + 30)
        $csrf = Invoke-Login $context
        # 控制付费验收请求体大小，避免超过模型输出预算，同时覆盖完整计划流程。
        $prompt = "请为我生成一个1天的家庭餐食计划，2人，当日预算不超过200元，目标是均衡蛋白质和蔬菜；必须给出早餐、午餐、晚餐及各自食材，生成候选后等待我确认保存。"
        $runResponse = Invoke-Api -ApiContext $context -Method "POST" -Url "$JavaBaseUrl/api/chat/runs" -Payload (@{ prompt = $prompt }) -Headers (@{ "X-CSRF-Token" = $csrf })
        $runData = Get-Field $runResponse @("data")
        $report.run_id = [string](Get-Field $runData @("run_id", "runId"))
        $sessionId = [string](Get-Field $runData @("session_id", "sessionId"))
        $report.session_id = $sessionId
        if ([string]::IsNullOrWhiteSpace($report.run_id)) { throw "AgentRun id is missing" }

        $initialEvents = @(Read-Sse "$JavaBaseUrl/api/agent-runs/$($report.run_id)/stream" "0" $csrf $RunTimeoutSeconds @("run.clarification_requested", "run.completed", "run.failed", "run.cancelled"))
        $initialIds = @(Assert-UniqueSseIds $initialEvents)
        $report.run_initial_sse = [ordered]@{
            event_count = $initialEvents.Count
            first_event_id = $initialIds[0]
            last_event_id = $initialIds[-1]
            cloud_model_event_count = Assert-CloudModelUsage $initialEvents $chatConfig
        }
        $clarifications = @($initialEvents | Where-Object event_type -eq "run.clarification_requested")
        $initialTerminals = @($initialEvents | Where-Object { @("run.completed", "run.failed", "run.cancelled") -contains $_.event_type })
        if ($clarifications.Count -ne 1 -or $initialTerminals.Count -ne 0) { throw "meal plan AgentRun did not stop at exactly one confirmation clarification" }
        $plan = Assert-MealPlanCandidate $clarifications[0].payload
        $report.approval_request_id = [string](Get-Field $clarifications[0].payload @("approval_request_id"))
        if ([string]::IsNullOrWhiteSpace($report.approval_request_id)) { throw "meal plan approval request id is missing" }

        $approval = Invoke-Api $context "GET" "$JavaBaseUrl/api/approvals/$($report.approval_request_id)"
        $approvalData = Get-Field $approval @("data")
        if ([string](Get-Field $approvalData @("status")) -ne "pending") { throw "meal plan approval is not pending" }
        if ([string](Get-Field $approvalData @("operation")) -ne "save_plan" -or [string](Get-Field $approvalData @("resource_type", "resourceType")) -ne "meal_plan") { throw "meal plan approval contract is invalid" }
        $report.approval = [ordered]@{ status_before_confirm = [string](Get-Field $approvalData @("status")); operation = [string](Get-Field $approvalData @("operation")); resource_type = [string](Get-Field $approvalData @("resource_type", "resourceType")) }

        $confirmParameters = @{ plan = $plan }
        $confirmed = Invoke-Api -ApiContext $context -Method "POST" -Url "$JavaBaseUrl/api/approvals/$($report.approval_request_id)/confirm" -Payload $confirmParameters -Headers (@{ "X-CSRF-Token" = $csrf })
        $confirmedData = Get-Field $confirmed @("data")
        if ([string](Get-Field $confirmedData @("status")) -ne "confirmed") { throw "meal plan approval confirmation did not succeed" }

        $executed = Invoke-Api -ApiContext $context -Method "POST" -Url "$JavaBaseUrl/api/approvals/$($report.approval_request_id)/execute" -Payload $confirmParameters -Headers (@{ "X-CSRF-Token" = $csrf })
        $executedData = Get-Field $executed @("data")
        if ([string](Get-Field $executedData @("status")) -ne "executed") { throw "meal plan approval execution did not succeed" }
        $mealPlanId = [string](Get-Field $executedData @("resource_id", "resourceId"))
        if ([string]::IsNullOrWhiteSpace($mealPlanId)) { throw "executed meal plan id is missing" }
        $report.meal_plan_id = $mealPlanId
        $report.shopping_list_id = [string](Get-Field $executedData @("secondary_resource_id", "secondaryResourceId"))

        $terminalEvents = @(Read-Sse "$JavaBaseUrl/api/agent-runs/$($report.run_id)/stream" $initialIds[-1] $csrf $RunTimeoutSeconds @("run.completed", "run.failed", "run.cancelled"))
        $terminalIds = @(Assert-UniqueSseIds $terminalEvents)
        $completedEvents = @($terminalEvents | Where-Object event_type -eq "run.completed")
        $terminalTypes = @($terminalEvents | Where-Object { @("run.completed", "run.failed", "run.cancelled") -contains $_.event_type })
        if ($completedEvents.Count -ne 1 -or $terminalTypes.Count -ne 1) { throw "meal plan AgentRun did not produce exactly one completed terminal event" }
        $completedPayload = $completedEvents[0].payload
        if ([string](Get-Field $completedPayload @("meal_plan_id", "mealPlanId")) -ne $mealPlanId) { throw "run.completed meal plan id does not match Java execution" }
        $report.run_terminal_sse = [ordered]@{ event_count = $terminalEvents.Count; first_event_id = $terminalIds[0]; last_event_id = $terminalIds[-1]; terminal = "run.completed"; citation_count = @(Get-Field $completedPayload @("citations")).Count }

        $planResponse = Invoke-Api $context "GET" "$JavaBaseUrl/api/meal-plans/$mealPlanId"
        $planData = Assert-MealPlanResponse $planResponse $mealPlanId
        $mealPlanRevision = [long](Get-Field $planData @("revision"))
        $report.meal_plan = [ordered]@{ id = $mealPlanId; status = [string](Get-Field $planData @("status")); revision = $mealPlanRevision; days = [int](Get-Field $planData @("days")) }
        $shoppingResponse = Invoke-Api $context "GET" "$JavaBaseUrl/api/meal-plans/$mealPlanId/shopping-list"
        $shoppingData = Assert-ShoppingListResponse $shoppingResponse $mealPlanId
        $report.shopping_list = [ordered]@{ id = [string](Get-Field $shoppingData @("shopping_list_id", "shoppingListId")); meal_plan_id = $mealPlanId; item_count = @(Get-Field $shoppingData @("items")).Count; status = [string](Get-Field $shoppingData @("status")) }
        $report.status = "passed"
    }
} catch {
    $report.status = "failed"
    $report.error_code = Get-ErrorCode $_
    $report.error_summary = Get-SafeSummary $_
} finally {
    if (-not $KeepData -and $null -ne $context) {
        try { $csrfForCleanup = Get-Csrf $context } catch { $csrfForCleanup = $null }
        if (-not [string]::IsNullOrWhiteSpace([string]$mealPlanId) -and $null -ne $csrfForCleanup -and $null -ne $mealPlanRevision) {
            try {
                $cleanupKey = "codex-r3-meal-plan-cleanup-" + [guid]::NewGuid().ToString("N")
                [void](Invoke-Api -ApiContext $context -Method "DELETE" -Url "$JavaBaseUrl/api/meal-plans/$mealPlanId`?revision=$mealPlanRevision" -Headers (@{ "X-CSRF-Token" = $csrfForCleanup; "Idempotency-Key" = $cleanupKey }))
                $report.cleanup.meal_plan_deleted = $true
            } catch { Add-CleanupError "meal plan cleanup failed" }
        }
        if (-not [string]::IsNullOrWhiteSpace([string]$sessionId) -and $null -ne $csrfForCleanup) {
            try {
                [void](Invoke-Api -ApiContext $context -Method "DELETE" -Url "$JavaBaseUrl/api/sessions/$sessionId" -Headers (@{ "X-CSRF-Token" = $csrfForCleanup }))
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
Write-Output ($report | ConvertTo-Json -Depth 20)
if ($report.status -eq "failed") { exit 1 }

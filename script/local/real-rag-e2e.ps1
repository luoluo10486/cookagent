[CmdletBinding()]
param(
    [string]$JavaBaseUrl = "http://127.0.0.1:8080",
    [Alias("DocumentPath")]
    [string[]]$DocumentPaths = @(),
    [int]$BatchTimeoutSeconds = 300,
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
    rag = $null
    paid_gate = $null
    batch_id = $null
    document_ids = @()
    item_ids = @()
    batch_status = $null
    batch_sse = $null
    search = $null
    run_id = $null
    run_sse = $null
    cleanup = [ordered]@{
        requested = (-not $KeepData)
        documents_deleted = 0
        session_soft_deleted = $false
        errors = @()
    }
    error_code = $null
    error_summary = $null
}

$context = $null
$batchId = $null
$documentIds = [System.Collections.Generic.List[long]]::new()
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
    $message = [regex]::Replace($message, "(?i)(api[_ -]?key|authorization|bearer|password|token)\s*[:=]\s*\S+", '$1=[redacted]')
    $message = [regex]::Replace($message, "(?i)https?://[^\s]+", "[url]")
    $message = [regex]::Replace($message, "\s+", " ").Trim()
    if ([string]::IsNullOrWhiteSpace($message)) { $message = "unknown error" }
    if ($message.Length -gt 256) { $message = $message.Substring(0, 256) }
    return $message
}

function Get-ErrorCode([object]$ErrorRecord) {
    $exception = if ($null -ne $ErrorRecord.Exception) { $ErrorRecord.Exception } else { $ErrorRecord }
    if ($null -ne $exception -and $null -ne $exception.Data -and $exception.Data.Contains("foodmate_error_code")) {
        return [string]$exception.Data["foodmate_error_code"]
    }
    return "RAG_E2E_FAILED"
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
            $body = $Payload | ConvertTo-Json -Depth 16 -Compress
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
    [void](Invoke-Api $ApiContext "POST" "$JavaBaseUrl/api/auth/login" @{ username_or_email = $AdminUsername; password = $AdminPassword })
    return Get-Csrf $ApiContext
}

function Invoke-AgentPython([string]$Source, [string[]]$Arguments = @()) {
    $encodedSource = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Source))
    $bootstrap = "import base64,sys;exec(base64.b64decode(sys.argv[1]))"
    $output = & docker compose @composeArgs exec -T agent-runtime python -c $bootstrap $encodedSource @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "agent-runtime helper failed" }
    return (($output -join [Environment]::NewLine).Trim())
}

function Get-RagConfig {
    $source = @'
import json
import os

def present(name):
    return bool(os.environ.get(name, "").strip())

standard = os.environ.get("FOODMATE_MODEL_TIER_STANDARD", "").strip()
provider, separator, model = standard.partition(":")
print(json.dumps({
    "rag_mode": os.environ.get("FOODMATE_RAG_MODE", "").strip(),
    "embedding_provider": os.environ.get("FOODMATE_RAG_EMBEDDING_PROVIDER", "").strip(),
    "embedding_profile": os.environ.get("FOODMATE_RAG_EMBEDDING_PROFILE", "").strip(),
    "embedding_model": os.environ.get("FOODMATE_RAG_EMBEDDING_MODEL", "").strip(),
    "embedding_base_url_configured": present("FOODMATE_RAG_EMBEDDING_BASE_URL"),
    "embedding_key_configured": present("FOODMATE_RAG_EMBEDDING_API_KEY"),
    "milvus_uri_configured": present("FOODMATE_RAG_MILVUS_URI"),
    "milvus_collection": os.environ.get("FOODMATE_RAG_MILVUS_COLLECTION", "").strip(),
    "chat_provider": provider if separator else "",
    "chat_model": model if separator else "",
    "chat_base_url_configured": present("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_BASE_URL"),
    "chat_key_configured": present("FOODMATE_MODEL_PROVIDER_CLOUD_PRIMARY_API_KEY"),
}, sort_keys=True))
'@
    return (Invoke-AgentPython $source) | ConvertFrom-Json
}

function Assert-RealRagConfig([object]$Config) {
    $required = @(
        @($Config.rag_mode, "local"),
        @($Config.embedding_provider, "openai-compatible"),
        @($Config.embedding_base_url_configured, $true),
        @($Config.embedding_key_configured, $true),
        @($Config.milvus_uri_configured, $true),
        @($Config.chat_provider, "cloud_primary"),
        @($Config.chat_base_url_configured, $true),
        @($Config.chat_key_configured, $true)
    )
    foreach ($pair in $required) {
        if ($pair[0] -ne $pair[1]) { throw "real RAG configuration is incomplete or not cloud-backed" }
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.milvus_collection)) { throw "Milvus collection is not configured" }
}

function Invoke-PaidGate {
    $source = @'
import json
from paid_execution import PaidExecutionSession

session = PaidExecutionSession.from_environment()
session.begin_scenario("rag")
print(json.dumps({
    "enabled": session.settings.enabled,
    "max_scenarios": session.settings.max_scenarios,
    "max_total_cost_cny": format(session.settings.max_total_cost_cny, "f"),
    "no_retry": session.settings.no_retry,
    "require_cloud": session.settings.require_cloud,
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

function Get-Documents {
    if ($DocumentPaths.Count -gt 5) { throw "R1 accepts at most 5 documents" }
    $documents = [System.Collections.Generic.List[object]]::new()
    if ($DocumentPaths.Count -eq 0) {
        $samples = @(
            @{ name = "codex-public-nutrition-basics.md"; content = "# Public Nutrition Basics`n`n## Protein`nA balanced meal can include beans, eggs, fish, tofu, and other protein foods. Protein supports tissue maintenance and satiety.`n`n## Energy`nUse portions and meal balance to support an appropriate daily energy intake." },
            @{ name = "codex-public-balanced-meals.md"; content = "# Public Balanced Meals`n`n## Meal Structure`nA practical plate combines vegetables, a protein source, and a measured portion of grains or other carbohydrate foods.`n`n## Fiber`nVegetables, fruit, beans, and whole grains provide dietary fiber." },
            @{ name = "codex-public-sodium-guide.md"; content = "# Public Sodium Guide`n`n## Sodium`nCompare nutrition labels, prefer fresh ingredients, and limit highly processed foods when reducing sodium intake.`n`n## Practical Choice`nHerbs, citrus, and spices can add flavor without relying on extra salt." }
        )
        foreach ($sample in $samples) {
            [void]$documents.Add([pscustomobject]@{
                    name = $sample.name
                    content_type = "text/markdown"
                    bytes = [Text.Encoding]::UTF8.GetBytes($sample.content)
                })
        }
        return $documents.ToArray()
    }
    if ($DocumentPaths.Count -lt 1) { throw "at least one document is required" }
    foreach ($path in $DocumentPaths) {
        $resolved = (Resolve-Path -LiteralPath $path -ErrorAction Stop).Path
        $name = [IO.Path]::GetFileName($resolved)
        $extension = [IO.Path]::GetExtension($name).ToLowerInvariant()
        $contentType = switch ($extension) {
            ".md" { "text/markdown" }
            ".txt" { "text/plain" }
            ".pdf" { "application/pdf" }
            ".docx" { "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
            default { throw "unsupported R1 document extension" }
        }
        $bytes = [IO.File]::ReadAllBytes($resolved)
        if ($bytes.Length -eq 0 -or $bytes.Length -gt 20MB) { throw "R1 document size is invalid" }
        [void]$documents.Add([pscustomobject]@{ name = $name; content_type = $contentType; bytes = $bytes })
    }
    return $documents.ToArray()
}

function New-KnowledgeMultipart([object[]]$Documents, [string]$IdempotencyKey) {
    $multipart = [System.Net.Http.MultipartFormDataContent]::new()
    $fields = [ordered]@{
        source_type = "admin_upload"
        source_name = "FoodMate public nutrition evidence"
        source_version = "codex-r1-v1"
        license_notice = "Local test material for FoodMate business-path verification"
        idempotency_key = $IdempotencyKey
    }
    foreach ($field in $fields.GetEnumerator()) {
        $part = [System.Net.Http.StringContent]::new([string]$field.Value, [Text.Encoding]::UTF8)
        [void]$multipart.Add($part, [string]$field.Key)
    }
    foreach ($document in $Documents) {
        $part = [System.Net.Http.ByteArrayContent]::new([byte[]]$document.bytes)
        $part.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse([string]$document.content_type)
        [void]$multipart.Add($part, "files", [string]$document.name)
    }
    # MultipartFormDataContent 可枚举，必须保持为单个 HttpContent 传入上传请求。
    return ,$multipart
}

function Get-BatchState([object]$Response) {
    $batch = Get-Field $Response.data @("batch")
    $job = Get-Field $batch @("job")
    $items = @(Get-Field $batch @("items"))
    return [pscustomobject]@{
        job = $job
        status = [string](Get-Field $job @("status"))
        items = $items
    }
}

function Wait-Batch([long]$Id, [string]$Csrf) {
    $deadline = (Get-Date).ToUniversalTime().AddSeconds($BatchTimeoutSeconds)
    $last = $null
    do {
        $last = Get-BatchState (Invoke-Api $context "GET" "$JavaBaseUrl/api/admin/knowledge-upload-batches/$Id")
        $active = @($last.items | Where-Object { @("pending", "parsing", "parsed", "indexing") -contains [string](Get-Field $_ @("index_status")) })
        if ($active.Count -eq 0 -and @("completed", "partial_failed", "failed") -contains $last.status) { return $last }
        Start-Sleep -Seconds 2
    } while ((Get-Date).ToUniversalTime() -lt $deadline)
    throw "knowledge batch did not converge before timeout"
}

function Read-Sse([string]$Url, [string]$LastEventId, [string]$Csrf, [int]$TimeoutSeconds) {
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

function Assert-BatchSse([long]$Id, [string]$Csrf) {
    $events = @(Read-Sse "$JavaBaseUrl/api/admin/knowledge-upload-batches/$Id/events" "0" $Csrf 8)
    if ($events.Count -eq 0) { throw "batch SSE did not return persisted progress events" }
    $ids = @($events | ForEach-Object { [long]$_.sse_event_id })
    if (@($ids | Select-Object -Unique).Count -ne $ids.Count) { throw "batch SSE returned duplicate event ids" }
    if (@($events | Where-Object event_type -eq "knowledge.index.indexed").Count -eq 0) { throw "batch SSE is missing indexed event" }
    if (@($events | Where-Object event_type -eq "knowledge.batch.progress").Count -eq 0) { throw "batch SSE is missing progress event" }
    $replay = @(Read-Sse "$JavaBaseUrl/api/admin/knowledge-upload-batches/$Id/events" ([string]$ids[0]) $Csrf 5)
    if (@($replay | Where-Object { [long]$_.sse_event_id -le $ids[0] }).Count -ne 0) { throw "batch SSE Last-Event-ID replay returned an old event" }
    return [ordered]@{ event_count = $events.Count; indexed_events = @($events | Where-Object event_type -eq "knowledge.index.indexed").Count; replay_count = $replay.Count; first_event_id = $ids[0]; last_event_id = $ids[-1] }
}

function Assert-Citations([object[]]$Citations, [long[]]$ExpectedDocumentIds) {
    if ($Citations.Count -eq 0 -or $Citations.Count -gt 4) { throw "R1 citation count is outside the business limit" }
    $serialized = $Citations | ConvertTo-Json -Depth 12 -Compress
    if ($serialized -match "(?i)https?://|object[_ -]?key|presign|api[_ -]?key|authorization|prompt") { throw "R1 citation payload contains a forbidden field" }
    foreach ($citation in $Citations) {
        foreach ($field in @(@("citation_id", "citationId"), @("document_id", "documentId"), @("title"), @("version"), @("snippet"))) {
            if ([string]::IsNullOrWhiteSpace([string](Get-Field $citation $field))) { throw "R1 citation is missing required safe metadata" }
        }
    }
    $matched = @($Citations | Where-Object { $ExpectedDocumentIds -contains [long](Get-Field $_ @("document_id", "documentId")) })
    if ($matched.Count -eq 0) { throw "R1 citations do not reference the indexed batch" }
    return $Citations
}

function Wait-PublicSearch([string]$Query, [long[]]$ExpectedDocumentIds, [string]$Csrf, [bool]$ExpectHits, [int]$TimeoutSeconds = 90) {
    $deadline = (Get-Date).ToUniversalTime().AddSeconds($TimeoutSeconds)
    $lastCitations = @()
    do {
        $response = Invoke-Api $context "POST" "$JavaBaseUrl/api/knowledge-base/search" @{ query = $Query } $null @{ "X-CSRF-Token" = $Csrf }
        $lastCitations = @(Get-Field $response.data @("citations"))
        if ($ExpectHits) {
            if ($lastCitations.Count -gt 0) {
                [void](Assert-Citations $lastCitations $ExpectedDocumentIds)
                return $lastCitations
            }
        } elseif ($lastCitations.Count -eq 0) {
            return $lastCitations
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date).ToUniversalTime() -lt $deadline)
    if ($ExpectHits) { throw "public search did not observe the published document before timeout" }
    throw "public search still returned disabled documents before timeout"
}

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker CLI is required" }
    if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) { throw "Docker Compose file is missing" }
    if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) { throw "project .env is missing" }
    if ($BatchTimeoutSeconds -lt 30 -or $BatchTimeoutSeconds -gt 1800) { throw "BatchTimeoutSeconds must be between 30 and 1800" }

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

    $ragConfig = Get-RagConfig
    Assert-RealRagConfig $ragConfig
    $report.rag = [ordered]@{
        mode = [string]$ragConfig.rag_mode
        embedding_provider = [string]$ragConfig.embedding_provider
        embedding_profile = [string]$ragConfig.embedding_profile
        embedding_model = [string]$ragConfig.embedding_model
        milvus_collection = [string]$ragConfig.milvus_collection
        chat_provider = [string]$ragConfig.chat_provider
        chat_model = [string]$ragConfig.chat_model
        embedding_key_configured = [bool]$ragConfig.embedding_key_configured
        chat_key_configured = [bool]$ragConfig.chat_key_configured
    }
    if (-not $ExecutePaid) {
        $report.finished_at = (Get-Date).ToUniversalTime().ToString("o")
        $report.status = "preflight_passed"
    } else {
        $report.paid_gate = Invoke-PaidGate
        if (-not $report.paid_gate.enabled -or -not $report.paid_gate.require_cloud -or -not $report.paid_gate.no_retry) { throw "paid execution gate is not fail-closed" }
        $context = New-ApiContext
        $csrf = Invoke-Login $context
        $documents = @(Get-Documents)
        $idempotencyKey = "codex-r1-" + [guid]::NewGuid().ToString("N")
        $multipart = New-KnowledgeMultipart $documents $idempotencyKey
        $uploadHeaders = @{ "X-CSRF-Token" = $csrf; "Idempotency-Key" = $idempotencyKey }
        try {
            $upload = Invoke-Api $context "POST" "$JavaBaseUrl/api/admin/knowledge-documents/upload-batches" $null $multipart $uploadHeaders
        } finally {
            $multipart.Dispose()
        }
        $batchId = [long](Get-Field $upload.data @("batch_id", "batchId"))
        if ($batchId -le 0) { throw "knowledge batch id is missing" }
        $report.batch_id = $batchId
        $state = Wait-Batch $batchId $csrf
        $report.batch_status = $state.status
        foreach ($item in $state.items) {
            $docId = [long](Get-Field $item @("document_id", "documentId"))
            $itemId = [long](Get-Field $item @("item_id", "itemId"))
            if ($docId -gt 0) { [void]$documentIds.Add($docId) }
            if ($itemId -gt 0) { $report.item_ids += $itemId }
        }
        $report.document_ids = @($documentIds)
        if ($state.status -ne "completed" -or $documentIds.Count -ne $documents.Count) { throw "knowledge batch did not complete successfully" }
        $report.batch_sse = Assert-BatchSse $batchId $csrf

        foreach ($docId in $documentIds) {
            [void](Invoke-Api $context "POST" "$JavaBaseUrl/api/admin/knowledge-documents/$docId/publish" $null $null @{ "X-CSRF-Token" = $csrf })
        }
        Start-Sleep -Seconds 1
        $query = "What do the public nutrition guides recommend about protein, balanced meals, and sodium?"
        $searchCitations = @(Wait-PublicSearch $query ([long[]]$documentIds) $csrf $true)
        $digest = [Security.Cryptography.SHA256]::Create()
        try { $queryDigest = [BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($query))).Replace("-", "").ToLowerInvariant() } finally { $digest.Dispose() }
        $report.search = [ordered]@{ result = "matched"; citation_count = $searchCitations.Count; query_digest = "sha256:$queryDigest" }

        $runResponse = Invoke-Api $context "POST" "$JavaBaseUrl/api/chat/runs" @{ prompt = $query } $null @{ "X-CSRF-Token" = $csrf }
        $runData = $runResponse.data
        $report.run_id = [string](Get-Field $runData @("run_id", "runId"))
        $sessionId = [string](Get-Field $runData @("session_id", "sessionId"))
        if ([string]::IsNullOrWhiteSpace($report.run_id)) { throw "AgentRun id is missing" }
        $runEvents = @(Read-Sse "$JavaBaseUrl/api/agent-runs/$($report.run_id)/stream" "0" $csrf 180)
        $completedEvents = @($runEvents | Where-Object event_type -eq "run.completed")
        $terminalEvents = @($runEvents | Where-Object { @("run.completed", "run.failed", "run.cancelled") -contains $_.event_type })
        if ($completedEvents.Count -ne 1 -or $terminalEvents.Count -ne 1) { throw "AgentRun SSE did not produce exactly one completed terminal event" }
        $modelEvents = @($runEvents | Where-Object event_type -eq "run.model_usage")
        $cloudModelEvents = @($modelEvents | Where-Object {
                $provider = [string](Get-Field $_.payload @("provider_code", "provider"))
                $model = [string](Get-Field $_.payload @("model_name", "model"))
                $provider -eq [string]$ragConfig.chat_provider -and $model -eq [string]$ragConfig.chat_model
            })
        if ($cloudModelEvents.Count -eq 0) { throw "AgentRun did not record the configured cloud Chat provider/model" }
        $completedPayload = $completedEvents[0].payload
        $runCitations = @(Get-Field $completedPayload @("citations"))
        [void](Assert-Citations $runCitations ([long[]]$documentIds))
        $uniqueSseIds = @($runEvents | ForEach-Object sse_event_id | Select-Object -Unique)
        if ($uniqueSseIds.Count -ne $runEvents.Count) { throw "AgentRun SSE returned duplicate event ids" }
        $runReplay = @(Read-Sse "$JavaBaseUrl/api/agent-runs/$($report.run_id)/stream" ([string]$runEvents[0].sse_event_id) $csrf 60)
        if (@($runReplay | Where-Object { $_.sse_event_id -eq $runEvents[0].sse_event_id }).Count -ne 0) { throw "AgentRun Last-Event-ID replay returned the cursor event" }
        if (@($runReplay | Where-Object event_type -eq "run.completed").Count -ne 1) { throw "AgentRun Last-Event-ID replay did not include the terminal event" }
        $report.run_sse = [ordered]@{ event_count = $runEvents.Count; terminal_event_count = $terminalEvents.Count; citation_count = $runCitations.Count; cloud_model_event_count = $cloudModelEvents.Count; replay_count = $runReplay.Count; terminal = "run.completed" }

        foreach ($docId in $documentIds) {
            [void](Invoke-Api $context "POST" "$JavaBaseUrl/api/admin/knowledge-documents/$docId/disable" $null $null @{ "X-CSRF-Token" = $csrf })
        }
        [void](Wait-PublicSearch $query ([long[]]$documentIds) $csrf $false)
        foreach ($docId in $documentIds) {
            [void](Invoke-Api $context "POST" "$JavaBaseUrl/api/admin/knowledge-documents/$docId/restore" $null $null @{ "X-CSRF-Token" = $csrf })
        }
        $report.status = "passed"
    }
} catch {
    $report.status = "failed"
    $report.error_code = Get-ErrorCode $_
    $report.error_summary = Get-SafeSummary $_
} finally {
    if (-not $KeepData -and $null -ne $context) {
        if ($documentIds.Count -eq 0 -and $batchId -gt 0) {
            try {
                $cleanupState = Get-BatchState (Invoke-Api $context "GET" "$JavaBaseUrl/api/admin/knowledge-upload-batches/$batchId")
                foreach ($item in $cleanupState.items) {
                    $candidate = [long](Get-Field $item @("document_id", "documentId"))
                    if ($candidate -gt 0 -and -not $documentIds.Contains($candidate)) { [void]$documentIds.Add($candidate) }
                }
            } catch { Add-CleanupError "batch lookup failed" }
        }
        try { $csrfForCleanup = Get-Csrf $context } catch { $csrfForCleanup = $null }
        foreach ($docId in $documentIds) {
            try {
                if ($null -ne $csrfForCleanup) {
                    [void](Invoke-Api $context "POST" "$JavaBaseUrl/api/admin/knowledge-documents/$docId/delete" $null $null @{ "X-CSRF-Token" = $csrfForCleanup })
                    $report.cleanup.documents_deleted++
                }
            } catch { Add-CleanupError "document cleanup failed" }
        }
        if (-not [string]::IsNullOrWhiteSpace([string]$sessionId)) {
            try {
                [void](Invoke-Api $context "DELETE" "$JavaBaseUrl/api/sessions/$sessionId" $null $null @{ "X-CSRF-Token" = $csrfForCleanup })
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
$output = $report | ConvertTo-Json -Depth 16
Write-Output $output
if ($report.status -eq "failed") { exit 1 }

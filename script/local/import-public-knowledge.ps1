[CmdletBinding()]
param(
    [string]$JavaBaseUrl = "http://127.0.0.1:8080",
    [string]$SourceDirectory = "",
    [int]$BatchTimeoutSeconds = 600
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
if ([string]::IsNullOrWhiteSpace($SourceDirectory)) {
    $SourceDirectory = Join-Path $repoRoot "script/data/knowledge/public"
}
$SourceDirectory = (Resolve-Path -LiteralPath $SourceDirectory).Path
$manifestPath = Join-Path $SourceDirectory "manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$documents = @($manifest.documents)

if ($documents.Count -eq 0) { throw "公共知识库 manifest 没有文档" }
if ($documents.Count -gt 20) { throw "单批公共知识库文档不能超过 20 个" }
if ($BatchTimeoutSeconds -lt 60 -or $BatchTimeoutSeconds -gt 1800) {
    throw "BatchTimeoutSeconds 必须在 60 到 1800 秒之间"
}

$adminUsername = [Environment]::GetEnvironmentVariable("FOODMATE_E2E_ADMIN_USERNAME", "Process")
$adminPassword = [Environment]::GetEnvironmentVariable("FOODMATE_E2E_ADMIN_PASSWORD", "Process")
if ([string]::IsNullOrWhiteSpace($adminUsername) -or [string]::IsNullOrWhiteSpace($adminPassword)) {
    throw "请在当前 PowerShell 进程设置 FOODMATE_E2E_ADMIN_USERNAME 和 FOODMATE_E2E_ADMIN_PASSWORD"
}

# 统一使用带 Cookie 的 HttpClient，登录后复用 CSRF Cookie 和会话。
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.CookieContainer = [System.Net.CookieContainer]::new()
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(60)

function Invoke-JsonApi(
    [string]$Method,
    [string]$Url,
    [object]$Payload = $null,
    [System.Net.Http.HttpContent]$Content = $null,
    [hashtable]$Headers = @{}
) {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Url)
    try {
        if ($null -ne $Payload) {
            $body = $Payload | ConvertTo-Json -Depth 12 -Compress
            $request.Content = [System.Net.Http.StringContent]::new($body, [Text.Encoding]::UTF8, "application/json")
        } elseif ($null -ne $Content) {
            $request.Content = $Content
        }
        foreach ($header in $Headers.GetEnumerator()) {
            [void]$request.Headers.TryAddWithoutValidation([string]$header.Key, [string]$header.Value)
        }
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        try {
            $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            if (-not $response.IsSuccessStatusCode) {
                throw "HTTP $([int]$response.StatusCode): $responseBody"
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

function Get-CsrfToken {
    $cookies = $handler.CookieContainer.GetCookies([Uri]$JavaBaseUrl)
    $cookie = $cookies | Where-Object Name -eq "foodmate_csrf" | Select-Object -First 1
    if ($null -eq $cookie) { throw "登录后没有得到 foodmate_csrf Cookie" }
    return $cookie.Value
}

function Get-Field([object]$Object, [string[]]$Names) {
    if ($null -eq $Object) { return $null }
    foreach ($name in $Names) {
        $property = $Object.PSObject.Properties[$name]
        if ($null -ne $property) { return $property.Value }
    }
    return $null
}

try {
    # 登录只读取当前进程凭据，脚本不会把密码写入日志或文件。
    [void](Invoke-JsonApi "POST" "$JavaBaseUrl/api/auth/login" @{
            username_or_email = $adminUsername
            password = $adminPassword
        })
    $csrf = Get-CsrfToken

    $idempotencyKey = "foodmate-public-who-$($manifest.dataset_version)"
    $multipart = [System.Net.Http.MultipartFormDataContent]::new()
    $fields = [ordered]@{
        source_type = "public_reuse"
        source_name = "世界卫生组织公共营养资料"
        source_version = [string]$manifest.dataset_version
        license_notice = "保留官方来源链接，仅用于个人项目本地知识库；不代表世界卫生组织认可 FoodMate。"
        idempotency_key = $idempotencyKey
    }
    foreach ($field in $fields.GetEnumerator()) {
        $part = [System.Net.Http.StringContent]::new([string]$field.Value, [Text.Encoding]::UTF8)
        [void]$multipart.Add($part, [string]$field.Key)
    }

    foreach ($entry in $documents) {
        $path = Join-Path $SourceDirectory ([string]$entry.file)
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "manifest 文档不存在：$($entry.file)"
        }
        $bytes = [IO.File]::ReadAllBytes($path)
        if ($bytes.Length -eq 0 -or $bytes.Length -gt 20MB) {
            throw "文档大小不合法：$($entry.file)"
        }
        $part = [System.Net.Http.ByteArrayContent]::new($bytes)
        $part.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("text/markdown")
        [void]$multipart.Add($part, "files", [string]$entry.file)
    }

    try {
        $headers = @{
            "X-CSRF-Token" = $csrf
            "Idempotency-Key" = $idempotencyKey
        }
        $upload = Invoke-JsonApi "POST" "$JavaBaseUrl/api/admin/knowledge-documents/upload-batches" $null $multipart $headers
    } finally {
        $multipart.Dispose()
    }

    $batchId = [long](Get-Field $upload.data @("batch_id", "batchId"))
    if ($batchId -le 0) { throw "批次响应缺少 batch_id" }
    $deadline = (Get-Date).ToUniversalTime().AddSeconds($BatchTimeoutSeconds)
    $state = $null
    do {
        $state = Invoke-JsonApi "GET" "$JavaBaseUrl/api/admin/knowledge-upload-batches/$batchId"
        $batch = Get-Field $state.data @("batch")
        $job = Get-Field $batch @("job")
        $items = @(Get-Field $batch @("items"))
        $active = @($items | Where-Object { @("pending", "parsing", "parsed", "indexing") -contains [string](Get-Field $_ @("index_status", "indexStatus")) })
        if ($active.Count -eq 0 -and @("completed", "partial_failed", "failed") -contains [string](Get-Field $job @("status"))) {
            break
        }
        Start-Sleep -Seconds 3
    } while ((Get-Date).ToUniversalTime() -lt $deadline)

    $batch = Get-Field $state.data @("batch")
    $job = Get-Field $batch @("job")
    $items = @(Get-Field $batch @("items"))
    $documentIds = @($items | ForEach-Object { [long](Get-Field $_ @("document_id", "documentId")) } | Where-Object { $_ -gt 0 })
    if ([string](Get-Field $job @("status")) -ne "completed" -or $documentIds.Count -ne $documents.Count) {
        $summary = $state | ConvertTo-Json -Depth 16 -Compress
        throw "公共知识库批次未成功完成：$summary"
    }

    # 资料索引完成后才逐文档显式发布，发布动作仍由 Java 权威事务执行。
    foreach ($documentId in $documentIds) {
        [void](Invoke-JsonApi "POST" "$JavaBaseUrl/api/admin/knowledge-documents/$documentId/publish" $null $null @{ "X-CSRF-Token" = $csrf })
    }

    $result = [ordered]@{
        status = "published"
        mode = "local-stub"
        dataset = [string]$manifest.dataset
        dataset_version = [string]$manifest.dataset_version
        document_count = $documentIds.Count
        batch_id = $batchId
        document_ids = $documentIds
        item_statuses = @($items | ForEach-Object { [ordered]@{ item_id = Get-Field $_ @("item_id", "itemId"); document_id = Get-Field $_ @("document_id", "documentId"); index_status = Get-Field $_ @("index_status", "indexStatus"); chunk_count = Get-Field $_ @("chunk_count", "chunkCount") } })
    }
    $result | ConvertTo-Json -Depth 16
} finally {
    $client.Dispose()
}

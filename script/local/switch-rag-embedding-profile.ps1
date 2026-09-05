[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet("bge-m3", "qwen3-embedding-0.6b")]
    [string]$Profile = "bge-m3",
    [string]$EnvFile = "",
    [switch]$Apply,
    [switch]$Recreate
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
# 故意不修改 FOODMATE_DOCKER_RAG_EMBEDDING_API_KEY，避免切换 profile 时覆盖密钥。
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $repoRoot ".env"
}
$EnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
$composeFile = Join-Path $repoRoot "docker/compose.yml"

if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw "Environment file does not exist: $EnvFile"
}
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "Docker Compose file does not exist: $composeFile"
}
if ($Recreate -and -not $Apply) {
    throw "-Recreate requires -Apply so the selected profile is written first"
}

$profiles = @{
    "bge-m3" = @{
        model = "BAAI/bge-m3"
        collection = "foodmate_knowledge_chunks_bge_m3"
    }
    "qwen3-embedding-0.6b" = @{
        model = "Qwen/Qwen3-Embedding-0.6B"
        collection = "foodmate_knowledge_chunks_qwen3_embedding_0_6b"
    }
}
$selected = $profiles[$Profile]

Write-Output "embedding_profile=$Profile"
Write-Output "embedding_model=$($selected.model)"
Write-Output "milvus_collection=$($selected.collection)"
Write-Output "api_key_action=unchanged"

if ($Apply) {
    $content = [IO.File]::ReadAllText($EnvFile)
    $lineEnding = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }

    function Set-EnvValue([string]$Text, [string]$Name, [string]$Value) {
        $pattern = "(?m)^" + [regex]::Escape($Name) + "=.*$"
        $replacement = "$Name=$Value"
        if ([regex]::IsMatch($Text, $pattern)) {
            return [regex]::Replace(
                $Text,
                $pattern,
                [Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement }
            )
        }
        $suffix = if ($Text.EndsWith($lineEnding)) { "" } else { $lineEnding }
        return $Text + $suffix + $replacement + $lineEnding
    }

    $updated = $content
    $updated = Set-EnvValue $updated "FOODMATE_DOCKER_RAG_MODE" "local"
    $updated = Set-EnvValue $updated "FOODMATE_DOCKER_RAG_EMBEDDING_PROVIDER" "openai-compatible"
    $updated = Set-EnvValue $updated "FOODMATE_DOCKER_RAG_EMBEDDING_PROFILE" $Profile
    $updated = Set-EnvValue $updated "FOODMATE_DOCKER_RAG_EMBEDDING_MODEL" $selected.model
    $updated = Set-EnvValue $updated "FOODMATE_DOCKER_RAG_MILVUS_COLLECTION" $selected.collection

    if ($PSCmdlet.ShouldProcess($EnvFile, "write non-sensitive RAG profile settings")) {
        $utf8NoBom = New-Object Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($EnvFile, $updated, $utf8NoBom)
        Write-Output "environment_updated=true"
    }
}
else {
    Write-Output "environment_updated=false"
    Write-Output "Use -Apply to modify .env; the Embedding API key is never read, accepted, or printed"
}

if ($Recreate) {
    & docker compose --env-file $EnvFile -f $composeFile config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose configuration validation failed"
    }
    & docker compose --env-file $EnvFile -f $composeFile up -d --force-recreate agent-runtime
    if ($LASTEXITCODE -ne 0) {
        throw "agent-runtime recreation failed"
    }
    Write-Output "agent_runtime_recreated=true"
}

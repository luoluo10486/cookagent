$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$scriptPath = Join-Path $repoRoot "script/local/real-rag-e2e.ps1"
$scriptText = Get-Content -Raw -LiteralPath $scriptPath

if ($scriptText -notmatch '\[switch\]\$ExecutePaid') { throw "R1 script must require an explicit paid execution switch" }
if ($scriptText -notmatch 'FOODMATE_E2E_ADMIN_USERNAME') { throw "R1 script must read admin identity from the process environment" }
if ($scriptText -notmatch 'FOODMATE_E2E_ADMIN_PASSWORD') { throw "R1 script must read admin password from the process environment" }
if ($scriptText -match '(?i)--api-key|\$ApiKey|Write-Output.*(API_KEY|PASSWORD)') { throw "R1 script must not pass or print credentials" }
if ($scriptText -notmatch 'FOODMATE_DOCKER_PAID_MAX_TOTAL_COST_CNY') { throw "R1 script must bound the paid budget" }
if ($scriptText -notmatch 'Assert-RealRagConfig') { throw "R1 script must fail closed unless RAG is real local mode" }
if ($scriptText -notmatch 'foodmate-knowledge-index-v1|knowledge-documents/upload-batches') { throw "R1 script must use the real knowledge batch API" }
if ($scriptText -notmatch 'knowledge.index.indexed|knowledge.batch.progress') { throw "R1 script must assert persisted batch SSE progress" }
if ($scriptText -notmatch 'api/knowledge-base/search') { throw "R1 script must assert Java-authoritative public search" }
if ($scriptText -notmatch 'run.completed|api/agent-runs/.*/stream') { throw "R1 script must assert completed AgentRun SSE citations" }
if ($scriptText -notmatch 'run.model_usage|configured cloud Chat provider/model') { throw "R1 script must assert actual cloud Chat usage" }
if ($scriptText -notmatch '/disable|/restore|/delete') { throw "R1 script must assert document visibility lifecycle" }
if ($scriptText -notmatch 'Last-Event-ID') { throw "R1 script must exercise SSE replay" }
if ($scriptText -notmatch 'document cleanup failed|session cleanup failed') { throw "R1 script must retain cleanup failure evidence" }
if ($scriptText -notmatch 'return ,\$multipart') { throw "R1 script must preserve multipart content as one HttpContent" }
if ($scriptText -match '(?i)Start-Job|ForEach-Object.*parallel|WarmupSeconds|SteadySeconds') { throw "R1 script must stay a bounded business-path check" }

Write-Output "real_rag_e2e_contract=passed"

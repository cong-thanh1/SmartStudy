$ErrorActionPreference = "Stop"

$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$agentScript = Join-Path (Split-Path -Parent $PSScriptRoot) "tools\cloudflare-ai-relay-agent.mjs"
$relayUrl = "https://smartstudy-ai-relay.dcthanh-a1-c3tqcap.workers.dev"

$existingAgent = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq "node.exe" -and $_.CommandLine -like "*$agentScript*"
} | Select-Object -First 1
if ($existingAgent) {
  Write-Host "SmartStudy local AI relay is already running." -ForegroundColor Green
  exit 0
}

$upstreamUrl = if ([string]::IsNullOrWhiteSpace($env:LOCAL_AI_UPSTREAM_URL)) {
  "http://127.0.0.1:8081"
} else {
  $env:LOCAL_AI_UPSTREAM_URL.TrimEnd("/")
}

try {
  $health = Invoke-RestMethod -Uri "$upstreamUrl/health" -TimeoutSec 10
  if ($health.status -ne "ok") { throw "Unexpected health response." }
} catch {
  throw "Local AI upstream is not healthy at $upstreamUrl. Start the CUDA llama.cpp service first."
}

$agentKey = & $aws ssm get-parameter `
  --name /smartstudy/production/cloudflare-relay-agent-key `
  --with-decryption `
  --profile smartstudy-prod `
  --region us-east-1 `
  --query Parameter.Value `
  --output text

if ([string]::IsNullOrWhiteSpace($agentKey)) {
  throw "Could not load the Cloudflare relay agent key from AWS SSM."
}

$env:CLOUDFLARE_RELAY_URL = $relayUrl
$env:CLOUDFLARE_RELAY_AGENT_KEY = $agentKey
$env:LOCAL_AI_UPSTREAM_URL = $upstreamUrl

node $agentScript

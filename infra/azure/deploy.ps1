param(
  [Parameter(Mandatory = $true)][string]$ResourceGroup,
  [Parameter(Mandatory = $true)][string]$AcrName,
  # Japan West is in this subscription's allowed-locations policy.
  [string]$Location = "japanwest",
  [string]$EnvironmentName = "investment-os-japanwest-env",
  [string]$ApiName = "investment-research-api-jp",
  [string]$WorkerJobName = "investment-daily-worker-jp",
  [string]$HermesName = "investment-hermes",
  [string]$HermesImage = "",
  [string]$ImageTag = "latest",
  [switch]$BuildImagesWithAcr
)

$ErrorActionPreference = "Stop"

function Test-AzureResourceExists {
  param([scriptblock]$Command)

  # Azure CLI correctly returns a non-zero exit code when a resource is not
  # present.  That is expected during the first deployment, so inspect the
  # exit code without letting PowerShell stop the script before creation.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousPreference
  }
}

function Assert-AzureCommandSucceeded {
  param([Parameter(Mandatory = $true)][string]$Step)

  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed (Azure CLI exit code $LASTEXITCODE). Review the Azure error above."
  }
}

$requiredSecrets = @(
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OWNER_SUPABASE_USER_ID",
  "INTERNAL_API_TOKEN", "GEMINI_API_KEY", "EODHD_API_KEY", "DISCORD_OWNER_USER_ID", "DISCORD_WEBHOOK_URL"
)
foreach ($secretName in $requiredSecrets) {
  if (-not [Environment]::GetEnvironmentVariable($secretName)) {
    throw "Missing required environment variable: $secretName"
  }
}
if ($HermesImage -and -not [Environment]::GetEnvironmentVariable("DISCORD_BOT_TOKEN")) {
  throw "DISCORD_BOT_TOKEN is required when HermesImage is provided"
}

az extension add --name containerapp --upgrade | Out-Null
Assert-AzureCommandSucceeded "Installing the Container Apps extension"
if (-not (Test-AzureResourceExists { az group show --name $ResourceGroup })) {
  az group create --name $ResourceGroup --location $Location | Out-Null
  Assert-AzureCommandSucceeded "Creating resource group '$ResourceGroup'"
} else {
  Write-Host "Using existing resource group '$ResourceGroup'. Resources may use location '$Location'."
}
if (-not (Test-AzureResourceExists { az acr show --resource-group $ResourceGroup --name $AcrName })) {
  az acr create --resource-group $ResourceGroup --name $AcrName --sku Basic --location $Location | Out-Null
  Assert-AzureCommandSucceeded "Creating container registry '$AcrName'"
}
if (-not (Test-AzureResourceExists { az containerapp env show --resource-group $ResourceGroup --name $EnvironmentName })) {
  az containerapp env create --resource-group $ResourceGroup --name $EnvironmentName --location $Location --environment-mode WorkloadProfiles | Out-Null
  Assert-AzureCommandSucceeded "Creating Workload Profiles environment '$EnvironmentName'"
}

if ($BuildImagesWithAcr) {
  Write-Warning "Building with ACR Tasks is disabled by default because Azure for Students blocks ACR Tasks. Prefer GitLab CI image builds."
  $repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
  $temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $buildContext = Join-Path $temporaryRoot ("investment-os-acr-" + [guid]::NewGuid().ToString("N"))

  try {
    New-Item -ItemType Directory -Path $buildContext | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $buildContext "docker") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $buildContext "apps") | Out-Null
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "requirements.txt") -Destination $buildContext
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "docker\Dockerfile.api") -Destination (Join-Path $buildContext "docker")
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "docker\Dockerfile.worker") -Destination (Join-Path $buildContext "docker")
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "apps\api") -Destination (Join-Path $buildContext "apps") -Recurse
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "apps\worker") -Destination (Join-Path $buildContext "apps") -Recurse
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "data") -Destination $buildContext -Recurse
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "prompts") -Destination $buildContext -Recurse

    az acr build --registry $AcrName --image "investment-api:$ImageTag" --file docker/Dockerfile.api $buildContext
    Assert-AzureCommandSucceeded "Building the API image"
    az acr build --registry $AcrName --image "investment-worker:$ImageTag" --file docker/Dockerfile.worker $buildContext
    Assert-AzureCommandSucceeded "Building the worker image"
  } finally {
    $resolvedBuildContext = [System.IO.Path]::GetFullPath($buildContext)
    if ($resolvedBuildContext.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path $resolvedBuildContext -Leaf).StartsWith("investment-os-acr-")) {
      Remove-Item -LiteralPath $resolvedBuildContext -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
} else {
  Write-Host "Skipping image build. GitLab CI must push investment-api:$ImageTag and investment-worker:$ImageTag first."
}

$acrServer = az acr show --resource-group $ResourceGroup --name $AcrName --query loginServer -o tsv
Assert-AzureCommandSucceeded "Reading the container registry login server"
if (-not $acrServer) {
  throw "Container registry '$AcrName' returned an empty login server."
}

$commonSecrets = @(
  "supabase-url=$env:NEXT_PUBLIC_SUPABASE_URL",
  "supabase-service-role=$env:SUPABASE_SERVICE_ROLE_KEY",
  "owner-user-id=$env:OWNER_SUPABASE_USER_ID",
  "internal-api-token=$env:INTERNAL_API_TOKEN",
  "gemini-api-key=$env:GEMINI_API_KEY",
  "eodhd-api-key=$env:EODHD_API_KEY",
  "discord-owner-id=$env:DISCORD_OWNER_USER_ID",
  "discord-webhook=$env:DISCORD_WEBHOOK_URL"
)
$commonEnv = @(
  "NEXT_PUBLIC_SUPABASE_URL=secretref:supabase-url",
  "SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role",
  "OWNER_SUPABASE_USER_ID=secretref:owner-user-id",
  "INTERNAL_API_TOKEN=secretref:internal-api-token",
  "GEMINI_API_KEY=secretref:gemini-api-key",
  "GEMINI_MODEL=gemini-3.5-flash",
  "EODHD_API_KEY=secretref:eodhd-api-key",
  "DISCORD_OWNER_USER_ID=secretref:discord-owner-id",
  "DISCORD_WEBHOOK_URL=secretref:discord-webhook",
  "SUPABASE_PORTFOLIO_SOURCE=supabase"
)

if (Test-AzureResourceExists { az containerapp show --resource-group $ResourceGroup --name $ApiName }) {
  az containerapp secret set --resource-group $ResourceGroup --name $ApiName --secrets $commonSecrets | Out-Null
  Assert-AzureCommandSucceeded "Updating API secrets"
  az containerapp update --resource-group $ResourceGroup --name $ApiName --image "$acrServer/investment-api:$ImageTag" --set-env-vars $commonEnv | Out-Null
  Assert-AzureCommandSucceeded "Updating API container app"
} else {
  az containerapp create --resource-group $ResourceGroup --environment $EnvironmentName --name $ApiName --image "$acrServer/investment-api:$ImageTag" --registry-server $acrServer --registry-identity system --ingress external --target-port 8000 --min-replicas 0 --max-replicas 3 --secrets $commonSecrets --env-vars $commonEnv | Out-Null
  Assert-AzureCommandSucceeded "Creating API container app"
}

if (Test-AzureResourceExists { az containerapp job show --resource-group $ResourceGroup --name $WorkerJobName }) {
  az containerapp job secret set --resource-group $ResourceGroup --name $WorkerJobName --secrets $commonSecrets | Out-Null
  Assert-AzureCommandSucceeded "Updating worker secrets"
  az containerapp job update --resource-group $ResourceGroup --name $WorkerJobName --image "$acrServer/investment-worker:$ImageTag" --set-env-vars $commonEnv | Out-Null
  Assert-AzureCommandSucceeded "Updating scheduled worker"
} else {
  az containerapp job create --resource-group $ResourceGroup --environment $EnvironmentName --name $WorkerJobName --image "$acrServer/investment-worker:$ImageTag" --registry-server $acrServer --registry-identity system --trigger-type Schedule --cron-expression "0 11 * * *" --replica-timeout 1800 --replica-retry-limit 1 --secrets $commonSecrets --env-vars $commonEnv | Out-Null
  Assert-AzureCommandSucceeded "Creating scheduled worker"
}

$apiFqdn = az containerapp show --resource-group $ResourceGroup --name $ApiName --query properties.configuration.ingress.fqdn -o tsv
Assert-AzureCommandSucceeded "Reading the API hostname"
if (-not $apiFqdn) {
  throw "API container app '$ApiName' returned an empty hostname."
}
if ($HermesImage) {
  $hermesSecrets = @(
    "internal-api-token=$env:INTERNAL_API_TOKEN",
    "discord-owner-id=$env:DISCORD_OWNER_USER_ID",
    "discord-bot-token=$env:DISCORD_BOT_TOKEN"
  )
  $hermesEnv = @(
    "API_BASE_URL=https://$apiFqdn",
    "INTERNAL_API_TOKEN=secretref:internal-api-token",
    "DISCORD_OWNER_USER_ID=secretref:discord-owner-id",
    "DISCORD_BOT_TOKEN=secretref:discord-bot-token"
  )
  if ($env:DISCORD_GUILD_ID) {
    $hermesEnv += "DISCORD_GUILD_ID=$env:DISCORD_GUILD_ID"
  }
  if (Test-AzureResourceExists { az containerapp show --resource-group $ResourceGroup --name $HermesName }) {
    az containerapp secret set --resource-group $ResourceGroup --name $HermesName --secrets $hermesSecrets | Out-Null
    Assert-AzureCommandSucceeded "Updating Hermes secrets"
    az containerapp update --resource-group $ResourceGroup --name $HermesName --image $HermesImage --set-env-vars $hermesEnv | Out-Null
    Assert-AzureCommandSucceeded "Updating Hermes container app"
  } else {
    az containerapp create --resource-group $ResourceGroup --environment $EnvironmentName --name $HermesName --image $HermesImage --registry-server $acrServer --registry-identity system --min-replicas 1 --max-replicas 1 --secrets $hermesSecrets --env-vars $hermesEnv | Out-Null
    Assert-AzureCommandSucceeded "Creating Hermes container app"
  }
}

Write-Host "API: https://$apiFqdn"
Write-Host "Worker schedule: daily at 11:00 UTC / 18:00 Asia/Bangkok"

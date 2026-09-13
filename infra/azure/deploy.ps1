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
  [string]$HermesStorageAccountName = "stockagentkwan2549data",
  [string]$HermesStorageShareName = "hermes-data",
  [string]$HermesEnvironmentStorageName = "hermesfiles",
  [string]$ImageTag = "latest",
  [switch]$SkipHermes,
  [switch]$EnableHermesDiscord,
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
if (-not $SkipHermes -and -not [Environment]::GetEnvironmentVariable("HERMES_API_KEY")) {
  $tokenBytes = New-Object byte[] 48
  $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $random.GetBytes($tokenBytes)
  } finally {
    $random.Dispose()
  }
  $env:HERMES_API_KEY = [Convert]::ToBase64String($tokenBytes)
  Write-Host "Generated a new HERMES_API_KEY for this deployment. It will be stored only in Azure Container Apps secrets."
}
if ($EnableHermesDiscord -and -not [Environment]::GetEnvironmentVariable("DISCORD_BOT_TOKEN")) {
  throw "DISCORD_BOT_TOKEN is required when -EnableHermesDiscord is used"
}
if (-not $SkipHermes -and $HermesStorageAccountName -notmatch '^[a-z0-9]{3,24}$') {
  throw "HermesStorageAccountName must contain 3-24 lowercase letters or numbers."
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
$apiSecrets = $commonSecrets
if (-not $SkipHermes) {
  $apiSecrets += "hermes-api-key=$env:HERMES_API_KEY"
}
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
$apiEnv = $commonEnv
if (-not $SkipHermes) {
  $apiEnv += @(
    "HERMES_BASE_URL=http://$HermesName",
    "HERMES_API_KEY=secretref:hermes-api-key",
    "HERMES_REQUEST_TIMEOUT_SECONDS=20"
  )
}

if (Test-AzureResourceExists { az containerapp show --resource-group $ResourceGroup --name $ApiName }) {
  az containerapp secret set --resource-group $ResourceGroup --name $ApiName --secrets $apiSecrets | Out-Null
  Assert-AzureCommandSucceeded "Updating API secrets"
  az containerapp update --resource-group $ResourceGroup --name $ApiName --image "$acrServer/investment-api:$ImageTag" --set-env-vars $apiEnv | Out-Null
  Assert-AzureCommandSucceeded "Updating API container app"
} else {
  az containerapp create --resource-group $ResourceGroup --environment $EnvironmentName --name $ApiName --image "$acrServer/investment-api:$ImageTag" --registry-server $acrServer --registry-identity system --ingress external --target-port 8000 --min-replicas 0 --max-replicas 3 --secrets $apiSecrets --env-vars $apiEnv | Out-Null
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
if (-not $SkipHermes) {
  if (-not $HermesImage) {
    $HermesImage = "$acrServer/investment-hermes:$ImageTag"
  }

  if (-not (Test-AzureResourceExists { az storage account show --resource-group $ResourceGroup --name $HermesStorageAccountName })) {
    az storage account create --resource-group $ResourceGroup --name $HermesStorageAccountName --location $Location --sku Standard_LRS --kind StorageV2 | Out-Null
    Assert-AzureCommandSucceeded "Creating Hermes storage account"
  }
  if (-not (Test-AzureResourceExists { az storage share-rm show --resource-group $ResourceGroup --storage-account $HermesStorageAccountName --name $HermesStorageShareName })) {
    az storage share-rm create --resource-group $ResourceGroup --storage-account $HermesStorageAccountName --name $HermesStorageShareName --quota 5 | Out-Null
    Assert-AzureCommandSucceeded "Creating Hermes Azure Files share"
  }
  $hermesStorageKey = az storage account keys list --resource-group $ResourceGroup --account-name $HermesStorageAccountName --query '[0].value' -o tsv
  Assert-AzureCommandSucceeded "Reading Hermes storage access key"
  if (-not $hermesStorageKey) {
    throw "Hermes storage account returned an empty access key."
  }
  az containerapp env storage set --resource-group $ResourceGroup --name $EnvironmentName --storage-name $HermesEnvironmentStorageName --azure-file-account-name $HermesStorageAccountName --azure-file-account-key $hermesStorageKey --azure-file-share-name $HermesStorageShareName --access-mode ReadWrite | Out-Null
  Assert-AzureCommandSucceeded "Linking Hermes Azure Files share to Container Apps environment"

  $hermesSecrets = @(
    "hermes-api-key=$env:HERMES_API_KEY",
    "gemini-api-key=$env:GEMINI_API_KEY",
    "internal-api-token=$env:INTERNAL_API_TOKEN",
    "discord-owner-id=$env:DISCORD_OWNER_USER_ID"
  )
  if ($EnableHermesDiscord) {
    $hermesSecrets += "discord-bot-token=$env:DISCORD_BOT_TOKEN"
  }
  $hermesEnv = @(
    "HERMES_HOME=/opt/data",
    "API_SERVER_ENABLED=true",
    "API_SERVER_HOST=0.0.0.0",
    "API_SERVER_PORT=8642",
    "API_SERVER_KEY=secretref:hermes-api-key",
    "GEMINI_API_KEY=secretref:gemini-api-key",
    "API_BASE_URL=https://$apiFqdn",
    "INTERNAL_API_TOKEN=secretref:internal-api-token",
    "DISCORD_OWNER_USER_ID=secretref:discord-owner-id"
  )
  if ($EnableHermesDiscord) {
    $hermesEnv += "DISCORD_BOT_TOKEN=secretref:discord-bot-token"
  }
  if ($env:DISCORD_GUILD_ID) {
    $hermesEnv += "DISCORD_GUILD_ID=$env:DISCORD_GUILD_ID"
  }
  if (Test-AzureResourceExists { az containerapp show --resource-group $ResourceGroup --name $HermesName }) {
    az containerapp secret set --resource-group $ResourceGroup --name $HermesName --secrets $hermesSecrets | Out-Null
    Assert-AzureCommandSucceeded "Updating Hermes secrets"
    az containerapp update --resource-group $ResourceGroup --name $HermesName --image $HermesImage --min-replicas 1 --max-replicas 1 --cpu 1.0 --memory 2.0Gi --set-env-vars $hermesEnv | Out-Null
    Assert-AzureCommandSucceeded "Updating Hermes container app"
    if (-not $EnableHermesDiscord) {
      az containerapp update --resource-group $ResourceGroup --name $HermesName --remove-env-vars DISCORD_BOT_TOKEN | Out-Null
      Assert-AzureCommandSucceeded "Keeping cloud Discord disabled until cutover"
    }
  } else {
    az containerapp create --resource-group $ResourceGroup --environment $EnvironmentName --name $HermesName --image $HermesImage --registry-server $acrServer --registry-identity system --ingress internal --target-port 8642 --min-replicas 1 --max-replicas 1 --cpu 1.0 --memory 2.0Gi --secrets $hermesSecrets --env-vars $hermesEnv | Out-Null
    Assert-AzureCommandSucceeded "Creating Hermes container app"
  }

  az containerapp ingress enable --resource-group $ResourceGroup --name $HermesName --type internal --target-port 8642 --transport auto | Out-Null
  Assert-AzureCommandSucceeded "Enabling internal-only Hermes ingress"

  $hermesDefinition = az containerapp show --resource-group $ResourceGroup --name $HermesName -o json | ConvertFrom-Json
  Assert-AzureCommandSucceeded "Reading Hermes container app definition"
  $hermesDefinition.properties.configuration.PSObject.Properties.Remove("secrets")
  $hermesContainer = $hermesDefinition.properties.template.containers | Where-Object { $_.name -eq $HermesName } | Select-Object -First 1
  if (-not $hermesContainer) {
    throw "Could not find the Hermes container in the Container App definition."
  }
  $hermesContainer | Add-Member -NotePropertyName volumeMounts -NotePropertyValue @(
    [pscustomobject]@{ volumeName = "hermes-data"; mountPath = "/mnt/hermes-persist" }
  ) -Force
  $hermesDefinition.properties.template | Add-Member -NotePropertyName volumes -NotePropertyValue @(
    [pscustomobject]@{ name = "hermes-data"; storageName = $HermesEnvironmentStorageName; storageType = "AzureFile" }
  ) -Force
  $temporaryHermesDefinition = Join-Path ([System.IO.Path]::GetTempPath()) ("investment-hermes-" + [guid]::NewGuid().ToString("N") + ".json")
  try {
    [System.IO.File]::WriteAllText($temporaryHermesDefinition, ($hermesDefinition | ConvertTo-Json -Depth 100))
    az containerapp update --resource-group $ResourceGroup --name $HermesName --yaml $temporaryHermesDefinition | Out-Null
    Assert-AzureCommandSucceeded "Mounting persistent Hermes data volume"
  } finally {
    if (Test-Path -LiteralPath $temporaryHermesDefinition) {
      Remove-Item -LiteralPath $temporaryHermesDefinition -Force
    }
  }

  $hermesFqdn = az containerapp show --resource-group $ResourceGroup --name $HermesName --query properties.configuration.ingress.fqdn -o tsv
  Assert-AzureCommandSucceeded "Reading internal Hermes hostname"
  Write-Host "Hermes internal endpoint: https://$hermesFqdn"
  Write-Host "Hermes Discord: $(if ($EnableHermesDiscord) { 'enabled' } else { 'disabled until cutover' })"
}

Write-Host "API: https://$apiFqdn"
Write-Host "Worker schedule: daily at 11:00 UTC / 18:00 Asia/Bangkok"

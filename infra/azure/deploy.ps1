param(
  [Parameter(Mandatory = $true)][string]$ResourceGroup,
  [Parameter(Mandatory = $true)][string]$AcrName,
  [string]$Location = "southeastasia",
  [string]$EnvironmentName = "investment-os-env",
  [string]$ApiName = "investment-research-api",
  [string]$WorkerJobName = "investment-daily-worker",
  [string]$HermesName = "investment-hermes",
  [string]$HermesImage = "",
  [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"
$requiredSecrets = @(
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OWNER_SUPABASE_USER_ID",
  "INTERNAL_API_TOKEN", "GEMINI_API_KEY", "DISCORD_OWNER_USER_ID", "DISCORD_WEBHOOK_URL"
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
az group create --name $ResourceGroup --location $Location | Out-Null
if (-not (az acr show --resource-group $ResourceGroup --name $AcrName 2>$null)) {
  az acr create --resource-group $ResourceGroup --name $AcrName --sku Basic | Out-Null
}
if (-not (az containerapp env show --resource-group $ResourceGroup --name $EnvironmentName 2>$null)) {
  az containerapp env create --resource-group $ResourceGroup --name $EnvironmentName --location $Location | Out-Null
}

az acr build --registry $AcrName --image "investment-api:$ImageTag" --file docker/Dockerfile.api .
az acr build --registry $AcrName --image "investment-worker:$ImageTag" --file docker/Dockerfile.worker .
$acrServer = az acr show --resource-group $ResourceGroup --name $AcrName --query loginServer -o tsv

$commonSecrets = @(
  "supabase-url=$env:NEXT_PUBLIC_SUPABASE_URL",
  "supabase-service-role=$env:SUPABASE_SERVICE_ROLE_KEY",
  "owner-user-id=$env:OWNER_SUPABASE_USER_ID",
  "internal-api-token=$env:INTERNAL_API_TOKEN",
  "gemini-api-key=$env:GEMINI_API_KEY",
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
  "DISCORD_OWNER_USER_ID=secretref:discord-owner-id",
  "DISCORD_WEBHOOK_URL=secretref:discord-webhook",
  "SUPABASE_PORTFOLIO_SOURCE=supabase"
)

if (az containerapp show --resource-group $ResourceGroup --name $ApiName 2>$null) {
  az containerapp secret set --resource-group $ResourceGroup --name $ApiName --secrets $commonSecrets | Out-Null
  az containerapp update --resource-group $ResourceGroup --name $ApiName --image "$acrServer/investment-api:$ImageTag" --set-env-vars $commonEnv | Out-Null
} else {
  az containerapp create --resource-group $ResourceGroup --environment $EnvironmentName --name $ApiName --image "$acrServer/investment-api:$ImageTag" --registry-server $acrServer --registry-identity system --ingress external --target-port 8000 --min-replicas 0 --max-replicas 3 --secrets $commonSecrets --env-vars $commonEnv | Out-Null
}

if (az containerapp job show --resource-group $ResourceGroup --name $WorkerJobName 2>$null) {
  az containerapp job secret set --resource-group $ResourceGroup --name $WorkerJobName --secrets $commonSecrets | Out-Null
  az containerapp job update --resource-group $ResourceGroup --name $WorkerJobName --image "$acrServer/investment-worker:$ImageTag" --set-env-vars $commonEnv | Out-Null
} else {
  az containerapp job create --resource-group $ResourceGroup --environment $EnvironmentName --name $WorkerJobName --image "$acrServer/investment-worker:$ImageTag" --registry-server $acrServer --registry-identity system --trigger-type Schedule --cron-expression "0 11 * * *" --replica-timeout 1800 --replica-retry-limit 1 --secrets $commonSecrets --env-vars $commonEnv | Out-Null
}

$apiFqdn = az containerapp show --resource-group $ResourceGroup --name $ApiName --query properties.configuration.ingress.fqdn -o tsv
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
  if (az containerapp show --resource-group $ResourceGroup --name $HermesName 2>$null) {
    az containerapp secret set --resource-group $ResourceGroup --name $HermesName --secrets $hermesSecrets | Out-Null
    az containerapp update --resource-group $ResourceGroup --name $HermesName --image $HermesImage --set-env-vars $hermesEnv | Out-Null
  } else {
    az containerapp create --resource-group $ResourceGroup --environment $EnvironmentName --name $HermesName --image $HermesImage --min-replicas 1 --max-replicas 1 --secrets $hermesSecrets --env-vars $hermesEnv | Out-Null
  }
}

Write-Host "API: https://$apiFqdn"
Write-Host "Worker schedule: daily at 11:00 UTC / 18:00 Asia/Bangkok"

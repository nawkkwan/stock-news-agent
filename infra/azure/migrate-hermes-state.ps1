param(
  [Parameter(Mandatory = $true)][string]$ResourceGroup,
  [Parameter(Mandatory = $true)][string]$StorageAccountName,
  [string]$ShareName = "hermes-data",
  [string]$HermesHome = "$env:LOCALAPPDATA\hermes"
)

$ErrorActionPreference = "Stop"
$resolvedHome = [System.IO.Path]::GetFullPath($HermesHome)
if (-not (Test-Path -LiteralPath $resolvedHome -PathType Container)) {
  throw "Hermes home was not found: $resolvedHome"
}

$accountKey = az storage account keys list --resource-group $ResourceGroup --account-name $StorageAccountName --query '[0].value' -o tsv
if ($LASTEXITCODE -ne 0 -or -not $accountKey) {
  throw "Could not read the Azure Storage account key."
}

foreach ($fileName in @("MEMORY.md", "USER.md", "SOUL.md")) {
  $source = Join-Path $resolvedHome $fileName
  if (Test-Path -LiteralPath $source -PathType Leaf) {
    az storage file upload --account-name $StorageAccountName --account-key $accountKey --share-name $ShareName --source $source --path $fileName --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to upload $fileName" }
  }
}

$memoriesSource = Join-Path $resolvedHome "memories"
if (Test-Path -LiteralPath $memoriesSource -PathType Container) {
  az storage file upload-batch --account-name $StorageAccountName --account-key $accountKey --destination $ShareName --destination-path "memories" --source $memoriesSource --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to upload the memories directory." }
}

$skillSource = Join-Path $resolvedHome "skills\finance\portfolio-agent"
if (Test-Path -LiteralPath $skillSource -PathType Container) {
  az storage file upload-batch --account-name $StorageAccountName --account-key $accountKey --destination $ShareName --destination-path "skills/finance/portfolio-agent" --source $skillSource --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to upload the portfolio-agent skill." }
}

Write-Host "Hermes migration complete. Only memory/profile files and portfolio-agent were considered."
Write-Host "Secrets, auth.json, sessions, logs, caches, and gateway state were not uploaded."

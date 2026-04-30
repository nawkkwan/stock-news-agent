$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

$Today = Get-Date -Format "yyyy-MM-dd"
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = "python"
}

Write-Host "Running portfolio news report for $Today..."

git pull --rebase origin main

& $Python ".\scripts\run_daily_report.py" --date $Today

& $Python -c "import json, sys; p=json.load(open('site/data/latest-report.json', encoding='utf-8')); sys.exit(0 if p.get('date') == '$Today' else 1)"

git add "site\data\latest-report.json" "site\data\reports\$Today.json"

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No site data changes to commit."
    exit 0
}

git commit -m "Update daily portfolio news for $Today"
git push

Write-Host "Portfolio news report pushed for $Today."

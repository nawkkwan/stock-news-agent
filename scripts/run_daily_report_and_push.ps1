$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

$Today = Get-Date -Format "yyyy-MM-dd"
$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Start-Transcript -Path (Join-Path $LogDir "daily-report-$Today.log") -Append

try {
    $Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $Python)) {
        $Python = "python"
    }

    function Assert-LastExitCode {
        param(
            [string]$Step,
            [int]$AllowedExitCode = 0
        )

        if ($LASTEXITCODE -ne $AllowedExitCode) {
            throw "$Step failed with exit code $LASTEXITCODE."
        }
    }

    $env:PYTHONUNBUFFERED = "1"

    Write-Host "Running portfolio news report for $Today..."

    $DirtyStatus = git status --porcelain
    if ($DirtyStatus) {
        Write-Host "Working tree has local changes; stashing them before pulling latest main..."
        git stash push -u -m "auto-stash before daily report $Today"
        Assert-LastExitCode "git stash push before pull"
    }

    git pull --rebase origin main
    Assert-LastExitCode "git pull --rebase origin main"

    & $Python ".\scripts\run_daily_report.py" --date $Today
    Assert-LastExitCode "run_daily_report.py"

    & $Python -c "import json, sys; p=json.load(open('site/data/latest-report.json', encoding='utf-8')); sys.exit(0 if p.get('date') == '$Today' else 1)"
    Assert-LastExitCode "latest-report.json date validation"

    git add "site\data\latest-report.json" "site\data\reports\$Today.json"
    Assert-LastExitCode "git add site data"

    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "No site data changes to commit."
        exit 0
    }

    git commit -m "Update daily portfolio news for $Today"
    Assert-LastExitCode "git commit"

    git push
    Assert-LastExitCode "git push"

    Write-Host "Portfolio news report pushed for $Today."
}
finally {
    Stop-Transcript
}

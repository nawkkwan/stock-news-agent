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

    & $Python ".\scripts\deploy_daily_report.py" --date $Today
    Assert-LastExitCode "deploy_daily_report.py"

    Write-Host "Portfolio news report flow completed for $Today."
}
finally {
    Stop-Transcript
}

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).resolve().parents[3]
SITE_DATA_DIR = ROOT_DIR / "apps" / "web" / "data"
LATEST_REPORT_PATH = SITE_DATA_DIR / "latest-report.json"
REPORT_TIMEZONE = "Asia/Bangkok"


def run_command(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
        check=check,
        text=True,
        capture_output=False,
    )


def default_report_date() -> str:
    return datetime.now(ZoneInfo(REPORT_TIMEZONE)).date().isoformat()


def load_latest_report() -> dict[str, Any]:
    if not LATEST_REPORT_PATH.exists():
        raise FileNotFoundError(f"Missing site data file: {LATEST_REPORT_PATH}")
    with LATEST_REPORT_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def validate_report(report_date: str) -> None:
    report = load_latest_report()
    if report.get("date") != report_date:
        raise RuntimeError(
            f"latest-report.json date mismatch: expected {report_date}, found {report.get('date')}"
        )

    summary = report.get("summary", {})
    total_articles = summary.get("total_articles")
    if not isinstance(total_articles, int) or total_articles <= 0:
        raise RuntimeError(
            "latest-report.json does not contain any articles; skipping deploy to avoid publishing an empty report."
        )


def run_python(script: str, *args: str) -> None:
    run_command([sys.executable, script, *args])


def git_commit_and_push(report_date: str) -> None:
    run_command(["git", "add", "apps/web/data/latest-report.json", f"apps/web/data/reports/{report_date}.json"])
    diff = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=ROOT_DIR,
        text=True,
    )
    if diff.returncode == 0:
        print("No site data changes to commit.")
        return
    if diff.returncode not in (0, 1):
        raise RuntimeError(f"git diff --cached --quiet failed with exit code {diff.returncode}")

    run_command(["git", "config", "user.name", "github-actions[bot]"])
    run_command(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"])
    run_command(["git", "commit", "-m", f"Update daily portfolio news for {report_date}"])
    run_command(["git", "push"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Run, validate, publish, and deploy the daily portfolio report.")
    parser.add_argument("--date", default=default_report_date())
    args = parser.parse_args()

    run_python("apps/worker/jobs/run_daily_report.py", "--date", args.date)
    validate_report(args.date)
    git_commit_and_push(args.date)


if __name__ == "__main__":
    main()

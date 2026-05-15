from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
SITE_DATA_DIR = ROOT_DIR / "site" / "data"
LATEST_REPORT_PATH = SITE_DATA_DIR / "latest-report.json"
GOOGLE_CREDENTIALS_PATH = ROOT_DIR / "credentials" / "credentials.json"
GOOGLE_TOKEN_PATH = ROOT_DIR / "token.json"


def run_command(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
        check=check,
        text=True,
        capture_output=False,
    )


def ensure_secret_file(env_name: str, target: Path) -> None:
    raw = os.getenv(env_name)
    if not raw:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(raw.strip() + "\n", encoding="utf-8")


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


def maybe_publish_google_doc(report_date: str) -> None:
    if not GOOGLE_CREDENTIALS_PATH.exists() or not GOOGLE_TOKEN_PATH.exists():
        print("Google Docs publishing skipped because credentials are missing.")
        return
    run_python("scripts/publish_google_doc.py", "--date", report_date)


def git_commit_and_push(report_date: str) -> None:
    run_command(["git", "add", "site/data/latest-report.json", f"site/data/reports/{report_date}.json"])
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
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    args = parser.parse_args()

    ensure_secret_file("GOOGLE_CREDENTIALS_JSON", ROOT_DIR / "credentials" / "credentials.json")
    ensure_secret_file("GOOGLE_TOKEN_JSON", ROOT_DIR / "token.json")

    run_python("scripts/run_daily_report.py", "--date", args.date)
    validate_report(args.date)
    maybe_publish_google_doc(args.date)
    git_commit_and_push(args.date)


if __name__ == "__main__":
    main()

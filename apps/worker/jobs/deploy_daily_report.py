from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[3]
LATEST_REPORT_PATH = ROOT_DIR / "apps" / "web" / "data" / "latest-report.json"
REPORT_TIMEZONE = "Asia/Bangkok"
REQUEST_TIMEOUT = (5, 30)


def default_report_date() -> str:
    return datetime.now(ZoneInfo(REPORT_TIMEZONE)).date().isoformat()


def load_latest_report() -> dict[str, Any]:
    with LATEST_REPORT_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def validate_report(report: dict[str, Any], report_date: str) -> None:
    if report.get("date") != report_date:
        raise RuntimeError(f"Report date mismatch: expected {report_date}.")
    if not isinstance(report.get("summary", {}).get("total_articles"), int):
        raise RuntimeError("Report summary is missing total_articles.")


class CloudPublisher:
    def __init__(self) -> None:
        self.url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self.user_id = os.getenv("OWNER_SUPABASE_USER_ID", "").strip()
        self.discord_webhook = os.getenv("DISCORD_WEBHOOK_URL", "").strip()
        if not self.url or not self.key or not self.user_id:
            raise RuntimeError("Supabase URL, service role key, and owner user ID are required.")
        self.session = requests.Session()
        self.session.headers.update({"apikey": self.key, "authorization": f"Bearer {self.key}", "content-type": "application/json"})

    def request(self, method: str, table: str, **kwargs: Any) -> Any:
        response = self.session.request(method, f"{self.url}/rest/v1/{table}", timeout=REQUEST_TIMEOUT, **kwargs)
        if not response.ok:
            raise RuntimeError(f"Supabase {table} request failed with status {response.status_code}.")
        return response.json() if response.content else None

    def portfolio_id(self) -> str:
        rows = self.request("GET", "portfolios", params={"select": "id", "user_id": f"eq.{self.user_id}", "limit": "1"})
        if not rows:
            raise RuntimeError("Owner account has no portfolio.")
        return str(rows[0]["id"])

    def record_job_failure(self, report_date: str, exc: Exception) -> None:
        safe_error = f"{type(exc).__name__}: daily report job failed"
        try:
            self.request(
                "POST",
                "agent_runs",
                json={
                    "user_id": self.user_id,
                    "portfolio_id": self.portfolio_id(),
                    "agent_role": "secretary",
                    "request": {"report_date": report_date, "job": "daily_digest"},
                    "response": None,
                    "status": "failed",
                    "error": safe_error,
                    "completed_at": datetime.now(ZoneInfo(REPORT_TIMEZONE)).isoformat(),
                },
            )
        except Exception:
            print("Could not persist the sanitized daily-job failure status.")

    def publish(self, report: dict[str, Any], report_date: str) -> None:
        portfolio_id = self.portfolio_id()
        summary = report.get("summary", {})
        digest = str(summary.get("daily_briefing") or summary.get("portfolio_summary") or "Daily portfolio report is ready.").strip()
        briefing_rows = self.request(
            "POST", "daily_briefings",
            params={"on_conflict": "user_id,report_date", "select": "id"},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            json={"user_id": self.user_id, "portfolio_id": portfolio_id, "report_date": report_date, "payload": report, "digest_text": digest, "status": "ready", "error": None},
        )
        briefing_id = briefing_rows[0]["id"]
        dedupe_key = f"discord:daily:{self.user_id}:{report_date}"
        claimed = self.request(
            "POST", "alert_deliveries",
            params={"on_conflict": "dedupe_key", "select": "id,status"},
            headers={"Prefer": "resolution=ignore-duplicates,return=representation"},
            json={"user_id": self.user_id, "portfolio_id": portfolio_id, "briefing_id": briefing_id, "channel": "discord", "dedupe_key": dedupe_key, "status": "pending", "error": None},
        )
        if not claimed:
            previous = self.request("GET", "alert_deliveries", params={"select": "status,error", "dedupe_key": f"eq.{dedupe_key}", "limit": "1"})
            if previous:
                delivery_status = previous[0]["status"]
                briefing_status = delivery_status if delivery_status in {"sent", "failed"} else "ready"
                self.request("PATCH", "daily_briefings", params={"id": f"eq.{briefing_id}"}, json={"status": briefing_status, "error": previous[0].get("error")})
            print("Discord digest delivery was already claimed; skipping duplicate delivery.")
            return
        try:
            if not self.discord_webhook:
                raise RuntimeError("DISCORD_WEBHOOK_URL is required for daily delivery.")
            delivery = requests.post(self.discord_webhook, json={"content": f"**Portfolio Daily Brief — {report_date}**\n{digest}"[:2000]}, timeout=REQUEST_TIMEOUT)
            delivery.raise_for_status()
        except Exception as exc:
            safe_error = f"{type(exc).__name__}: Discord delivery failed"
            self.request("PATCH", "alert_deliveries", params={"dedupe_key": f"eq.{dedupe_key}"}, json={"status": "failed", "error": safe_error})
            self.request("PATCH", "daily_briefings", params={"id": f"eq.{briefing_id}"}, json={"status": "failed", "error": safe_error})
            raise RuntimeError(safe_error) from exc
        self.request("PATCH", "alert_deliveries", params={"dedupe_key": f"eq.{dedupe_key}"}, json={"status": "sent", "sent_at": datetime.now(ZoneInfo(REPORT_TIMEZONE)).isoformat(), "error": None})
        self.request("PATCH", "daily_briefings", params={"id": f"eq.{briefing_id}"}, json={"status": "sent", "error": None})


def main() -> None:
    parser = argparse.ArgumentParser(description="Run, persist, and deliver the daily portfolio report.")
    parser.add_argument("--date", default=default_report_date())
    args = parser.parse_args()
    load_dotenv(ROOT_DIR / ".env")
    from run_daily_report import run_daily_report

    cloud = CloudPublisher()
    try:
        run_daily_report(args.date)
        report = load_latest_report()
        validate_report(report, args.date)
        cloud.publish(report, args.date)
    except Exception as exc:
        cloud.record_job_failure(args.date, exc)
        raise
    print(f"Published daily portfolio digest for {args.date}.")


if __name__ == "__main__":
    main()

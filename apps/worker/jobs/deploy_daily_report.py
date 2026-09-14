from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime
from email.utils import parsedate_to_datetime
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

    @staticmethod
    def _published_at(value: Any) -> str | None:
        if not value:
            return None
        try:
            return parsedate_to_datetime(str(value)).isoformat()
        except (TypeError, ValueError, OverflowError):
            return None

    def _ticker_map(self, portfolio_id: str) -> dict[str, str]:
        mapping: dict[str, str] = {}
        for table in ("holdings", "watchlist"):
            rows = self.request(
                "GET",
                table,
                params={"select": "ticker", "user_id": f"eq.{self.user_id}", "portfolio_id": f"eq.{portfolio_id}"},
            )
            for row in rows or []:
                ticker = str(row.get("ticker") or "").upper()
                if ticker:
                    mapping[ticker.split(".")[0]] = ticker
        return mapping

    def persist_stock_evidence(self, report: dict[str, Any], report_date: str, portfolio_id: str) -> None:
        ticker_map = self._ticker_map(portfolio_id)
        for stock in report.get("stocks", []):
            raw_ticker = str(stock.get("ticker") or "").upper()
            if not raw_ticker:
                continue
            ticker = ticker_map.get(raw_ticker.split(".")[0], raw_ticker)
            articles = stock.get("articles") if isinstance(stock.get("articles"), list) else []
            for article in articles[:20]:
                title = str(article.get("title") or "").strip()
                url = str(article.get("url") or "").strip()
                if not title:
                    continue
                source = str(article.get("source") or "Unknown source").strip()
                external_key = hashlib.sha256(f"{url or title}|{source}".encode("utf-8")).hexdigest()
                self.request(
                    "POST",
                    "news_items",
                    params={"on_conflict": "user_id,portfolio_id,ticker,external_key"},
                    headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                    json={
                        "user_id": self.user_id,
                        "portfolio_id": portfolio_id,
                        "ticker": ticker,
                        "title": title,
                        "url": url or None,
                        "source": source,
                        "published_at": self._published_at(article.get("published")),
                        "summary": stock.get("key_takeaway") or stock.get("key_news"),
                        "impact": "negative" if str(stock.get("risk_level") or "").lower() == "high" else "neutral",
                        "timeframe": "long_term" if "long" in str(stock.get("time_horizon") or "").lower() else "short_term",
                        "thesis_changed": False,
                        "external_key": external_key,
                    },
                )

            technical = stock.get("technical") if isinstance(stock.get("technical"), dict) else {}
            supports = [float(value) for value in technical.get("support_zones", []) if isinstance(value, (int, float))]
            review_zones = [zone for zone in technical.get("review_zones", []) if isinstance(zone, dict)]
            decision = {
                "summary": stock.get("key_takeaway") or stock.get("key_news") or "ยังไม่มีข่าวสำคัญใหม่",
                "facts": [stock.get("key_news")] if stock.get("key_news") else [],
                "inferences": [stock.get("possible_impact") or stock.get("impact")] if stock.get("possible_impact") or stock.get("impact") else [],
                "risks": stock.get("bearish_points") or [],
                "what_to_monitor": stock.get("what_to_monitor"),
                "sources": [{"title": item.get("title"), "url": item.get("url")} for item in articles[:8] if item.get("url")],
                "watch_zone": {
                    "zones": review_zones[:3],
                    "levels": supports[:3],
                    "lower": min(supports) if supports else None,
                    "upper": max(supports) if supports else None,
                    "rationale": "โซน Swing Low ที่ราคาเคยตอบสนองซ้ำ พร้อมคะแนน Touch, Volume, Recency และ Time span สำหรับกลับมาทบทวน ไม่ใช่สัญญาณซื้อ",
                    "conditions": [
                        "ตรวจว่าข่าวเปลี่ยนสมมติฐานธุรกิจหรือไม่",
                        "ตรวจแนวโน้มราคาและ Volume อีกครั้ง",
                        "ทบทวนน้ำหนักและความเสี่ยงรวมของพอร์ต",
                    ],
                },
            }
            self.request(
                "POST",
                "stock_research_snapshots",
                params={"on_conflict": "user_id,dedupe_key"},
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                json={
                    "user_id": self.user_id,
                    "portfolio_id": portfolio_id,
                    "ticker": ticker,
                    "source": "daily",
                    "as_of": f"{report_date}T18:00:00+07:00",
                    "market_snapshot": technical,
                    "decision_summary": decision,
                    "news_count": len(articles),
                    "status": "ready" if technical and articles else "partial",
                    "dedupe_key": f"daily:{portfolio_id}:{ticker}:{report_date}",
                },
            )

    @staticmethod
    def important_alerts(report: dict[str, Any]) -> list[dict[str, Any]]:
        important: list[dict[str, Any]] = []
        for stock in report.get("stocks", []):
            technical = stock.get("technical") if isinstance(stock.get("technical"), dict) else {}
            review_zones = [zone for zone in technical.get("review_zones", []) if isinstance(zone, dict)]
            close = technical.get("last_close")
            in_watch_zone = bool(
                review_zones
                and isinstance(close, (int, float))
                and any(
                    isinstance(zone.get("lower"), (int, float))
                    and isinstance(zone.get("upper"), (int, float))
                    and float(zone["lower"]) <= float(close) <= float(zone["upper"])
                    for zone in review_zones
                )
            )
            high_risk = str(stock.get("risk_level") or "").lower() == "high"
            high_impact = str(stock.get("relevance_score") or "").lower() == "high" and bool(stock.get("possible_impact") or stock.get("impact"))
            if high_risk or high_impact or in_watch_zone:
                important.append({**stock, "in_watch_zone": in_watch_zone})
        return important

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
        self.persist_stock_evidence(report, report_date, portfolio_id)
        important = self.important_alerts(report)
        if not important:
            print("No high-impact portfolio alert; saved the full report to the web without sending Discord.")
            return
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
            alert_lines = [
                f"• {item.get('ticker')}: {item.get('key_takeaway') or item.get('key_news') or item.get('what_to_monitor') or 'มีประเด็นสำคัญให้ตรวจ'}"
                + (" (เข้า Watch Zone)" if item.get("in_watch_zone") else "")
                for item in important[:5]
            ]
            content = f"**Portfolio Alert — {report_date}**\n" + "\n".join(alert_lines) + "\n\nรายละเอียดเต็มอยู่ในเว็บ Portfolio"
            delivery = requests.post(self.discord_webhook, json={"content": content[:2000]}, timeout=REQUEST_TIMEOUT)
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

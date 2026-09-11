from __future__ import annotations

import json
from datetime import UTC, date, datetime
from typing import Any
from urllib.parse import quote_plus

import feedparser
import requests

from apps.api.app.config import Settings


class ServiceError(RuntimeError):
    pass


class SupabasePortfolioStore:
    def __init__(self, settings: Settings):
        if not settings.supabase_backend_configured or not settings.owner_supabase_user_id:
            raise ServiceError("Supabase backend and owner user must be configured.")
        self.base_url = settings.supabase_url.rstrip("/")
        self.user_id = settings.owner_supabase_user_id
        self.session = requests.Session()
        self.session.headers.update({
            "apikey": settings.supabase_service_role_key,
            "authorization": f"Bearer {settings.supabase_service_role_key}",
            "content-type": "application/json",
        })

    def _request(self, method: str, table: str, **kwargs: Any) -> Any:
        response = self.session.request(method, f"{self.base_url}/rest/v1/{table}", timeout=(5, 20), **kwargs)
        if not response.ok:
            raise ServiceError(f"Supabase {table} request failed with status {response.status_code}.")
        return response.json() if response.content else None

    def portfolio(self) -> dict[str, Any]:
        rows = self._request("GET", "portfolios", params={"select": "*", "user_id": f"eq.{self.user_id}", "limit": "1"})
        if not rows:
            raise ServiceError("The owner account does not have a portfolio.")
        return rows[0]

    def context(self) -> dict[str, Any]:
        portfolio = self.portfolio()
        filters = {"user_id": f"eq.{self.user_id}", "portfolio_id": f"eq.{portfolio['id']}"}
        return {
            "portfolio": portfolio,
            "holdings": self._request("GET", "holdings", params={"select": "*", **filters}),
            "watchlist": self._request("GET", "watchlist", params={"select": "*", **filters}),
            "thesis": self._request("GET", "thesis_notes", params={"select": "*", **filters}),
            "news": self._request("GET", "news_items", params={"select": "*", "order": "published_at.desc", "limit": "100", **filters}),
        }

    def upsert_watchlist(self, ticker: str, reason: str, status: str) -> dict[str, Any]:
        portfolio = self.portfolio()
        payload = {"user_id": self.user_id, "portfolio_id": portfolio["id"], "ticker": ticker.upper(), "reason": reason or None, "status": status}
        rows = self._request(
            "POST",
            "watchlist",
            params={"on_conflict": "user_id,ticker", "select": "*"},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            json=payload,
        )
        return rows[0]

    def remove_watchlist(self, ticker: str) -> None:
        self._request("DELETE", "watchlist", params={"user_id": f"eq.{self.user_id}", "ticker": f"eq.{ticker.upper()}"})

    def latest_briefing(self) -> dict[str, Any] | None:
        rows = self._request("GET", "daily_briefings", params={"select": "*", "user_id": f"eq.{self.user_id}", "order": "report_date.desc", "limit": "1"})
        return rows[0] if rows else None

    def alert_status(self) -> dict[str, Any] | None:
        rows = self._request(
            "GET",
            "alert_deliveries",
            params={"select": "channel,status,error,sent_at,created_at", "user_id": f"eq.{self.user_id}", "order": "created_at.desc", "limit": "1"},
        )
        return rows[0] if rows else None

    def save_agent_run(self, role: str, request_data: dict[str, Any], response_data: dict[str, Any] | None, error: str | None = None) -> None:
        portfolio = self.portfolio()
        self._request("POST", "agent_runs", json={
            "user_id": self.user_id,
            "portfolio_id": portfolio["id"],
            "agent_role": role,
            "request": request_data,
            "response": response_data,
            "status": "failed" if error else "succeeded",
            "error": error,
            "completed_at": datetime.now(UTC).isoformat(),
        })


class GeminiAgentTeam:
    def __init__(self, settings: Settings, store: SupabasePortfolioStore):
        if not settings.gemini_api_key:
            raise ServiceError("GEMINI_API_KEY is not configured.")
        from google import genai

        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_model
        self.store = store
        self.eodhd_api_key = settings.eodhd_api_key

    @staticmethod
    def _news_context(query: str, limit: int = 8) -> list[dict[str, str]]:
        try:
            response = requests.get(
                f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en",
                timeout=(5, 15),
                headers={"User-Agent": "portfolio-investment-os/0.2"},
            )
            response.raise_for_status()
            feed = feedparser.parse(response.content)
            return [
                {
                    "title": str(entry.get("title", "")),
                    "url": str(entry.get("link", "")),
                    "published": str(entry.get("published", "")),
                }
                for entry in feed.entries[:limit]
            ]
        except Exception:
            return []

    def _market_context(self, ticker: str) -> dict[str, Any] | None:
        if not self.eodhd_api_key:
            return None
        symbol = ticker if "." in ticker else f"{ticker}.US"
        try:
            response = requests.get(
                f"https://eodhd.com/api/real-time/{symbol}",
                params={"api_token": self.eodhd_api_key, "fmt": "json"},
                timeout=(5, 15),
            )
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def _generate(self, role: str, instruction: str, payload: dict[str, Any]) -> dict[str, Any]:
        prompt = (
            "You are part of a private investment decision-support team. "
            "Never place trades, provide price targets, or issue buy/sell/hold instructions. "
            "Separate verified facts from inference and include source URLs when present.\n\n"
            f"Role: {role}\nTask: {instruction}\nContext: {json.dumps(payload, ensure_ascii=False)}"
        )
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": {
                        "type": "object",
                        "properties": {
                            "summary": {"type": "string"},
                            "facts": {"type": "array", "items": {"type": "string"}},
                            "inferences": {"type": "array", "items": {"type": "string"}},
                            "risks": {"type": "array", "items": {"type": "string"}},
                            "candidates": {"type": "array", "items": {"type": "string"}},
                            "route": {"type": "string"},
                            "sources": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {"title": {"type": "string"}, "url": {"type": "string"}},
                                    "required": ["title", "url"],
                                },
                            },
                            "next_action": {"type": "string"},
                        },
                        "required": ["summary", "facts", "inferences", "risks", "sources"],
                    },
                },
            )
            result = json.loads(response.text or "{}")
            self.store.save_agent_run(role, payload, result)
            return result
        except Exception as exc:
            safe_error = f"{type(exc).__name__}: agent provider request failed"
            self.store.save_agent_run(role, payload, None, safe_error)
            raise ServiceError(safe_error) from exc

    def research(self, ticker: str, question: str) -> dict[str, Any]:
        context = self.store.context()
        normalized = ticker.upper()
        return self._generate(
            "research",
            "Research the requested ticker in Thai and answer the question using only the supplied evidence. Mark missing or uncertain facts clearly.",
            {
                "ticker": normalized,
                "question": question,
                "portfolio_context": context,
                "market_snapshot": self._market_context(normalized),
                "recent_news": self._news_context(f'"{normalized}" stock'),
            },
        )

    def discover(self, criteria: str, limit: int) -> dict[str, Any]:
        return self._generate(
            "discovery",
            "Return a research shortlist only; do not add anything to the watchlist. Cite supplied source URLs and label every inference.",
            {
                "criteria": criteria,
                "limit": limit,
                "portfolio_context": self.store.context(),
                "theme_news": self._news_context(f"stocks {criteria}", limit=12),
            },
        )

    def lead(self, command: str) -> dict[str, Any]:
        return self._generate(
            "lead",
            "Classify this Hermes command for research, discovery, secretary, portfolio_context, or watchlist. Return a safe routing recommendation only. Refuse holdings, transaction, or trading changes.",
            {"command": command, "allowed_actions": ["research", "discovery", "secretary", "portfolio_context", "watchlist"]},
        )

    def digest(self, report_date: str | None = None) -> dict[str, Any]:
        return self._generate("secretary", "Create one concise Thai daily Discord digest for holdings and watchlist.", {"report_date": report_date or date.today().isoformat(), "portfolio_context": self.store.context()})

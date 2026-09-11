import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pandas as pd

from apps.api.app.services import GeminiAgentTeam, ServiceError


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


technicals = load_module("test_analyze_technicals", ROOT / "apps" / "worker" / "prices" / "analyze_technicals.py")
publisher = load_module("test_deploy_daily_report", ROOT / "apps" / "worker" / "jobs" / "deploy_daily_report.py")


class FakeStore:
    def __init__(self):
        self.runs = []

    def context(self):
        return {"portfolio": {"id": "portfolio-1"}, "holdings": [], "watchlist": []}

    def save_agent_run(self, role, request, response, error=None):
        self.runs.append({"role": role, "request": request, "response": response, "error": error})


class AgentWorkerTests(unittest.TestCase):
    def test_provider_timeout_is_sanitized_and_recorded(self):
        store = FakeStore()
        team = GeminiAgentTeam.__new__(GeminiAgentTeam)
        team.client = SimpleNamespace(models=SimpleNamespace(generate_content=Mock(side_effect=TimeoutError("secret-value"))))
        team.model = "gemini-3.5-flash"
        team.store = store

        with self.assertRaisesRegex(ServiceError, "agent provider request failed") as raised:
            team._generate("research", "task", {"ticker": "MSFT"})

        self.assertNotIn("secret-value", str(raised.exception))
        self.assertEqual(store.runs[0]["role"], "research")
        self.assertIn("TimeoutError", store.runs[0]["error"])

    def test_research_passes_market_and_news_evidence(self):
        team = GeminiAgentTeam.__new__(GeminiAgentTeam)
        team.store = FakeStore()
        team._market_context = Mock(return_value={"close": 100})
        team._news_context = Mock(return_value=[{"title": "News", "url": "https://example.com"}])
        team._generate = Mock(return_value={"ok": True})

        result = team.research("msft", "risk?")

        self.assertEqual(result, {"ok": True})
        payload = team._generate.call_args.args[2]
        self.assertEqual(payload["ticker"], "MSFT")
        self.assertEqual(payload["market_snapshot"]["close"], 100)
        self.assertEqual(len(payload["recent_news"]), 1)

    def test_eodhd_failure_uses_yahoo_fallback(self):
        dates = pd.date_range("2025-01-01", periods=250, freq="D")
        frame = pd.DataFrame({"Close": range(100, 350), "Volume": [1000] * 250}, index=dates)
        with patch.object(technicals, "fetch_price_frame_eodhd", side_effect=TimeoutError()), patch.object(
            technicals, "fetch_price_frame_yahoo", return_value=frame
        ):
            result = technicals.analyze_ticker("MSFT", "Microsoft")
        self.assertEqual(result["provider"], "yahoo-fallback")

    def test_sent_digest_is_not_delivered_twice(self):
        cloud = publisher.CloudPublisher.__new__(publisher.CloudPublisher)
        cloud.user_id = "user-1"
        cloud.discord_webhook = "https://discord.invalid"
        cloud.portfolio_id = Mock(return_value="portfolio-1")

        def request(method, table, **kwargs):
            if table == "daily_briefings":
                return [{"id": "brief-1"}]
            if table == "alert_deliveries" and method == "POST":
                return []
            if table == "alert_deliveries" and method == "GET":
                return [{"status": "sent"}]
            return None

        cloud.request = Mock(side_effect=request)
        with patch.object(publisher.requests, "post") as post:
            cloud.publish({"summary": {"daily_briefing": "done"}}, "2026-09-11")
        post.assert_not_called()


if __name__ == "__main__":
    unittest.main()

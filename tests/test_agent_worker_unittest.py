import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import json

import pandas as pd
from fastapi import HTTPException

from apps.api.app.config import Settings
from apps.api.app.security import require_supabase_user
from apps.api.app.services import GeminiAgentTeam, HermesAgentClient, ServiceError, SupabasePortfolioStore
from apps.api.app.schemas import RoomChatRequest
from apps.api.app import main as api_main


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


class FakeRunStore(FakeStore):
    def __init__(self):
        super().__init__()
        self.updated = []

    def create_agent_run(self, role, request):
        self.runs.append({"role": role, "request": request})
        return {"id": "7d824bd4-2df4-4a64-b334-5db40e235c69"}

    def update_agent_run(self, run_id, status, response_data=None, error=None):
        self.updated.append({"run_id": run_id, "status": status, "response": response_data, "error": error})


class AgentWorkerTests(unittest.TestCase):
    def test_supabase_access_token_resolves_verified_user(self):
        settings = Settings(
            supabase_url="https://project.supabase.co",
            supabase_publishable_key="publishable-key",
        )
        response = Mock(status_code=200)
        response.json.return_value = {"id": "verified-user"}

        with patch("apps.api.app.security.get_settings", return_value=settings), patch(
            "apps.api.app.security.requests.get", return_value=response
        ) as get:
            user_id = require_supabase_user("Bearer access-token")

        self.assertEqual(user_id, "verified-user")
        self.assertEqual(get.call_args.kwargs["headers"]["authorization"], "Bearer access-token")

    def test_invalid_supabase_access_token_is_rejected(self):
        settings = Settings(
            supabase_url="https://project.supabase.co",
            supabase_publishable_key="publishable-key",
        )
        with patch("apps.api.app.security.get_settings", return_value=settings), patch(
            "apps.api.app.security.requests.get", return_value=Mock(status_code=401)
        ):
            with self.assertRaises(HTTPException) as raised:
                require_supabase_user("Bearer expired-token")
        self.assertEqual(raised.exception.status_code, 401)

    def test_portfolio_store_uses_verified_user_instead_of_owner(self):
        settings = Settings(
            supabase_url="https://project.supabase.co",
            supabase_service_role_key="service-key",
            owner_supabase_user_id="owner-user",
        )
        store = SupabasePortfolioStore(settings, user_id="verified-user")
        self.assertEqual(store.user_id, "verified-user")

    def test_room_chat_maps_visible_agent_to_backend_role(self):
        team = GeminiAgentTeam.__new__(GeminiAgentTeam)
        team.store = FakeStore()
        team._generate = Mock(return_value={"summary": "done"})

        role, result = team.room_chat("analyst", "พอร์ตเสี่ยงอะไร")

        self.assertEqual(role, "research")
        self.assertEqual(result, {"summary": "done"})
        self.assertEqual(team._generate.call_args.args[2]["question"], "พอร์ตเสี่ยงอะไร")

    def test_provider_timeout_is_sanitized_and_recorded(self):
        store = FakeStore()
        team = GeminiAgentTeam.__new__(GeminiAgentTeam)
        team.gemini_api_key = "test-key"
        team.model = "gemini-3.5-flash"
        team.store = store

        with patch("apps.api.app.services.requests.post", side_effect=TimeoutError("secret-value")):
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

    def test_hermes_run_uses_bearer_auth_and_owner_session_scope(self):
        settings = Settings(
            hermes_base_url="http://investment-hermes",
            hermes_api_key="hermes-secret",
        )
        client = HermesAgentClient(settings)
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"run_id": "run-hermes-1", "status": "started"}

        with patch("apps.api.app.services.requests.post", return_value=response) as post:
            run_id = client.start_run(
                user_id="owner-user",
                agent="analyst",
                question="สรุปความเสี่ยง",
                context={"portfolio": {"id": "p1"}, "holdings": []},
                idempotency_key="local-run-id",
            )

        self.assertEqual(run_id, "run-hermes-1")
        self.assertEqual(post.call_args.kwargs["headers"]["authorization"], "Bearer hermes-secret")
        self.assertEqual(post.call_args.kwargs["headers"]["idempotency-key"], "local-run-id")
        self.assertEqual(post.call_args.kwargs["headers"]["x-hermes-session-key"], "portfolio-owner:web:owner-user")
        self.assertNotIn("hermes-secret", json.dumps(post.call_args.kwargs["json"]))

    def test_owner_chat_starts_hermes_without_using_gemini(self):
        store = FakeRunStore()
        owner_settings = Settings(
            owner_supabase_user_id="owner-user",
            hermes_base_url="http://investment-hermes",
            hermes_api_key="hermes-secret",
        )
        with patch.object(api_main, "settings", owner_settings), patch.object(
            api_main.HermesAgentClient, "start_run", return_value="run-hermes-1"
        ), patch.object(api_main, "GeminiAgentTeam") as gemini:
            response = api_main.user_room_chat(
                RoomChatRequest(agent="scout", question="หาข่าวสำคัญ"),
                "owner-user",
                store,
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(json.loads(response.body)["mode"], "hermes")
        self.assertEqual(store.runs[0]["role"], "discovery")
        self.assertEqual(store.updated[0]["response"]["hermes_run_id"], "run-hermes-1")
        gemini.assert_not_called()

    def test_friend_chat_keeps_existing_gemini_flow(self):
        store = FakeRunStore()
        owner_settings = Settings(owner_supabase_user_id="owner-user")
        fake_team = Mock()
        fake_team.room_chat.return_value = ("research", {"summary": "friend result"})
        with patch.object(api_main, "settings", owner_settings), patch.object(
            api_main, "GeminiAgentTeam", return_value=fake_team
        ):
            response = api_main.user_room_chat(
                RoomChatRequest(agent="analyst", question="พอร์ตของฉัน"),
                "friend-user",
                store,
            )

        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["mode"], "gemini")
        self.assertEqual(payload["result"]["summary"], "friend result")

    def test_owner_run_completion_is_persisted_and_returned(self):
        store = FakeRunStore()
        store.get_agent_run = Mock(return_value={
            "status": "running",
            "response": {"hermes_run_id": "run-hermes-1"},
        })
        owner_settings = Settings(
            owner_supabase_user_id="owner-user",
            hermes_base_url="http://investment-hermes",
            hermes_api_key="hermes-secret",
        )
        with patch.object(api_main, "settings", owner_settings), patch.object(
            api_main.HermesAgentClient, "get_run", return_value={"status": "completed", "output": "done"}
        ):
            response = api_main.user_agent_run_status(
                "7d824bd4-2df4-4a64-b334-5db40e235c69",
                "owner-user",
                store,
            )

        self.assertEqual(response["status"], "succeeded")
        self.assertEqual(response["result"]["summary"], "done")
        self.assertEqual(store.updated[0]["status"], "succeeded")

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

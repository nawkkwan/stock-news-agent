import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from apps.api.app.security import require_hermes_owner, require_internal_token
from apps.api.app import main as api_main
from apps.api.app.config import Settings
from apps.api.app.services import SupabasePortfolioStore


class ApiSecurityTests(unittest.TestCase):
    def test_research_source_count_uses_unique_urls(self) -> None:
        result = {
            "sources": [
                {"title": "one", "url": "https://example.com/one"},
                {"title": "duplicate", "url": "https://example.com/one"},
                {"title": "two", "url": "https://example.com/two"},
            ]
        }
        self.assertEqual(api_main.research_source_count(result, fallback=9), 2)

    def test_persist_hermes_thesis_keeps_owner_thesis_out_of_write_path(self) -> None:
        captured = {}
        store = SimpleNamespace(
            upsert_hermes_thesis=lambda ticker, thesis, **kwargs: captured.update(
                {"ticker": ticker, "thesis": thesis, **kwargs}
            ) or {"id": "hermes-thesis"}
        )
        result = {
            "summary": "Hermes view",
            "sources": [{"title": "filing", "url": "https://example.com/filing"}],
            "hermes_thesis": {"business_overview": "Evidence-backed overview"},
        }

        saved = api_main.persist_hermes_thesis(store, "OKLO.US", result, "run-id")

        self.assertEqual(saved, {"id": "hermes-thesis"})
        self.assertEqual(captured["ticker"], "OKLO.US")
        self.assertEqual(captured["source_run_id"], "run-id")
        self.assertEqual(captured["thesis"]["business_overview"], "Evidence-backed overview")

    def test_pixel_agent_append_writes_hermes_thesis_table(self) -> None:
        writes = []
        store = object.__new__(SupabasePortfolioStore)
        store.user_id = "owner-user"
        store.portfolio = lambda: {"id": "portfolio-id"}

        def request(method, table, **kwargs):
            if method == "GET":
                return []
            writes.append((table, kwargs["json"]))
            return [{"id": "hermes-thesis", **kwargs["json"]}]

        store._request = request
        saved = store.append_hermes_thesis_note("oklo.us", "bull_case", "New evidence")

        self.assertTrue(saved["appended"])
        self.assertEqual(writes[0][0], "hermes_thesis_notes")
        self.assertEqual(writes[0][1]["bull_case"], "New evidence")

    def test_internal_token_rejects_wrong_value(self) -> None:
        with patch("apps.api.app.security.get_settings", return_value=SimpleNamespace(internal_api_token="expected")):
            with self.assertRaises(HTTPException) as error:
                require_internal_token("Bearer wrong")
        self.assertEqual(error.exception.status_code, 401)

    def test_internal_token_accepts_expected_value(self) -> None:
        with patch("apps.api.app.security.get_settings", return_value=SimpleNamespace(internal_api_token="expected")):
            require_internal_token("Bearer expected")

    def test_hermes_owner_rejects_other_discord_user(self) -> None:
        settings = SimpleNamespace(discord_owner_user_id="123")
        with patch("apps.api.app.security.get_settings", return_value=settings):
            with self.assertRaises(HTTPException) as error:
                require_hermes_owner(None, "999")
        self.assertEqual(error.exception.status_code, 403)

    def test_hermes_owner_accepts_configured_user(self) -> None:
        settings = SimpleNamespace(discord_owner_user_id="123")
        with patch("apps.api.app.security.get_settings", return_value=settings):
            require_hermes_owner(None, "123")

    def test_non_owner_cannot_poll_hermes_run(self) -> None:
        with patch.object(api_main, "settings", Settings(owner_supabase_user_id="owner-user")):
            with self.assertRaises(HTTPException) as error:
                api_main.user_agent_run_status(
                    "7d824bd4-2df4-4a64-b334-5db40e235c69",
                    "friend-user",
                    SimpleNamespace(),
                )
        self.assertEqual(error.exception.status_code, 403)

    def test_forged_owner_run_id_is_not_found(self) -> None:
        store = SimpleNamespace(get_agent_run=lambda _run_id: None)
        with patch.object(api_main, "settings", Settings(owner_supabase_user_id="owner-user")):
            with self.assertRaises(HTTPException) as error:
                api_main.user_agent_run_status(
                    "7d824bd4-2df4-4a64-b334-5db40e235c69",
                    "owner-user",
                    store,
                )
        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()

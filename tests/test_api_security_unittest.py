import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from apps.api.app.security import require_hermes_owner, require_internal_token
from apps.api.app import main as api_main
from apps.api.app.config import Settings


class ApiSecurityTests(unittest.TestCase):
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

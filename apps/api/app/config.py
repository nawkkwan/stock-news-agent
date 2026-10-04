from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[3]
load_dotenv(ROOT_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass(frozen=True)
class Settings:
    service_name: str = "investment-research-api"
    service_version: str = "0.5.0"
    environment: str = _env("APP_ENV", "local")
    api_port: int = int(_env("API_PORT", "8000") or "8000")
    supabase_url: str = _env("NEXT_PUBLIC_SUPABASE_URL")
    supabase_publishable_key: str = _env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    supabase_service_role_key: str = _env("SUPABASE_SERVICE_ROLE_KEY")
    owner_supabase_user_id: str = _env("OWNER_SUPABASE_USER_ID")
    internal_api_token: str = _env("INTERNAL_API_TOKEN")
    discord_owner_user_id: str = _env("DISCORD_OWNER_USER_ID")
    discord_webhook_url: str = _env("DISCORD_WEBHOOK_URL")
    gemini_api_key: str = _env("GEMINI_API_KEY")
    agent_provider: str = _env("AGENT_PROVIDER", "gemini")
    gemini_model: str = _env("GEMINI_MODEL", "gemini-2.5-flash-lite")
    eodhd_api_key: str = _env("EODHD_API_KEY")
    hermes_base_url: str = _env("HERMES_BASE_URL")
    hermes_api_key: str = _env("HERMES_API_KEY")
    hermes_request_timeout_seconds: int = int(_env("HERMES_REQUEST_TIMEOUT_SECONDS", "20") or "20")
    tidb_host: str = _env("TIDB_HOST")
    tidb_port: str = _env("TIDB_PORT", "4000")
    tidb_user: str = _env("TIDB_USER")
    tidb_password: str = _env("TIDB_PASSWORD")
    tidb_database: str = _env("TIDB_DATABASE")
    tidb_ssl_ca: str = _env("TIDB_SSL_CA")

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key)

    @property
    def supabase_backend_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def tidb_configured(self) -> bool:
        return bool(
            self.tidb_host
            and self.tidb_port
            and self.tidb_user
            and self.tidb_password
            and self.tidb_database
        )

    @property
    def hermes_configured(self) -> bool:
        return bool(
            self.hermes_base_url
            and self.hermes_api_key
            and self.owner_supabase_user_id
            and self.supabase_backend_configured
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

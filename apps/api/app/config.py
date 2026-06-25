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
    service_version: str = "0.1.0"
    environment: str = _env("APP_ENV", "local")
    api_port: int = int(_env("API_PORT", "8000") or "8000")
    supabase_url: str = _env("NEXT_PUBLIC_SUPABASE_URL")
    supabase_publishable_key: str = _env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    supabase_service_role_key: str = _env("SUPABASE_SERVICE_ROLE_KEY")
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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

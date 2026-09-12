import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
import requests

from apps.api.app.config import get_settings


def require_internal_token(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = get_settings().internal_api_token
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not expected:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Internal API token is not configured.")
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal API token.")


def require_hermes_owner(
    _: Annotated[None, Depends(require_internal_token)],
    x_discord_user_id: Annotated[str | None, Header()] = None,
) -> None:
    expected = get_settings().discord_owner_user_id
    if not expected:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Discord owner is not configured.")
    if not x_discord_user_id or not hmac.compare_digest(x_discord_user_id.strip(), expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Discord user is not allowed.")


def require_supabase_user(authorization: Annotated[str | None, Header()] = None) -> str:
    settings = get_settings()
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    api_key = settings.supabase_publishable_key or settings.supabase_service_role_key
    if not settings.supabase_url or not api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Supabase Auth is not configured.")
    if not supplied:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase access token is required.")

    try:
        response = requests.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": api_key, "authorization": f"Bearer {supplied}"},
            timeout=(5, 20),
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Supabase Auth is temporarily unavailable.") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Supabase access token.")
    user_id = str(response.json().get("id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase user could not be verified.")
    return user_id

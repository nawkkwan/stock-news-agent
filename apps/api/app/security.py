import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

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

# Investment Research API

FastAPI service for the Investment Research Engine and Hermes integration.

Current scope:

- Internal Hermes API protected by a bearer token and one Discord owner ID.
- Portfolio context, research, discovery, watchlist, briefing, and digest endpoints.
- Supabase is accessed server-side with the service-role key; Hermes never receives that key.
- No trading or holdings/transaction write endpoints.

Run locally:

```powershell
python -m uvicorn apps.api.app.main:app --reload --host 127.0.0.1 --port 8000
```

Check imports:

```powershell
python apps/api/check_api.py
```

Endpoints:

- `GET /health`
- `GET /version`
- `GET /v1/portfolio/context`
- `POST /v1/agent/dispatch`
- `POST /v1/agent/chat`
- `POST /v1/user/agent/chat` (Supabase user access token)
- `POST /v1/research`
- `POST /v1/discover`
- `POST /v1/watchlist`
- `DELETE /v1/watchlist/{ticker}`
- `GET /v1/briefings/latest`
- `GET /v1/alerts/status`
- `POST /v1/digest/run`

Hermes endpoints require `Authorization: Bearer ...` and `X-Discord-User-ID`. The digest endpoint uses only the internal bearer token for Azure scheduled jobs.

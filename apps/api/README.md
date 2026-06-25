# Investment Research API

FastAPI service for the Investment Research Engine foundation.

Current scope:

- Health and version endpoints.
- Environment readiness checks for Supabase and TiDB.
- No trading, backtesting, or production data migration yet.

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

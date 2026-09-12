# Hermes Discord integration

Hermes remains a separate service and calls the Investment Research API over HTTPS.

Every request must include:

```text
Authorization: Bearer <INTERNAL_API_TOKEN>
X-Discord-User-ID: <DISCORD_OWNER_USER_ID>
```

Command mapping:

| Discord command | API call |
|---|---|
| free-form command routing | `POST /v1/agent/dispatch` |
| Pixel Room role chat | `POST /v1/agent/chat` |
| `/portfolio` | `GET /v1/portfolio/context` |
| `/research TICKER` | `POST /v1/research` |
| `/discover CRITERIA` | `POST /v1/discover` |
| `/watch add TICKER` | `POST /v1/watchlist` |
| `/watch remove TICKER` | `DELETE /v1/watchlist/{ticker}` |
| `/brief` | `GET /v1/briefings/latest` |
| `/alerts status` | `GET /v1/alerts/status` |

Hermes must never receive the Supabase service-role key. The API permits only the configured Discord owner and exposes no holdings or transaction write endpoint.

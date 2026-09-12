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

## Runtime in this repository

`apps/hermes` is the Discord gateway bridge. It registers `/ask`, `/portfolio`,
`/research`, `/discover`, `/watch add`, `/watch remove`, `/brief`, and
`/alerts status`, then forwards authorized commands to the API above.

Required environment variables:

- `DISCORD_BOT_TOKEN`
- `DISCORD_OWNER_USER_ID`
- `API_BASE_URL`
- `INTERNAL_API_TOKEN`

Set `DISCORD_GUILD_ID` during testing so commands appear in that server
immediately. Without it, Discord global command registration can take longer.

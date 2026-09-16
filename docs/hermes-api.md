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

`POST /v1/research` now saves a per-stock Research History snapshot automatically.
The snapshot keeps the structured summary, facts, inferences, risks, and source URLs
returned by the research agent. When the response contains `hermes_thesis`, the API
upserts it into `hermes_thesis_notes`, which is intentionally separate from the
owner's `thesis_notes` row.

PixelAgent can add a note to Hermes's thesis with `POST /v1/thesis/append`. The
allowed section names match the owner thesis form, but this endpoint never writes to
the owner's thesis table. `POST /v1/research-notes` remains available for explicitly
capturing one news or research note with an optional source URL.

The Pixel room sends up to five recent question/answer turns with each chat request.
An explicit save request resolves the ticker from the request or recent conversation
and marks the run `room_thesis_save`. The run must return structured `hermes_thesis`
before it is written to `hermes_thesis_notes`; otherwise the UI reports a failure,
not a false saved confirmation. The owner's form writes only to `thesis_notes`, with
its own required title. Apply `20260914103000_hermes_thesis_notes.sql` followed by
`20260916175005_thesis_titles.sql` before deploying the API and web changes.

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

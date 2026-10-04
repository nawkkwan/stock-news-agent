# Hermes integration - archived

Hermes was previously deployed as an Azure Container App and accepted asynchronous runs from FastAPI. The web owner path created a run, polled its status, then stored research snapshots and Hermes thesis data in Supabase.

The Discord bridge under `apps/hermes` also supports forwarding owner-only Discord commands to FastAPI with:

```text
Authorization: Bearer <INTERNAL_API_TOKEN>
X-Discord-User-ID: <DISCORD_OWNER_USER_ID>
```

This integration is now paused. The active web path calls Gemini directly through FastAPI and does not require `HERMES_BASE_URL`, `HERMES_API_KEY`, `DISCORD_BOT_TOKEN`, or a polling loop.

The following code remains for historical reference and possible future experiments:

- `apps/hermes`
- `docker/Dockerfile.hermes`
- legacy internal endpoints under `/v1/*`
- legacy polling endpoint `/v1/user/agent/runs/{run_id}`

Do not deploy these components unless a new project explicitly needs Hermes or Discord. They are not required by the Render service defined in `render.yaml`.

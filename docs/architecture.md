# Architecture

## Active production path

```text
Browser
  -> Cloudflare-hosted Next.js web
  -> Render Free FastAPI (/v1/user/*)
  -> Gemini API + Google News RSS + optional EODHD
  -> Supabase Auth/Postgres
```

- Supabase remains the source of truth. No database migration is part of the Render move.
- The browser authenticates with Supabase. The web forwards the user access token to FastAPI.
- The Supabase service-role key is backend-only and must never be exposed to the browser.
- FastAPI calls Gemini directly and returns a synchronous response. There is no active Hermes polling path.
- Render uses the native Python runtime from `render.yaml`; Azure Container Registry is not required.
- Render Free may sleep after inactivity, so the web proxy allows up to 150 seconds for a cold start plus Gemini work.

## Paused components

The daily worker, Discord webhook digest, and Hermes Discord gateway are paused. Their source remains in the repository for reference, but no scheduled production runtime is configured.

## Preserved data model

The existing `hermes_thesis_notes` table remains in place to avoid a risky data migration. In the user interface it is presented as Agent thesis: new rows are produced by Gemini, while old Hermes provenance remains visible through `source_kind`.

TiDB remains a possible future research warehouse and is not part of the active production path.

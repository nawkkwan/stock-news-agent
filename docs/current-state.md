# Current State

Current Version: v0.5

## Active

- Cloudflare-hosted Next.js Investment OS
- Supabase Auth, Postgres, RLS, portfolio data, journal, watchlist, owner thesis, and Agent thesis history
- FastAPI prepared for Render Free through `render.yaml`
- Direct Gemini chat and stock research for every authenticated account
- Google News RSS research context and optional EODHD market history
- Research snapshots and agent-run history stored in Supabase
- Owner thesis and AI Agent thesis kept separate

## Paused

- Hermes web runtime
- Hermes Discord gateway
- Daily worker schedule
- Discord daily webhook digest

## Retired deployment

The Azure resource group `investment-os-eastasia-rg` was the previous production stack. It contained the API, daily worker, always-on Hermes service, registry, storage, managed environment, and Log Analytics workspaces. The migration record and shutdown checklist are documented in the handoff PDF.

## Not implemented

- Automated daily price ingestion after the worker pause
- TiDB production ingestion
- Paper trading
- Real trading

The system remains research and decision support only.

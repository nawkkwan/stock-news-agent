# Architecture

Current architecture:

```text
apps/web
  Next.js App Router
  Supabase Auth
  Supabase Postgres

apps/api
  FastAPI internal Hermes API
  owner-only portfolio, research, discovery, and watchlist endpoints

apps/worker
  Python report jobs
  Google News RSS
  AI summary providers
  site data export
  Supabase briefing persistence
  Discord daily digest delivery

supabase
  schema.sql
  migrations/
```

Deployment architecture:

```text
Hermes Discord bot (Azure Container App, one replica)
  calls FastAPI with an internal token and owner Discord ID

FastAPI (Azure Container App)
  reads one Supabase portfolio and invokes Gemini agents

Daily worker (Azure Container Apps Job)
  runs at 11:00 UTC / 18:00 Asia/Bangkok

TiDB
  research warehouse for prices, news, sentiment, theme history, and future backtests

apps/bot
  future paper trading and strategy experiments
```

Supabase is the source of truth. Each Auth user owns exactly one portfolio. All portfolio data is constrained by both `user_id` and `portfolio_id`. TiDB remains a future research warehouse, not the app database.

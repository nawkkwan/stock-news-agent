# Architecture

Current architecture:

```text
apps/web
  Next.js App Router
  Supabase Auth
  Supabase Postgres

apps/api
  FastAPI foundation API
  environment readiness endpoints

apps/worker
  Python report jobs
  Google News RSS
  AI summary providers
  site data export

supabase
  schema.sql
  migrations/
```

Planned architecture:

```text
Discord or notification channel
  receives worker alerts

TiDB
  research warehouse for prices, news, sentiment, theme history, and future backtests

apps/bot
  future paper trading and strategy experiments
```

Supabase is the source of truth for portfolio data. The portfolio layer starts at `portfolios`, with holdings and portfolio transactions linked by `portfolio_id`. TiDB is planned as the research warehouse, not the app database. Generated daily report JSON lives under `apps/web/data`.

# Portfolio Investment OS

Portfolio Investment OS is Kwan's private workspace for portfolio tracking, investment journaling, thesis notes, watchlists, and daily portfolio news analysis.

The project is decision support only. It does not place trades, give financial advice, issue price targets, or implement real trading.

## Structure

```text
portfolio-investment-os/
├── CODEX.md
├── docs/
├── knowledge/
├── apps/
│   ├── web/
│   └── worker/
├── packages/
├── supabase/
├── .github/
├── docker/
├── legacy/
├── data/
├── prompts/
└── reports/
```

## Apps

- `apps/web`: Next.js App Router app backed by Supabase Auth and Supabase Postgres.
- `apps/api`: FastAPI foundation service for research API readiness.
- `apps/worker`: Python daily news/report worker.
- `legacy/mongo-journal-api`: archived MongoDB journal API kept for reference only.
- `legacy/static-site`: archived static site assets kept for reference only.

## Supabase

The active database source of truth is:

```text
supabase/schema.sql
```

The active journal table is:

```text
investment_journal
```

The migration that preserves existing journal rows is:

```text
supabase/migrations/202606170002_rename_decision_journal_to_investment_journal.sql
```

The migration that enables separate portfolios is:

```text
supabase/migrations/202606250001_multi_portfolio_foundation.sql
```

Core Investment OS tables:

- `portfolios`
- `companies`
- `holdings`
- `portfolio_transactions`
- `watchlist`
- `thesis_notes`
- `investment_journal`
- `news_items`

## Environment

Copy `.env.example` to `.env` and set:

```text
APP_ENV=local
API_PORT=8000
WEB_PORT=3000
OPENAI_API_KEY=optional
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=optional
EODHD_API_KEY=optional-for-global-symbol-search-and-latest-quotes
ALPHA_VANTAGE_API_KEY=optional-for-global-symbol-search-and-latest-quotes
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=backend-only-service-role-key
SUPABASE_USER_ID=auth-user-id-for-daily-worker
SUPABASE_PORTFOLIO_NAME=My Ports
TIDB_HOST=your-tidb-host
TIDB_PORT=4000
TIDB_USER=your-tidb-user
TIDB_PASSWORD=your-tidb-password
TIDB_DATABASE=investment_research
```

## Web App

The Overview page is portfolio-first: select one portfolio, then assets, cash movements, transactions, and filtered news all belong to that portfolio.

Global asset search and latest quote lookup use EODHD first, then Alpha Vantage fallback, when these server-side env vars are set:

```text
EODHD_API_KEY=your_eodhd_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

Without this key, the portfolio still works, but symbol search/quote lookup will show a configuration message.

Install and build:

```powershell
npm --prefix apps/web install
npm --prefix apps/web run build
```

Run locally:

```powershell
npm --prefix apps/web run dev
```

For Vercel, set the project root to:

```text
apps/web
```

## Daily News Worker

Run the full daily report:

```powershell
python apps/worker/jobs/run_daily_report.py
```

Run and commit deployable web data:

```powershell
python apps/worker/jobs/deploy_daily_report.py
```

The worker reads Supabase holdings and portfolio transactions when these backend-only variables are set:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_USER_ID
SUPABASE_PORTFOLIO_ID or SUPABASE_PORTFOLIO_NAME
```

If Supabase worker variables are not set, it falls back to:

```text
data/portfolio.json
prompts/portfolio_news_prompt.md
```

It writes generated report artifacts to `reports/` and deployable web JSON to:

```text
apps/web/data/latest-report.json
apps/web/data/reports/YYYY-MM-DD.json
```

## FastAPI Foundation

Run locally:

```powershell
python -m uvicorn apps.api.app.main:app --reload --host 127.0.0.1 --port 8000
```

Check imports:

```powershell
python apps/api/check_api.py
```

Docker:

```powershell
docker compose -f docker/docker-compose.dev.yml up api
```

## Automation

GitHub Actions daily news workflow:

```text
.github/workflows/daily-news.yml
```

It runs the Python worker and commits updated web data when the generated report is valid.

## Project Rules

Start with `CODEX.md`, then read:

1. `docs/project-overview.md`
2. `docs/architecture.md`
3. `docs/current-state.md`
4. `docs/todo.md`

Before changing architecture, deleting tables, or implementing any real trading behavior, update `docs/decisions.md`.

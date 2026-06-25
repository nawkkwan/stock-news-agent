# Decisions

## 2026-06-17

Decision:
Use Supabase as the primary Investment OS database.

Reason:
Supabase fits the Next.js app, Auth, RLS, and future structured research workflows better than the legacy Mongo journal.

## 2026-06-17

Decision:
Rename `decision_journal` to `investment_journal`.

Reason:
The journal should capture the full investment thought process: action, reason, confidence, risk, and how the thesis changes over time.

## 2026-06-17

Decision:
Keep real trading out of scope.

Reason:
The current system is for tracking, research, and decision support only.

## 2026-06-25

Decision:
Add a FastAPI foundation service under `apps/api` and local Docker Compose support for API and worker development.

Reason:
The research engine will need Python-heavy workflows for indicators, data ingestion, news processing, and future backtests. The first implementation only adds health/version readiness endpoints and does not change trading scope.

## 2026-06-25

Decision:
Prepare TiDB as the future research warehouse while keeping Supabase as the primary Investment OS database.

Reason:
Supabase remains best for Auth, RLS, portfolio data, and journal workflows. TiDB is better suited for long-term historical market data, news archives, sentiment history, theme snapshots, and future backtest datasets.

## 2026-06-25

Decision:
Add a `portfolios` layer and link holdings, portfolio transactions, and journal rows to portfolios.

Reason:
The system needs to separate real accounts, experimental portfolios, theme portfolios, and future bot portfolios without mixing positions, cash ledgers, or journal context.

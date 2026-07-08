# Codex Handoff

Last updated: 2026-07-08

This file is for the next Codex session. Read it before changing code.

## Current User Goal

The user clarified an important product correction: the app must be portfolio-first, not Daily-notes-first. The user wants a private portfolio dashboard where:

- The real portfolio lives in Supabase.
- Overview is the main working page.
- Holdings, donut allocation, value, and gain/loss stay connected.
- Assets belong inside one selected portfolio.
- Cash belongs inside that same selected portfolio.
- Add asset/search/transaction forms should affect the selected portfolio.
- Buy/sell/add/trim activity and the reason for each action are visible together.
- Daily news is filtered to the current holdings.
- The Google RSS + Gemini daily worker should eventually follow the Supabase portfolio, not only `data/portfolio.json`.
- Global stock search should be easy, ideally via a market data provider.
- Prices should come from a quote/market data API. Treat this as latest quote/near-real-time first; true exchange real-time may require paid entitlements.

## Product Mental Model

- `Overview`: main portfolio dashboard.
- `Activity`: buy/sell/deposit/withdrawal/dividend records with reasons.
- `Notes`: research notes and investment reflections.
- `Watchlist`: possible future holdings.
- `Daily News`: generated daily news report for holdings.
- Future AI/trading bot section is placeholder only. Do not connect live trading.

Avoid reintroducing confusing wording like “Journey” or “Journal” in visible UI unless the user asks for it. Routes may still use `/investing/journey` and `/investing/journal`.

## Latest Implemented Work

### Overview UI

Main file:

```text
apps/web/app/investing/page.tsx
```

Reusable components:

```text
apps/web/app/investing/components.tsx
```

The Overview page is now a dark portfolio dashboard. It should be portfolio-first:

- Portfolio selector and summary cards.
- Portfolio snapshot cards.
- SVG/CSS donut allocation.
- Holdings asset list.
- Add asset to selected portfolio search flow.
- Cash/activity transaction form for selected portfolio.
- Daily notes import panel as a seed/import tool only.
- If Supabase has no holdings yet, Overview displays a visible `My Ports` seed portfolio from the user screenshot so assets/donut/% do not disappear.
- News by holding from `apps/web/data/latest-report.json`, filtered to selected portfolio tickers.
- Portfolio activity timeline.
- Watchlist preview.
- Create another portfolio form.
- Future AI Agent / Trading Bot placeholder.

Market data files added:

```text
apps/web/lib/market-data.ts
apps/web/app/api/market-data/search/route.ts
apps/web/app/api/market-data/quote/route.ts
apps/web/app/investing/portfolio-asset-search.tsx
```

Market data env:

```text
EODHD_API_KEY=
ALPHA_VANTAGE_API_KEY=
```

EODHD is the primary provider. Alpha Vantage is fallback. If keys are missing, search/quote routes return a configuration message. Keep API keys server-side only.

### Supabase Portfolio Import

Main file:

```text
apps/web/app/investing/actions.ts
```

Added server action:

```ts
importDailyReportPortfolio(formData)
```

Behavior:

- Reads `apps/web/data/latest-report.json`.
- Imports stocks with `holding_value_thb > 0`.
- Uses selected portfolio if provided.
- Otherwise creates or reuses portfolio named `My Ports`.
- Creates/updates `companies`.
- Creates/updates `holdings` with:
  - `current_value`
  - `target_weight`
  - notes saying it was imported from Daily notes.

Important: this requires a logged-in Supabase user in the web app.

### Portfolio Calculation

Main file:

```text
apps/web/lib/portfolio-calculations.ts
```

Changed behavior:

- If buy/sell transactions exist, positions are calculated from transactions.
- If no transaction position exists, holdings with `current_value > 0` are still shown.
- If there is a buy transaction but no latest price/current value, market value falls back to total cost so the donut does not disappear.
- If transactions sell shares down to zero, the ticker is hidden from open holdings.

### Selected Portfolio Data

Main file:

```text
apps/web/lib/investment-data.ts
```

Selected portfolio now filters:

- Holdings.
- Transactions.
- Journal/notes entries where possible.

This helps avoid mixing activity between portfolios.

### Worker Supabase Source

Main files:

```text
apps/worker/news/fetch_news.py
apps/worker/jobs/export_site_data.py
```

The daily worker can now read portfolio tickers from Supabase when backend env vars are set.

Required for Supabase source:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:SUPABASE_USER_ID="..."
$env:SUPABASE_PORTFOLIO_NAME="My Ports"
```

Optional strict mode:

```powershell
$env:SUPABASE_PORTFOLIO_SOURCE="supabase"
```

`SUPABASE_PORTFOLIO_ID` can be used instead of `SUPABASE_PORTFOLIO_NAME`.

Fallback:

- If Supabase worker env is missing and strict mode is not enabled, worker still reads `data/portfolio.json`.

### User Portfolio Snapshot Seed

The user’s screenshot portfolio was added to:

```text
data/portfolio.json
apps/web/data/latest-report.json
apps/web/data/reports/2026-07-08.json
```

Tickers and values:

- VOO: 8,460.73 THB, 45.56%, +826.45 THB, +10.83%
- GOOGL: 4,233.47 THB, 22.80%, +369.68 THB, +9.57%
- VXUS: 2,099.28 THB, 11.30%, +44.43 THB, +2.16%
- XLV: 1,949.59 THB, 10.50%, +86.67 THB, +4.65%
- MSFT: 1,488.03 THB, 8.01%, -50.35 THB, -3.27%
- PLTR: 339.94 THB, 1.83%, +4.08 THB, +1.21%

Total: 18,571.04 THB.

## Current Important Changed Files

At the last check, these files had intentional local changes:

```text
.env.example
README.md
apps/web/app/globals.css
apps/web/app/investing/actions.ts
apps/web/app/investing/components.tsx
apps/web/app/investing/journal/page.tsx
apps/web/app/investing/journey/page.tsx
apps/web/app/investing/page.tsx
apps/web/app/investing/portfolio-asset-search.tsx
apps/web/app/layout.tsx
apps/web/app/api/market-data/search/route.ts
apps/web/app/api/market-data/quote/route.ts
apps/web/data/latest-report.json
apps/web/data/reports/2026-07-08.json
apps/web/lib/investment-data.ts
apps/web/lib/market-data.ts
apps/web/lib/portfolio-calculations.ts
apps/worker/jobs/export_site_data.py
apps/worker/news/fetch_news.py
data/portfolio.json
docs/codex-handoff.md
docs/user-summary-th.md
```

Do not revert these unless the user explicitly asks.

## Verification Already Run

Build:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run web:build
```

Result: passed.

Python compile:

```powershell
.\.venv\Scripts\python.exe -m py_compile apps\worker\news\fetch_news.py apps\worker\jobs\export_site_data.py
```

Result: passed.

Worker fallback check:

```powershell
.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'apps/worker/news'); from fetch_news import load_portfolio; print([s['ticker'] for s in load_portfolio()])"
```

Result:

```text
['VOO', 'GOOGL', 'XLV', 'VXUS', 'PLTR', 'MSFT']
```

Local web check:

```text
http://127.0.0.1:3000/investing
```

Returned status `200` when last checked.

## How To Run Locally

PowerShell may block `npm.ps1`, so prefer:

```powershell
npm.cmd --prefix apps/web run dev
```

or build:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run web:build
```

Open:

```text
http://127.0.0.1:3000/investing
```

## Python/Venv Note

This `.venv` currently has Python executables but no activation scripts such as `Activate.ps1`.

Use Python directly:

```powershell
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe apps\worker\jobs\run_daily_report.py
```

If activation is needed later:

```powershell
py -m venv .venv --upgrade
& .\.venv\Scripts\Activate.ps1
```

## Likely Next Steps

1. Verify the Overview page visually after the user clicks `Import Daily notes portfolio`.
2. Confirm Supabase has the user’s `My Ports` holdings.
3. Add a clearer UX for creating/editing portfolios and holdings if the forms still feel too raw.
4. Decide whether to sync daily worker source fully to Supabase in deployment/GitHub Actions.
5. Add transaction editing/deleting only if the user asks.
6. Improve company logos/icons later; current asset initials are functional but basic.

## Milestones / Phases

### Phase 0 - Repo Recovery And Handoff

Status: mostly complete.

Done:

- Merge conflict was cleaned up.
- Latest daily report data points to `2026-07-08`.
- Build was verified after the dashboard changes.
- Handoff docs were created:
  - `docs/codex-handoff.md`
  - `docs/user-summary-th.md`

Remaining:

- Commit the current work when the user is happy with it.

### Phase 1 - Dark Portfolio Dashboard

Status: implemented, needs visual/user review.

Done:

- Overview was redesigned into a dark dashboard.
- Added portfolio snapshot cards.
- Added donut allocation.
- Added holdings asset list.
- Added News by Holding.
- Added activity timeline.
- Added watchlist preview.
- Added future AI Agent placeholder.

Remaining:

- User should review UI on desktop and mobile.
- Polish spacing, typography, and empty states after user feedback.
- Replace initial-letter asset icons with better logos/icons later.

### Phase 2 - Supabase Portfolio As Source Of Truth

Status: implemented foundation, still needs real Supabase click-test.

Done:

- Web app already reads portfolios, holdings, transactions, notes, watchlist, and news from Supabase.
- Added `Import Daily notes portfolio`.
- Added `My Ports` creation path.
- Added holdings-only calculation so imported holdings show without transactions.
- Added add/update holding form on Overview.
- Reworked Overview so Daily notes is an import preview, not the primary holdings source.
- Added visible `My Ports` seed fallback when Supabase has no holdings yet.
- Added global symbol search + latest quote UI layer for adding assets to the selected portfolio.
- Selected portfolio filtering was tightened.

Remaining:

- User needs to sign in and click `Import Daily notes portfolio`.
- Verify rows appear in Supabase:
  - `portfolios`
  - `companies`
  - `holdings`
- Confirm donut/table now come from Supabase holdings instead of fallback report data.
- Improve UX for adding/editing holdings and transactions.
- Add/verify `EODHD_API_KEY` for market search and latest quote lookup. Alpha Vantage is fallback.

### Phase 3 - Transaction-Driven Portfolio Logic

Status: partially implemented.

Done:

- Buy/sell transactions drive positions when present.
- Selling down to zero removes ticker from open holdings.
- If no latest price exists, market value can fall back to cost/current value.
- Activity timeline shows transaction reasons.

Remaining:

- Add edit/delete transaction flow if user wants it.
- Add clearer realized gain/loss later.
- Decide how to handle currencies cleanly, because user portfolio values are in THB while many assets trade in USD.
- Add price update source if user wants market values to update automatically.

### Phase 4 - Daily News Worker Reads Supabase

Status: code implemented, deployment config still pending.

Done:

- `apps/worker/news/fetch_news.py` can load tickers from Supabase.
- `apps/worker/jobs/export_site_data.py` uses the same portfolio loader.
- Worker falls back to `data/portfolio.json` when Supabase env is missing.

Remaining:

- Set backend env vars locally/GitHub Actions:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_USER_ID`
  - `SUPABASE_PORTFOLIO_NAME` or `SUPABASE_PORTFOLIO_ID`
- Run a real daily worker test against Supabase.
- Confirm added holdings in Supabase appear in the next generated Daily News report.

### Phase 5 - Portfolio UX Polish

Status: not started.

Scope:

- Make add/edit portfolio clearer.
- Make add/edit holding clearer.
- Reduce form noise on Overview.
- Possibly add modals or compact panels.
- Add better responsive checks.
- Add visual portfolio sorting/filtering.

### Phase 6 - AI Agent / Trading Bot Lab

Status: placeholder only.

Current rule:

- No real trading.
- No broker connection.
- No live orders.

Future possible scope:

- Paper trading simulator.
- Risk guardrails.
- Strategy journal.
- Backtest view.
- Human approval gate before any order-like action.

## Safety Notes

- Do not implement real trading or broker order placement.
- Keep the AI agent/trading bot section as placeholder until explicitly scoped.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.
- Be careful with existing uncommitted changes.

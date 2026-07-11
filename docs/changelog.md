# Changelog

## 2026-07-11

- Added a dedicated Pixel Portfolio Agent page with Scout, Analyst, and Watchlist modes.
- Connected the agent dashboard to the existing daily report, portfolio, thesis, and watchlist context.
- Added an original pixel-art research assistant asset and a navigation entry for the new page.
- Kept the initial agent experience read-only and clearly separated from trading actions.

## 2026-06-17

- Rebranded repo metadata toward Portfolio Investment OS.
- Added project rules and documentation structure.
- Moved the active web app to `apps/web`.
- Moved Python report jobs to `apps/worker`.
- Moved Supabase schema source of truth to `supabase/schema.sql`.
- Added migration to rename `decision_journal` to `investment_journal`.
- Archived legacy Mongo journal API under `legacy/`.

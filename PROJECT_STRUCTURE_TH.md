# Project Structure Guide

## Portfolio Investment OS

This repository is now organized as an Investment Operating System.

```text
stock-news-agent/
├── CODEX.md
├── README.md
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

## Important Paths

- `CODEX.md`: rules Codex must read first.
- `docs/`: project overview, architecture, current state, roadmap, decisions, todo, changelog.
- `knowledge/`: portfolio notes, thesis, research, sectors, watchlist, journal, prompts.
- `apps/web/`: active Next.js and Supabase Investment OS web app.
- `apps/worker/`: active Python daily news/report worker.
- `supabase/schema.sql`: database source of truth.
- `supabase/migrations/`: database migrations.
- `legacy/`: archived Mongo journal API and static site assets.

## Current Stage

Current stage: Portfolio Tracking.

Implemented:
- Holdings settings
- Portfolio transactions
- Watchlist
- Thesis notes
- Investment journal
- Daily news dashboard

Future stages:
- News analysis
- Research system
- Paper trading
- Trading bot

Real trading is out of scope until architecture and decision docs are updated.

# Current State

Current Version: v0.2

Implemented:
- Supabase Auth-backed Investment OS pages
- Holdings settings
- Portfolio transactions and journey
- Watchlist
- Thesis notes
- Investment journal
- News items and daily report dashboard
- Python daily portfolio news worker
- Owner-only FastAPI contract for Hermes, research, discovery, watchlist, and briefings
- Local Docker foundation for API and worker
- Single-portfolio-per-account migration with private legacy archive
- Azure API/worker bootstrap and GitLab build/deploy pipeline
- Daily briefing persistence and duplicate-safe Discord delivery
- Read-only Pixel Portfolio Agent dashboard MVP with Scout, Analyst, and Watchlist views

Not Implemented:
- Automated daily prices table ingestion
- Hermes runtime source code (kept in its existing external repository)
- Live Azure resources and production secrets
- TiDB production ingestion
- Paper trading
- Real trading

Active database:
- Supabase

Planned research warehouse:
- TiDB

Legacy:
- MongoDB journal API is archived under `legacy/mongo-journal-api`.

# Current State

Current Version: v0.1

Implemented:
- Supabase Auth-backed Investment OS pages
- Holdings settings
- Portfolio transactions and journey
- Watchlist
- Thesis notes
- Investment journal
- News items and daily report dashboard
- Python daily portfolio news worker
- FastAPI foundation API with health/version readiness endpoints
- Local Docker foundation for API and worker
- Multi-portfolio schema and dashboard foundation
- Read-only Pixel Portfolio Agent dashboard MVP with Scout, Analyst, and Watchlist views

Not Implemented:
- Automated daily prices table ingestion
- Discord notification bot
- Tool-using thesis-aware research agent (the current Pixel Agent page is a read-only dashboard MVP)
- TiDB production ingestion
- Paper trading
- Real trading

Active database:
- Supabase

Planned research warehouse:
- TiDB

Legacy:
- MongoDB journal API is archived under `legacy/mongo-journal-api`.

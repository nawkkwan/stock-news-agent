# Research Warehouse Readiness

TiDB is planned as the long-term research warehouse for the Investment Research Engine.

Current phase:

- Prepare environment configuration.
- Keep Supabase as the primary application database.
- Do not migrate portfolio or journal data into TiDB yet.
- Do not make TiDB a runtime dependency for the web dashboard yet.

Planned TiDB responsibilities:

- Historical OHLCV and price snapshots.
- Technical indicator history.
- News and article archives.
- Sentiment and event tagging outputs.
- Theme score history.
- Future backtest datasets and results.

Required environment variables:

```text
TIDB_HOST=your-tidb-host
TIDB_PORT=4000
TIDB_USER=your-tidb-user
TIDB_PASSWORD=your-tidb-password
TIDB_DATABASE=investment_research
TIDB_SSL_CA=
```

Security notes:

- Store real values only in `.env`, GitHub Secrets, or deployment secrets.
- Never commit TiDB passwords or CA files.
- Use least-privilege users when production ingestion starts.

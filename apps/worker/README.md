# Worker

Python worker for daily portfolio news and report export.

Active entrypoints:

- `jobs/run_daily_report.py`
- `jobs/deploy_daily_report.py`
- `jobs/publish_google_doc.py`

Current groups:

- `news/`: news fetching
- `prices/`: technical and price context
- `ai/`: report and AI summary generation
- `jobs/`: orchestration and exports

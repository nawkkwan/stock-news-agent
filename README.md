# stock-news-agent

A small, safe Python project that creates a portfolio-focused stock news report from RSS sources and can optionally publish the same report text to Google Docs.

The first version:

- Reads holdings from `data/portfolio.json`
- Supports US tickers and Thai tickers ending in `.BK`
- Fetches free Google News RSS results for ticker and company-name searches
- Deduplicates repeated articles by normalized title and URL
- Saves raw news JSON
- Generates a Markdown portfolio news report
- Uses the OpenAI API when `OPENAI_API_KEY` exists
- Falls back to a basic non-AI Markdown report when no API key is configured
- Optionally publishes the Markdown report content to a Google Doc
- Adds macro news context for Fed, inflation, yields, labor data, market sentiment, and the US dollar
- Adds daily technical snapshots with EMA, RSI, MACD, support, and resistance context

This project does not place trades, give financial advice, or tell you to buy or sell anything.

## Project Structure

```text
stock-news-agent/
├─ data/
│  └─ portfolio.json
├─ scripts/
│  ├─ fetch_news.py
│  ├─ deduplicate_news.py
│  ├─ summarize_portfolio.py
│  ├─ publish_google_doc.py
│  └─ run_daily_report.py
├─ prompts/
│  └─ portfolio_news_prompt.md
├─ reports/
│  └─ .gitkeep
├─ .env.example
├─ .gitignore
├─ requirements.txt
└─ README.md
```

## Setup On Windows PowerShell

From the folder that contains `stock-news-agent`, run:

```powershell
cd .\stock-news-agent
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation scripts, run this once for your current user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then activate the virtual environment again:

```powershell
.\.venv\Scripts\Activate.ps1
```

## Add API Keys

OpenAI is optional. Without an API key, the project still creates a basic report.

To use AI summaries:

```powershell
Copy-Item .env.example .env
notepad .env
```

Set:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

## Google Docs Publishing Setup

Google Docs publishing is optional. If credentials are missing, the daily workflow keeps running and prints:

```text
Google Docs publishing skipped because credentials are missing.
```

To enable publishing:

1. Go to Google Cloud Console.
2. Create a Google Cloud project.
3. Enable the Google Docs API.
4. Enable the Google Drive API.
5. Configure the OAuth consent screen.
6. Create OAuth Client ID credentials.
7. Choose Desktop app as the application type.
8. Download the OAuth JSON file.
9. Create a local `credentials` folder in this project.
10. Save the downloaded file as `credentials/credentials.json`.
11. Run the publisher once manually to authorize Google access:

```powershell
python .\scripts\publish_google_doc.py
```

During the first run, Google opens an authorization page. After approval, the project saves `token.json` locally so future runs can publish without repeating the browser login.

Both `credentials/` and `token.json` are ignored by Git.

## Edit Your Portfolio

Edit `data/portfolio.json`.

Example:

```json
[
  {
    "ticker": "AAPL",
    "company": "Apple Inc.",
    "exchange": "NASDAQ"
  },
  {
    "ticker": "CPALL.BK",
    "company": "CP All Public Company Limited",
    "exchange": "SET"
  }
]
```

Use `.BK` for Thai tickers, such as `CPALL.BK` or `ADVANC.BK`.

## Run The Daily Report

Run the complete workflow:

```powershell
python .\scripts\run_daily_report.py
```

The script creates:

```text
reports/YYYY-MM-DD-raw-news.json
reports/YYYY-MM-DD-deduped-news.json
reports/YYYY-MM-DD-portfolio-news-report.md
```

If Google credentials are configured, it also creates a Google Doc named:

```text
Portfolio News Report - YYYY-MM-DD
```

Then it saves the Google Doc URL to:

```text
reports/YYYY-MM-DD-google-doc-url.txt
```

You can also run each step separately:

```powershell
python .\scripts\fetch_news.py
python .\scripts\deduplicate_news.py
python .\scripts\summarize_portfolio.py
python .\scripts\publish_google_doc.py
```

To generate files for a specific date:

```powershell
python .\scripts\run_daily_report.py --date 2026-04-26
```

To publish a specific existing Markdown report:

```powershell
python .\scripts\publish_google_doc.py --date 2026-04-26
```

## Website On Vercel

This project includes a small static website in `site/`.

The website reads:

```text
site/data/latest-report.json
```

It shows:

- Report date
- Stock and article counts
- Portfolio impact table
- Stock-by-stock source links
- Buttons for Google Docs and NotebookLM

To preview it locally, open:

```text
site/index.html
```

To deploy it on Vercel:

1. Push this project to GitHub.
2. Go to Vercel.
3. Import the GitHub repository.
4. Set the project root or output directory to `site`.
5. Use no build command.
6. Deploy.

## Daily GitHub Automation

The workflow file is:

```text
.github/workflows/daily-report.yml
```

It runs every day at:

```text
08:00 Asia/Bangkok
```

The workflow:

1. Installs Python dependencies.
2. Runs `scripts/run_daily_report.py`.
3. Updates `site/data/latest-report.json`.
4. Saves an archive JSON under `site/data/reports/`.
5. Commits the updated site data back to GitHub.
6. Lets Vercel auto-deploy from the new commit.

GitHub secrets you can add:

```text
OPENAI_API_KEY
GEMINI_API_KEY
GOOGLE_CREDENTIALS_JSON
GOOGLE_TOKEN_JSON
```

`OPENAI_API_KEY` is optional. Without it, the workflow still creates a basic non-AI report.

`GEMINI_API_KEY` is optional. If `OPENAI_API_KEY` is not set and `GEMINI_API_KEY` is set, the workflow uses Gemini for structured dashboard analysis.

When `OPENAI_API_KEY` is present, the workflow sends a small capped set of RSS items per stock to OpenAI and creates structured dashboard fields:

- Key takeaway
- Possible impact
- Bullish points
- Bearish points
- Valuation context
- What to monitor next
- Risk level
- Confidence

The analysis is decision support only. It does not recommend buying, selling, holding, or trading.

`GOOGLE_CREDENTIALS_JSON` and `GOOGLE_TOKEN_JSON` are optional. Without them, Google Docs publishing is skipped, but the website still updates.

To add Google secrets:

1. Open the local `credentials/credentials.json` file.
2. Copy the full JSON text into a GitHub repository secret named `GOOGLE_CREDENTIALS_JSON`.
3. Open the local `token.json` file after you have authorized Google once.
4. Copy the full JSON text into a GitHub repository secret named `GOOGLE_TOKEN_JSON`.

## What Each File Does

- `data/portfolio.json`: Your editable list of holdings.
- `scripts/fetch_news.py`: Loads the portfolio and fetches Google News RSS articles for each ticker and company.
- `scripts/deduplicate_news.py`: Removes repeated articles using normalized titles and URLs.
- `scripts/summarize_portfolio.py`: Creates the final Markdown report with OpenAI, or a basic fallback when no API key exists.
- `scripts/publish_google_doc.py`: Publishes a Markdown report to Google Docs as plain text and saves the Doc URL.
- `scripts/analyze_technicals.py`: Fetches daily price data and calculates technical context. This is not trading advice.
- `scripts/export_site_data.py`: Exports report data for the static website.
- `scripts/run_daily_report.py`: Runs fetch, deduplicate, summarize, and optional Google Docs publishing in one command.
- `site/`: Static Vercel website.
- `prompts/portfolio_news_prompt.md`: The AI prompt that enforces the safe, news-only report format.
- `reports/.gitkeep`: Keeps the reports folder in Git.
- `.env.example`: Template for optional environment variables.
- `.gitignore`: Keeps secrets, virtual environments, caches, and generated reports out of Git.
- `requirements.txt`: Python dependencies.

## Future Codex Automations

Later, you can connect this to Codex Automations so the report runs on a schedule.

Suggested future flow:

1. Keep this project folder on your machine.
2. Confirm `python .\scripts\run_daily_report.py` works manually.
3. Ask Codex to create a recurring automation that runs the command every market day.
4. Optionally ask Codex to monitor the newest Markdown report and notify you when it is ready.

TODO: Add a richer Google Drive folder organization step after the basic Google Doc publishing flow is stable.

TODO: Add NotebookLM handoff after deciding whether reports should be exported as Markdown, PDF, Google Doc, or another source format.

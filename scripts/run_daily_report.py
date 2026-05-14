from __future__ import annotations

import argparse
from datetime import datetime

from analyze_technicals import analyze_portfolio
from deduplicate_news import deduplicate_payload, save_deduplicated_news
from export_site_data import export_site_data
from fetch_news import fetch_macro_news, fetch_news_for_portfolio, load_portfolio, save_raw_news
from path_utils import display_path
from summarize_portfolio import generate_report

from pathlib import Path
from time import perf_counter

ROOT_DIR = Path(__file__).resolve().parents[1]


def log_step(message: str) -> None:
    print(message, flush=True)


def run_daily_report(report_date: str) -> None:
    started_at = perf_counter()
    portfolio = load_portfolio()
    log_step(f"Loaded portfolio with {len(portfolio)} holdings.")

    log_step("Fetching portfolio news...")
    raw_news, errors = fetch_news_for_portfolio(portfolio)
    log_step("Fetching macro news...")
    macro_articles, macro_errors = fetch_macro_news()
    raw_path = save_raw_news(raw_news, errors + macro_errors, report_date, macro_articles)
    log_step(f"Saved raw news after {perf_counter() - started_at:.1f}s.")

    log_step("Deduplicating news...")
    deduped_payload = deduplicate_payload(
        {
            "date": report_date,
            "source": "Google News RSS",
            "errors": errors + macro_errors,
            "macro": {
                "articles": macro_articles,
            },
            "stocks": raw_news,
        }
    )
    deduped_path = save_deduplicated_news(deduped_payload, report_date)
    log_step(f"Saved deduplicated news after {perf_counter() - started_at:.1f}s.")

    log_step("Analyzing technicals...")
    technicals_path = analyze_portfolio(report_date)
    log_step(f"Saved technicals after {perf_counter() - started_at:.1f}s.")

    log_step("Generating report...")
    report_path = generate_report(deduped_path, report_date)
    log_step(f"Saved analysis and markdown after {perf_counter() - started_at:.1f}s.")

    log_step(f"Raw news: {display_path(raw_path, ROOT_DIR)}")
    log_step(f"Deduplicated news: {display_path(deduped_path, ROOT_DIR)}")
    log_step(f"Technicals: {display_path(technicals_path, ROOT_DIR)}")
    log_step(f"Markdown report: {display_path(report_path, ROOT_DIR)}")

    log_step("Exporting site data...")
    export_site_data(report_date)
    log_step(f"Daily report workflow finished in {perf_counter() - started_at:.1f}s.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch, deduplicate, and summarize portfolio news.")
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    args = parser.parse_args()
    run_daily_report(args.date)


if __name__ == "__main__":
    main()

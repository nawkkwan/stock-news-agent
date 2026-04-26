from __future__ import annotations

import argparse
from datetime import datetime

from analyze_technicals import analyze_portfolio
from deduplicate_news import deduplicate_payload, save_deduplicated_news
from export_site_data import export_site_data
from fetch_news import fetch_macro_news, fetch_news_for_portfolio, load_portfolio, save_raw_news
from path_utils import display_path
from publish_google_doc import publish_report_to_google_doc
from summarize_portfolio import generate_report

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]


def run_daily_report(report_date: str) -> None:
    portfolio = load_portfolio()
    raw_news, errors = fetch_news_for_portfolio(portfolio)
    macro_articles, macro_errors = fetch_macro_news()
    raw_path = save_raw_news(raw_news, errors + macro_errors, report_date, macro_articles)

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
    technicals_path = analyze_portfolio(report_date)
    report_path = generate_report(deduped_path, report_date)

    print(f"Raw news: {display_path(raw_path, ROOT_DIR)}")
    print(f"Deduplicated news: {display_path(deduped_path, ROOT_DIR)}")
    print(f"Technicals: {display_path(technicals_path, ROOT_DIR)}")
    print(f"Markdown report: {display_path(report_path, ROOT_DIR)}")

    try:
        publish_report_to_google_doc(report_date)
    except Exception as exc:
        print(f"Google Docs publishing failed, but the report workflow will continue: {exc}")

    export_site_data(report_date)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch, deduplicate, and summarize portfolio news.")
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    args = parser.parse_args()
    run_daily_report(args.date)


if __name__ == "__main__":
    main()

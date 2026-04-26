from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from path_utils import display_path

ROOT_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT_DIR / "reports"
SITE_DATA_DIR = ROOT_DIR / "site" / "data"
MAX_ARTICLES_PER_STOCK = 8


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_text_if_exists(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def get_stock_key_news(articles: list[dict[str, Any]]) -> str:
    if not articles:
        return "No important recent news found from the configured RSS searches."
    titles = [str(article.get("title", "Untitled")) for article in articles[:3]]
    return "; ".join(titles)


def get_stock_impact(articles: list[dict[str, Any]]) -> str:
    if not articles:
        return "No recent RSS items found."
    return "News-only signal. Review sources for possible effects on revenue, sentiment, regulation, demand, or sector positioning."


def load_analysis(report_date: str) -> dict[str, Any]:
    analysis_path = REPORTS_DIR / f"{report_date}-analysis.json"
    if not analysis_path.exists():
        return {}
    return load_json(analysis_path)


def load_technicals(report_date: str) -> dict[str, Any]:
    technicals_path = REPORTS_DIR / f"{report_date}-technicals.json"
    if not technicals_path.exists():
        return {}
    return load_json(technicals_path)


def analysis_by_ticker(analysis: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(stock.get("ticker", "")).upper(): stock
        for stock in analysis.get("stocks", [])
        if stock.get("ticker")
    }


def build_site_payload(report_date: str) -> dict[str, Any]:
    deduped_path = REPORTS_DIR / f"{report_date}-deduped-news.json"
    markdown_path = REPORTS_DIR / f"{report_date}-portfolio-news-report.md"
    google_doc_url_path = REPORTS_DIR / f"{report_date}-google-doc-url.txt"

    deduped_payload = load_json(deduped_path)
    analysis = load_analysis(report_date)
    technicals = load_technicals(report_date)
    stock_analysis = analysis_by_ticker(analysis)
    stock_technicals = technicals.get("stocks", {})
    markdown = load_text_if_exists(markdown_path)
    google_doc_url = load_text_if_exists(google_doc_url_path)

    stocks: list[dict[str, Any]] = []
    for ticker, stock_data in deduped_payload.get("stocks", {}).items():
        articles = stock_data.get("articles", [])[:MAX_ARTICLES_PER_STOCK]
        analyzed = stock_analysis.get(str(ticker).upper(), {})
        technical = stock_technicals.get(ticker, {})
        stocks.append(
            {
                "ticker": ticker,
                "company": stock_data.get("company", ""),
                "exchange": stock_data.get("exchange", ""),
                "article_count": stock_data.get("article_count_after_dedupe", len(stock_data.get("articles", []))),
                "key_news": analyzed.get("key_takeaway") or get_stock_key_news(articles),
                "key_takeaway": analyzed.get("key_takeaway") or get_stock_key_news(articles),
                "impact": analyzed.get("possible_impact") or get_stock_impact(articles),
                "possible_impact": analyzed.get("possible_impact") or get_stock_impact(articles),
                "bullish_points": analyzed.get("bullish_points", []),
                "bearish_points": analyzed.get("bearish_points", []),
                "valuation_context": analyzed.get("valuation_context", "No AI valuation context was generated."),
                "technical_summary": analyzed.get("technical_summary", ""),
                "technical": technical,
                "what_to_monitor": analyzed.get("what_to_monitor", "Earnings, guidance, macro data, valuation changes, and source updates."),
                "risk_level": analyzed.get("risk_level", "Unknown"),
                "relevance_score": analyzed.get("relevance_score", "Unknown"),
                "relevance_reason": analyzed.get("relevance_reason", ""),
                "alert_tags": analyzed.get("alert_tags", []),
                "time_horizon": analyzed.get("time_horizon", "Short to medium term"),
                "confidence": analyzed.get("confidence", "Low" if not articles else "Medium"),
                "articles": [
                    {
                        "title": article.get("title", "Untitled"),
                        "url": article.get("url", ""),
                        "source": article.get("source", ""),
                        "published": article.get("published", ""),
                    }
                    for article in articles
                ],
            }
        )

    errors = deduped_payload.get("errors", [])
    return {
        "date": report_date,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "status": "ok" if not errors else "completed_with_errors",
        "google_doc_url": google_doc_url,
        "notebooklm_url": "https://notebooklm.google.com/",
        "markdown_report": markdown,
        "summary": {
            "mode": analysis.get("mode", "basic"),
            "portfolio_summary": analysis.get("portfolio_summary", ""),
            "daily_briefing": analysis.get("daily_briefing", ""),
            "macro_overview": analysis.get("macro_overview", ""),
            "market_context": analysis.get("market_context", []),
            "cross_portfolio_themes": analysis.get("cross_portfolio_themes", []),
            "risk_alerts": analysis.get("risk_alerts", []),
            "read_more": analysis.get("read_more", []),
            "stock_count": len(stocks),
            "total_articles": sum(stock["article_count"] for stock in stocks),
            "errors": errors,
            "technical_errors": technicals.get("errors", []),
        },
        "stocks": stocks,
    }


def save_site_payload(payload: dict[str, Any], report_date: str) -> tuple[Path, Path]:
    SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    latest_path = SITE_DATA_DIR / "latest-report.json"
    archive_dir = SITE_DATA_DIR / "reports"
    archive_dir.mkdir(parents=True, exist_ok=True)
    archive_path = archive_dir / f"{report_date}.json"

    for path in (latest_path, archive_path):
        with path.open("w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
            file.write("\n")

    return latest_path, archive_path


def export_site_data(report_date: str) -> tuple[Path, Path]:
    payload = build_site_payload(report_date)
    latest_path, archive_path = save_site_payload(payload, report_date)
    print(f"Site latest data: {display_path(latest_path, ROOT_DIR)}")
    print(f"Site archive data: {display_path(archive_path, ROOT_DIR)}")
    return latest_path, archive_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export report data for the static Vercel site.")
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    args = parser.parse_args()
    export_site_data(args.date)


if __name__ == "__main__":
    main()

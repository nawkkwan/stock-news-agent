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
PORTFOLIO_PATH = ROOT_DIR / "data" / "portfolio.json"
MAX_ARTICLES_PER_STOCK = 8


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_text_if_exists(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def to_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def load_portfolio_meta() -> dict[str, dict[str, Any]]:
    if not PORTFOLIO_PATH.exists():
        return {}

    portfolio = load_json(PORTFOLIO_PATH)
    if not isinstance(portfolio, list):
        return {}

    metadata: dict[str, dict[str, Any]] = {}
    for item in portfolio:
        ticker = str(item.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        metadata[ticker] = {
            "holding_value_thb": to_float(item.get("holding_value_thb")),
            "target_weight_pct": to_float(item.get("target_weight_pct")),
        }
    return metadata


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


def get_allocation_status(weight_gap_pct: float | None) -> str:
    if weight_gap_pct is None:
        return "No target"
    if abs(weight_gap_pct) < 1:
        return "Near target"
    if weight_gap_pct > 0:
        return "Under target"
    return "Over target"


def build_site_payload(report_date: str) -> dict[str, Any]:
    deduped_path = REPORTS_DIR / f"{report_date}-deduped-news.json"
    markdown_path = REPORTS_DIR / f"{report_date}-portfolio-news-report.md"

    deduped_payload = load_json(deduped_path)
    analysis = load_analysis(report_date)
    technicals = load_technicals(report_date)
    portfolio_meta = load_portfolio_meta()
    stock_analysis = analysis_by_ticker(analysis)
    stock_technicals = technicals.get("stocks", {})
    markdown = load_text_if_exists(markdown_path)
    total_portfolio_value = sum(
        meta["holding_value_thb"]
        for meta in portfolio_meta.values()
        if isinstance(meta.get("holding_value_thb"), float)
    )

    stocks: list[dict[str, Any]] = []
    for ticker, stock_data in deduped_payload.get("stocks", {}).items():
        articles = stock_data.get("articles", [])[:MAX_ARTICLES_PER_STOCK]
        meta = portfolio_meta.get(str(ticker).upper(), {})
        analyzed = stock_analysis.get(str(ticker).upper(), {})
        technical = stock_technicals.get(ticker, {})
        holding_value_thb = meta.get("holding_value_thb")
        target_weight_pct = meta.get("target_weight_pct")
        portfolio_weight_pct = (
            round((holding_value_thb / total_portfolio_value) * 100, 2)
            if total_portfolio_value > 0 and isinstance(holding_value_thb, float)
            else None
        )
        weight_gap_pct = (
            round(target_weight_pct - portfolio_weight_pct, 2)
            if portfolio_weight_pct is not None and isinstance(target_weight_pct, float)
            else None
        )
        stocks.append(
            {
                "ticker": ticker,
                "company": stock_data.get("company", ""),
                "exchange": stock_data.get("exchange", ""),
                "holding_value_thb": holding_value_thb,
                "portfolio_weight_pct": portfolio_weight_pct,
                "target_weight_pct": target_weight_pct,
                "weight_gap_pct": weight_gap_pct,
                "allocation_status": get_allocation_status(weight_gap_pct),
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

    stocks.sort(
        key=lambda stock: (
            stock.get("holding_value_thb") is None,
            -(stock.get("holding_value_thb") or 0),
            stock.get("ticker", ""),
        )
    )

    errors = deduped_payload.get("errors", [])
    return {
        "date": report_date,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "status": "ok" if not errors else "completed_with_errors",
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
            "total_portfolio_value_thb": round(total_portfolio_value, 2) if total_portfolio_value > 0 else None,
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

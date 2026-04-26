from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import feedparser
import requests
from path_utils import display_path

ROOT_DIR = Path(__file__).resolve().parents[1]
PORTFOLIO_PATH = ROOT_DIR / "data" / "portfolio.json"
REPORTS_DIR = ROOT_DIR / "reports"
GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
REQUEST_TIMEOUT_SECONDS = 20
RECENCY_DAYS = 1
MOJIBAKE_MARKERS = ("Ã", "Â", "â€", "â€™", "à¸", "à¹")


def load_portfolio(path: Path = PORTFOLIO_PATH) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8") as file:
        portfolio = json.load(file)

    if not isinstance(portfolio, list):
        raise ValueError("Portfolio must be a list of stock objects.")

    normalized: list[dict[str, str]] = []
    for item in portfolio:
        ticker = str(item.get("ticker", "")).strip().upper()
        company = str(item.get("company", "")).strip()
        exchange = str(item.get("exchange", "")).strip()
        if not ticker or not company:
            raise ValueError("Each portfolio item needs ticker and company fields.")
        normalized.append({"ticker": ticker, "company": company, "exchange": exchange})
    return normalized


def build_queries(stock: dict[str, str]) -> list[str]:
    ticker = stock["ticker"]
    company = stock["company"]
    base_ticker = ticker.removesuffix(".BK")

    queries = [
        f'"{ticker}" stock news when:{RECENCY_DAYS}d',
        f'"{company}" stock news when:{RECENCY_DAYS}d',
    ]

    if ticker.endswith(".BK"):
        queries.extend(
            [
                f'"{base_ticker}" SET Thailand news when:{RECENCY_DAYS}d',
                f'"{company}" Thailand stock news when:{RECENCY_DAYS}d',
            ]
        )

    return queries


def clean_feed_text(value: Any) -> str:
    text = str(value or "").strip()
    if any(marker in text for marker in MOJIBAKE_MARKERS):
        try:
            repaired = text.encode("latin1").decode("utf-8")
        except UnicodeError:
            return text
        return repaired.strip()
    return text


def parse_feed_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def is_recent_article(published: str, fetched_at: datetime) -> bool:
    parsed = parse_feed_datetime(published)
    if parsed is None:
        return True
    return parsed >= fetched_at - timedelta(days=RECENCY_DAYS)


def fetch_google_news_rss(query: str) -> tuple[list[dict[str, Any]], str | None]:
    rss_url = GOOGLE_NEWS_RSS_URL.format(query=quote_plus(query))
    try:
        response = requests.get(
            rss_url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            headers={"User-Agent": "stock-news-agent/0.1"},
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        return [], f"{query}: {exc}"

    parsed_feed = feedparser.parse(response.content)
    articles: list[dict[str, Any]] = []
    fetched_dt = datetime.now(UTC)
    fetched_at = fetched_dt.isoformat()

    for entry in parsed_feed.entries:
        published = entry.get("published") or entry.get("updated") or ""
        if not is_recent_article(str(published), fetched_dt):
            continue
        articles.append(
            {
                "title": clean_feed_text(entry.get("title", "")),
                "url": entry.get("link", "").strip(),
                "published": clean_feed_text(published),
                "source": clean_feed_text(entry.get("source", {}).get("title", "Google News")),
                "summary": clean_feed_text(entry.get("summary", "")),
                "query": query,
                "fetched_at": fetched_at,
                "recency_days": RECENCY_DAYS,
            }
        )

    return articles, None


def fetch_news_for_portfolio(
    portfolio: list[dict[str, str]],
) -> tuple[dict[str, Any], list[str]]:
    output: dict[str, Any] = {}
    errors: list[str] = []

    for stock in portfolio:
        ticker = stock["ticker"]
        stock_articles: list[dict[str, Any]] = []
        for query in build_queries(stock):
            articles, error = fetch_google_news_rss(query)
            stock_articles.extend(articles)
            if error:
                errors.append(error)

        output[ticker] = {
            "ticker": ticker,
            "company": stock["company"],
            "exchange": stock.get("exchange", ""),
            "articles": stock_articles,
        }

    return output, errors


def save_raw_news(raw_news: dict[str, Any], errors: list[str], report_date: str) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / f"{report_date}-raw-news.json"
    payload = {
        "date": report_date,
        "generated_at": datetime.now(UTC).isoformat(),
        "source": "Google News RSS",
        "recency_days": RECENCY_DAYS,
        "errors": errors,
        "stocks": raw_news,
    }
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch portfolio news from RSS sources.")
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    args = parser.parse_args()

    portfolio = load_portfolio()
    raw_news, errors = fetch_news_for_portfolio(portfolio)
    output_path = save_raw_news(raw_news, errors, args.date)
    print(f"Saved raw news to {display_path(output_path, ROOT_DIR)}")
    if errors:
        print(f"Completed with {len(errors)} fetch error(s).")


if __name__ == "__main__":
    main()

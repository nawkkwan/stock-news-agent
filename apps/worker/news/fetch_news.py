from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import feedparser
import requests

WORKER_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(WORKER_DIR / "jobs"))

from path_utils import display_path

PORTFOLIO_PATH = ROOT_DIR / "data" / "portfolio.json"
REPORTS_DIR = ROOT_DIR / "reports"
GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
REQUEST_TIMEOUT_SECONDS = (5, 8)
RECENCY_DAYS = 1
MACRO_QUERIES = [
    f"Federal Reserve interest rates when:{RECENCY_DAYS}d",
    f"US inflation CPI PCE when:{RECENCY_DAYS}d",
    f"US Treasury yields stock market when:{RECENCY_DAYS}d",
    f"US jobs report unemployment market when:{RECENCY_DAYS}d",
    f"S&P 500 Nasdaq market today when:{RECENCY_DAYS}d",
    f"US dollar global markets when:{RECENCY_DAYS}d",
]
MOJIBAKE_MARKERS = ("Ã", "Â", "â€", "â€™", "à¸", "à¹")


def env_value(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return ""


def to_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_portfolio_item(item: dict[str, Any]) -> dict[str, Any]:
    ticker = str(item.get("ticker", "")).strip().upper()
    company = str(item.get("company", "") or item.get("name", "") or ticker).strip()
    exchange = str(item.get("exchange", "")).strip()
    if not ticker or not company:
        raise ValueError("Each portfolio item needs ticker and company fields.")

    normalized: dict[str, Any] = {
        "ticker": ticker,
        "company": company,
        "exchange": exchange,
    }
    for source_key, target_key in (
        ("holding_value_thb", "holding_value_thb"),
        ("current_value", "holding_value_thb"),
        ("target_weight_pct", "target_weight_pct"),
        ("target_weight", "target_weight_pct"),
    ):
        parsed = to_float(item.get(source_key))
        if parsed is not None and normalized.get(target_key) is None:
            normalized[target_key] = parsed
    return normalized


def load_supabase_portfolio() -> list[dict[str, Any]]:
    url = env_value("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    key = env_value("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    user_id = env_value("SUPABASE_USER_ID")
    portfolio_id = env_value("SUPABASE_PORTFOLIO_ID")
    portfolio_name = env_value("SUPABASE_PORTFOLIO_NAME")

    if not url or not key or not user_id:
        return []

    headers = {
        "apikey": key,
        "authorization": f"Bearer {key}",
        "accept": "application/json",
    }
    session = requests.Session()
    session.headers.update(headers)

    selected_portfolio_id = portfolio_id
    if not selected_portfolio_id:
        params: dict[str, str] = {
            "select": "id,name",
            "user_id": f"eq.{user_id}",
            "order": "created_at.asc",
            "limit": "1",
        }
        if portfolio_name:
            params["name"] = f"eq.{portfolio_name}"
        response = session.get(f"{url}/rest/v1/portfolios", params=params, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        portfolios = response.json()
        if portfolios:
            selected_portfolio_id = str(portfolios[0]["id"])

    holdings_params = {
        "select": "ticker,current_value,target_weight,company_id",
        "user_id": f"eq.{user_id}",
    }
    transactions_params = {
        "select": "ticker,portfolio_id",
        "user_id": f"eq.{user_id}",
        "not.ticker": "is.null",
    }
    if selected_portfolio_id:
        holdings_params["portfolio_id"] = f"eq.{selected_portfolio_id}"
        transactions_params["portfolio_id"] = f"eq.{selected_portfolio_id}"

    holdings_response = session.get(f"{url}/rest/v1/holdings", params=holdings_params, timeout=REQUEST_TIMEOUT_SECONDS)
    holdings_response.raise_for_status()
    transaction_response = session.get(
        f"{url}/rest/v1/portfolio_transactions",
        params=transactions_params,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    transaction_response.raise_for_status()
    companies_response = session.get(
        f"{url}/rest/v1/companies",
        params={"select": "id,ticker,name", "user_id": f"eq.{user_id}"},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    companies_response.raise_for_status()

    companies = companies_response.json()
    company_by_id = {str(company.get("id")): company for company in companies if company.get("id")}
    company_by_ticker = {
        str(company.get("ticker", "")).upper(): company
        for company in companies
        if company.get("ticker")
    }
    by_ticker: dict[str, dict[str, Any]] = {}

    for holding in holdings_response.json():
        ticker = str(holding.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        company = company_by_id.get(str(holding.get("company_id"))) or company_by_ticker.get(ticker) or {}
        by_ticker[ticker] = normalize_portfolio_item(
            {
                "ticker": ticker,
                "company": company.get("name") or ticker,
                "current_value": holding.get("current_value"),
                "target_weight": holding.get("target_weight"),
            }
        )

    for transaction in transaction_response.json():
        ticker = str(transaction.get("ticker", "")).strip().upper()
        if ticker and ticker not in by_ticker:
            company = company_by_ticker.get(ticker) or {}
            by_ticker[ticker] = normalize_portfolio_item(
                {
                    "ticker": ticker,
                    "company": company.get("name") or ticker,
                }
            )

    return sorted(by_ticker.values(), key=lambda item: item["ticker"])


def load_json_portfolio(path: Path = PORTFOLIO_PATH) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file:
        portfolio = json.load(file)

    if not isinstance(portfolio, list):
        raise ValueError("Portfolio must be a list of stock objects.")

    normalized: list[dict[str, Any]] = []
    for item in portfolio:
        normalized.append(normalize_portfolio_item(item))
    return normalized


def load_portfolio(path: Path = PORTFOLIO_PATH) -> list[dict[str, Any]]:
    if path == PORTFOLIO_PATH:
        strict_supabase_source = env_value("SUPABASE_PORTFOLIO_SOURCE").lower() == "supabase"
        try:
            supabase_portfolio = load_supabase_portfolio()
        except requests.RequestException:
            if strict_supabase_source:
                raise
            supabase_portfolio = []
        if supabase_portfolio or strict_supabase_source:
            return supabase_portfolio

    return load_json_portfolio(path)


def build_queries(stock: dict[str, Any]) -> list[str]:
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
            headers={"User-Agent": "portfolio-investment-os/0.1"},
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
    portfolio: list[dict[str, Any]],
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


def fetch_macro_news() -> tuple[list[dict[str, Any]], list[str]]:
    macro_articles: list[dict[str, Any]] = []
    errors: list[str] = []
    for query in MACRO_QUERIES:
        articles, error = fetch_google_news_rss(query)
        macro_articles.extend(articles)
        if error:
            errors.append(error)
    return macro_articles, errors


def save_raw_news(
    raw_news: dict[str, Any],
    errors: list[str],
    report_date: str,
    macro_articles: list[dict[str, Any]] | None = None,
) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / f"{report_date}-raw-news.json"
    payload = {
        "date": report_date,
        "generated_at": datetime.now(UTC).isoformat(),
        "source": "Google News RSS",
        "recency_days": RECENCY_DAYS,
        "errors": errors,
        "macro": {
            "queries": MACRO_QUERIES,
            "articles": macro_articles or [],
        },
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
    macro_articles, macro_errors = fetch_macro_news()
    output_path = save_raw_news(raw_news, errors + macro_errors, args.date, macro_articles)
    print(f"Saved raw news to {display_path(output_path, ROOT_DIR)}")
    if errors:
        print(f"Completed with {len(errors)} fetch error(s).")


if __name__ == "__main__":
    main()

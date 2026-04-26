from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from path_utils import display_path

ROOT_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT_DIR / "reports"


def normalize_title(title: str) -> str:
    normalized = title.lower()
    normalized = re.sub(r"\s+-\s+[^-]+$", "", normalized)
    normalized = re.sub(r"[^a-z0-9ก-๙]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def normalize_url(url: str) -> str:
    if not url:
        return ""

    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if "url" in query and query["url"]:
        return normalize_url(unquote(query["url"][0]))

    clean_path = parsed.path.rstrip("/")
    return f"{parsed.netloc.lower()}{clean_path}".strip()


def deduplicate_articles(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_titles: set[str] = set()
    seen_urls: set[str] = set()
    deduped: list[dict[str, Any]] = []

    for article in articles:
        title_key = normalize_title(str(article.get("title", "")))
        url_key = normalize_url(str(article.get("url", "")))
        if (title_key and title_key in seen_titles) or (url_key and url_key in seen_urls):
            continue

        if title_key:
            seen_titles.add(title_key)
        if url_key:
            seen_urls.add(url_key)
        deduped.append(article)

    return deduped


def deduplicate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    result["stocks"] = {}

    for ticker, stock_data in payload.get("stocks", {}).items():
        articles = stock_data.get("articles", [])
        deduped_articles = deduplicate_articles(articles)
        result["stocks"][ticker] = {
            **stock_data,
            "articles": deduped_articles,
            "article_count_before_dedupe": len(articles),
            "article_count_after_dedupe": len(deduped_articles),
        }

    return result


def load_raw_news(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_deduplicated_news(payload: dict[str, Any], report_date: str) -> Path:
    output_path = REPORTS_DIR / f"{report_date}-deduped-news.json"
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Deduplicate fetched portfolio news.")
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    parser.add_argument("--input")
    args = parser.parse_args()

    input_path = Path(args.input) if args.input else REPORTS_DIR / f"{args.date}-raw-news.json"
    payload = load_raw_news(input_path)
    deduped_payload = deduplicate_payload(payload)
    output_path = save_deduplicated_news(deduped_payload, args.date)
    print(f"Saved deduplicated news to {display_path(output_path, ROOT_DIR)}")


if __name__ == "__main__":
    main()

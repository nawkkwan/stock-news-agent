from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from path_utils import display_path

ROOT_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT_DIR / "reports"
PROMPT_PATH = ROOT_DIR / "prompts" / "portfolio_news_prompt.md"
MAX_ARTICLES_PER_STOCK = 8


def load_news(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def article_to_markdown(article: dict[str, Any]) -> str:
    title = article.get("title", "Untitled")
    url = article.get("url", "")
    source = article.get("source", "Unknown source")
    published = article.get("published", "")
    summary = article.get("summary", "")
    return f"- [{title}]({url}) | {source} | {published}\n  {summary}".strip()


def compact_news_for_prompt(payload: dict[str, Any]) -> str:
    sections: list[str] = []
    for ticker, stock_data in payload.get("stocks", {}).items():
        company = stock_data.get("company", "")
        articles = stock_data.get("articles", [])[:MAX_ARTICLES_PER_STOCK]
        article_lines = "\n".join(article_to_markdown(article) for article in articles)
        sections.append(f"## {ticker} - {company}\n{article_lines or 'No articles found.'}")
    return "\n\n".join(sections)


def load_prompt_template() -> str:
    with PROMPT_PATH.open("r", encoding="utf-8") as file:
        return file.read()


def get_report_shell(report_date: str) -> str:
    return f"""# Portfolio News Report - {report_date}

## 1. Executive Summary

## 2. Portfolio Impact Table

| Ticker | Company | Key News | Impact | Time Horizon | Confidence |
|---|---|---|---|---|---|

## 3. Stock-by-Stock News

## 4. Macro & Market Overview

## 5. Risk Alerts

## 6. Stocks With No Important News Today

## 7. Notes / Errors
"""


def create_ai_report(payload: dict[str, Any], report_date: str) -> str:
    prompt_template = load_prompt_template()
    client = OpenAI()
    news_context = compact_news_for_prompt(payload)
    errors = "\n".join(payload.get("errors", [])) or "None"
    prompt = prompt_template.format(
        report_date=report_date,
        news_context=news_context,
        errors=errors,
    )

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You write neutral portfolio news reports. Do not provide financial "
                    "advice, ratings, price targets, or buy/sell/hold instructions."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content or get_report_shell(report_date)


def describe_articles_basic(articles: list[dict[str, Any]]) -> str:
    if not articles:
        return "No important recent news found from the configured RSS searches."
    titles = [str(article.get("title", "Untitled")) for article in articles[:3]]
    return "; ".join(titles)


def format_sources(articles: list[dict[str, Any]]) -> str:
    if not articles:
        return "- No source links available."
    return "\n".join(
        f"- [{article.get('title', 'Untitled')}]({article.get('url', '')})"
        for article in articles
        if article.get("url")
    )


def create_basic_report(payload: dict[str, Any], report_date: str) -> str:
    rows: list[str] = []
    stock_sections: list[str] = []
    no_news: list[str] = []

    for ticker, stock_data in payload.get("stocks", {}).items():
        company = stock_data.get("company", "")
        articles = stock_data.get("articles", [])[:MAX_ARTICLES_PER_STOCK]
        key_news = describe_articles_basic(articles)
        has_news = bool(articles)
        if not has_news:
            no_news.append(f"- {ticker} - {company}")

        rows.append(
            "| {ticker} | {company} | {key_news} | News-only summary; impact needs review. | "
            "Short to medium term | Low |".format(
                ticker=ticker,
                company=company,
                key_news=key_news.replace("|", "/"),
            )
        )

        stock_sections.append(
            f"""### {ticker} - {company}

**News Summary:**
{key_news}

**Possible Impact:**
This non-AI fallback report found related headlines only. Review the linked sources to assess revenue, cost, regulation, demand, sentiment, or competitive implications.

**Why It Matters:**
Portfolio holdings can move when company-specific headlines affect expectations for growth, margins, regulation, liquidity, or investor sentiment.

**What To Monitor Next:**
Follow official company announcements, exchange filings, earnings dates, management commentary, analyst coverage, and sector news.

**Sources:**
{format_sources(articles)}
"""
        )

    errors = payload.get("errors", [])
    error_text = "\n".join(f"- {error}" for error in errors) if errors else "- None."
    no_news_text = "\n".join(no_news) if no_news else "- Every configured stock had at least one matching RSS headline."

    return f"""# Portfolio News Report - {report_date}

## 1. Executive Summary

OpenAI API key was not found, so this report used the basic non-AI fallback. It lists recent RSS headlines and source links without making recommendations.

## 2. Portfolio Impact Table

| Ticker | Company | Key News | Impact | Time Horizon | Confidence |
|---|---|---|---|---|---|
{chr(10).join(rows)}

## 3. Stock-by-Stock News

{chr(10).join(stock_sections)}

## 4. Macro & Market Overview

No AI-generated macro synthesis was produced. Review broad market indexes, interest rates, sector performance, currency moves, oil prices, and Thailand or US market headlines as relevant to the portfolio.

## 5. Risk Alerts

- This is a news summary, not financial advice.
- RSS search results can miss important filings or include duplicated syndicated stories.
- Verify important claims with primary sources before making decisions.

## 6. Stocks With No Important News Today

{no_news_text}

## 7. Notes / Errors

{error_text}
"""


def save_report(markdown: str, report_date: str) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / f"{report_date}-portfolio-news-report.md"
    with output_path.open("w", encoding="utf-8") as file:
        file.write(markdown)
    return output_path


def generate_report(input_path: Path, report_date: str) -> Path:
    load_dotenv(ROOT_DIR / ".env")
    payload = load_news(input_path)

    if os.getenv("OPENAI_API_KEY"):
        markdown = create_ai_report(payload, report_date)
    else:
        markdown = create_basic_report(payload, report_date)

    return save_report(markdown, report_date)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Markdown portfolio news report.")
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    parser.add_argument("--input")
    args = parser.parse_args()

    input_path = Path(args.input) if args.input else REPORTS_DIR / f"{args.date}-deduped-news.json"
    output_path = generate_report(input_path, args.date)
    print(f"Saved report to {display_path(output_path, ROOT_DIR)}")


if __name__ == "__main__":
    main()

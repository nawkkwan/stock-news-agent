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
MAX_AI_ARTICLES_PER_STOCK = 6


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


def compact_news_for_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    stocks: list[dict[str, Any]] = []
    for ticker, stock_data in payload.get("stocks", {}).items():
        articles = stock_data.get("articles", [])[:MAX_AI_ARTICLES_PER_STOCK]
        stocks.append(
            {
                "ticker": ticker,
                "company": stock_data.get("company", ""),
                "exchange": stock_data.get("exchange", ""),
                "articles": [
                    {
                        "title": article.get("title", "Untitled"),
                        "source": article.get("source", ""),
                        "published": article.get("published", ""),
                        "summary": article.get("summary", ""),
                        "url": article.get("url", ""),
                    }
                    for article in articles
                ],
            }
        )
    return {"stocks": stocks, "errors": payload.get("errors", [])}


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


def create_basic_analysis(payload: dict[str, Any], report_date: str) -> dict[str, Any]:
    stocks: list[dict[str, Any]] = []
    for ticker, stock_data in payload.get("stocks", {}).items():
        articles = stock_data.get("articles", [])[:MAX_AI_ARTICLES_PER_STOCK]
        stocks.append(
            {
                "ticker": ticker,
                "company": stock_data.get("company", ""),
                "key_takeaway": describe_articles_basic(articles),
                "possible_impact": "Basic mode: review the linked sources to judge possible effects on sentiment, fundamentals, sector trends, or valuation.",
                "bullish_points": [],
                "bearish_points": [],
                "valuation_context": "No AI valuation context was generated. This is not a buy or sell recommendation.",
                "what_to_monitor": "Earnings, guidance, sector news, macro data, valuation changes, and official company or fund updates.",
                "risk_level": "Unknown",
                "relevance_score": "Low" if not articles else "Medium",
                "relevance_reason": "Basic mode cannot judge detailed relevance.",
                "alert_tags": [],
                "time_horizon": "Short to medium term",
                "confidence": "Low",
            }
        )
    return {
        "date": report_date,
        "mode": "basic",
        "portfolio_summary": "OpenAI API key was not found, so only basic headline-based analysis was generated.",
        "macro_overview": "No AI macro synthesis was generated.",
        "risk_alerts": [
            "This is a news summary, not financial advice.",
            "The report does not recommend buying, selling, or trading.",
        ],
        "stocks": stocks,
    }


def create_ai_analysis(payload: dict[str, Any], report_date: str) -> dict[str, Any]:
    client = OpenAI()
    analysis_input = compact_news_for_analysis(payload)
    prompt = f"""
Create structured decision-support analysis for a portfolio news dashboard.

Date: {report_date}

Rules:
- Do not give financial advice.
- Do not say buy, sell, hold, accumulate, trim, avoid, or similar instructions.
- Do not provide price targets.
- Do not place trades.
- Explain pros, cons, possible impact, valuation context from the available news only, and what to monitor next.
- If the news is too weak or noisy, say so.
- Keep each field concise and useful for a dashboard.
- Return valid JSON only.

Required JSON shape:
{{
  "date": "{report_date}",
  "mode": "ai",
  "portfolio_summary": "2-4 sentences",
  "macro_overview": "1-3 sentences",
  "risk_alerts": ["short bullet", "short bullet"],
  "stocks": [
    {{
      "ticker": "TICKER",
      "company": "Company name",
      "key_takeaway": "Plain-English summary of what matters today",
      "possible_impact": "Potential market relevance without advice",
      "bullish_points": ["possible positive point"],
      "bearish_points": ["possible negative point"],
      "valuation_context": "Discuss valuation/price context from news only, without saying whether to buy",
      "what_to_monitor": "Concrete next things to watch",
      "risk_level": "Low | Medium | High | Unknown",
      "relevance_score": "Low | Medium | High",
      "relevance_reason": "Why today's selected news is or is not relevant",
      "alert_tags": ["Earnings", "Guidance", "Regulation", "AI", "Macro", "Legal", "M&A", "Fund flows"],
      "time_horizon": "Short term | Medium term | Long term | Mixed",
      "confidence": "Low | Medium | High"
    }}
  ]
}}

News input:
{json.dumps(analysis_input, ensure_ascii=False)}
""".strip()

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You produce neutral investment research support. You never provide "
                    "buy/sell/hold advice, price targets, or trading instructions."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    content = response.choices[0].message.content or "{}"
    analysis = json.loads(content)
    analysis.setdefault("date", report_date)
    analysis.setdefault("mode", "ai")
    return analysis


def create_analysis_prompt(payload: dict[str, Any], report_date: str) -> str:
    analysis_input = compact_news_for_analysis(payload)
    return f"""
Create structured decision-support analysis for a portfolio news dashboard.

Date: {report_date}

Rules:
- Do not give financial advice.
- Do not say buy, sell, hold, accumulate, trim, avoid, or similar instructions.
- Do not provide price targets.
- Do not place trades.
- Explain pros, cons, possible impact, valuation context from the available news only, and what to monitor next.
- If the news is too weak or noisy, say so.
- Keep each field concise and useful for a dashboard.
- Return valid JSON only.

Required JSON shape:
{{
  "date": "{report_date}",
  "mode": "gemini",
  "portfolio_summary": "2-4 sentences",
  "macro_overview": "1-3 sentences",
  "risk_alerts": ["short bullet", "short bullet"],
  "stocks": [
    {{
      "ticker": "TICKER",
      "company": "Company name",
      "key_takeaway": "Plain-English summary of what matters today",
      "possible_impact": "Potential market relevance without advice",
      "bullish_points": ["possible positive point"],
      "bearish_points": ["possible negative point"],
      "valuation_context": "Discuss valuation/price context from news only, without saying whether to buy",
      "what_to_monitor": "Concrete next things to watch",
      "risk_level": "Low | Medium | High | Unknown",
      "relevance_score": "Low | Medium | High",
      "relevance_reason": "Why today's selected news is or is not relevant",
      "alert_tags": ["Earnings", "Guidance", "Regulation", "AI", "Macro", "Legal", "M&A", "Fund flows"],
      "time_horizon": "Short term | Medium term | Long term | Mixed",
      "confidence": "Low | Medium | High"
    }}
  ]
}}

News input:
{json.dumps(analysis_input, ensure_ascii=False)}
""".strip()


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
        cleaned = cleaned.removesuffix("```").strip()
    return json.loads(cleaned)


def create_gemini_analysis(payload: dict[str, Any], report_date: str) -> dict[str, Any]:
    from google import genai

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        contents=create_analysis_prompt(payload, report_date),
        config={
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    )
    analysis = parse_json_object(response.text or "{}")
    analysis.setdefault("date", report_date)
    analysis["mode"] = "gemini"
    return analysis


def markdown_list(items: list[str]) -> str:
    if not items:
        return "- No clear signal from today's sources."
    return "\n".join(f"- {item}" for item in items)


def create_report_from_analysis(
    analysis: dict[str, Any],
    payload: dict[str, Any],
    report_date: str,
) -> str:
    stock_lookup = {
        str(stock.get("ticker", "")).upper(): stock
        for stock in analysis.get("stocks", [])
        if stock.get("ticker")
    }
    rows: list[str] = []
    sections: list[str] = []
    no_news: list[str] = []

    for ticker, stock_data in payload.get("stocks", {}).items():
        company = stock_data.get("company", "")
        articles = stock_data.get("articles", [])[:MAX_ARTICLES_PER_STOCK]
        analyzed = stock_lookup.get(str(ticker).upper(), {})
        key_takeaway = analyzed.get("key_takeaway") or describe_articles_basic(articles)
        possible_impact = analyzed.get("possible_impact") or "Review the linked sources for possible market relevance."
        confidence = analyzed.get("confidence", "Low")
        time_horizon = analyzed.get("time_horizon", "Short to medium term")
        relevance_score = analyzed.get("relevance_score", "Unknown")

        if not articles:
            no_news.append(f"- {ticker} - {company}")

        rows.append(
            "| {ticker} | {company} | {key_takeaway} | {possible_impact} | {time_horizon} | {confidence} |".format(
                ticker=ticker,
                company=company,
                key_takeaway=str(key_takeaway).replace("|", "/"),
                possible_impact=str(possible_impact).replace("|", "/"),
                time_horizon=str(time_horizon).replace("|", "/"),
                confidence=str(confidence).replace("|", "/"),
            )
        )

        sections.append(
            f"""### {ticker} - {company}

**News Summary:**
{key_takeaway}

**Possible Impact:**
{possible_impact}

**Good Points:**
{markdown_list(analyzed.get("bullish_points", []))}

**Bad Points:**
{markdown_list(analyzed.get("bearish_points", []))}

**Valuation Context:**
{analyzed.get("valuation_context", "No valuation context was generated.")}

**Relevance:**
{relevance_score} - {analyzed.get("relevance_reason", "No relevance reason was generated.")}

**Alert Tags:**
{markdown_list(analyzed.get("alert_tags", []))}

**Why It Matters:**
Portfolio holdings can move when company-specific or fund-specific headlines affect expectations for growth, valuation, sector sentiment, regulation, liquidity, or macro exposure.

**What To Monitor Next:**
{analyzed.get("what_to_monitor", "Earnings, guidance, macro data, valuation changes, and source updates.")}

**Sources:**
{format_sources(articles)}
"""
        )

    errors = payload.get("errors", [])
    error_text = "\n".join(f"- {error}" for error in errors) if errors else "- None."
    no_news_text = "\n".join(no_news) if no_news else "- Every configured stock had at least one matching RSS headline."
    risk_alerts = markdown_list(analysis.get("risk_alerts", []))

    return f"""# Portfolio News Report - {report_date}

## 1. Executive Summary

{analysis.get("portfolio_summary", "No portfolio summary was generated.")}

## 2. Portfolio Impact Table

| Ticker | Company | Key News | Impact | Time Horizon | Confidence |
|---|---|---|---|---|---|
{chr(10).join(rows)}

## 3. Stock-by-Stock News

{chr(10).join(sections)}

## 4. Macro & Market Overview

{analysis.get("macro_overview", "No macro overview was generated.")}

## 5. Risk Alerts

{risk_alerts}
- This is decision support, not financial advice.
- The report does not recommend buying, selling, holding, or trading.

## 6. Stocks With No Important News Today

{no_news_text}

## 7. Notes / Errors

{error_text}
"""


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


def save_analysis(analysis: dict[str, Any], report_date: str) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / f"{report_date}-analysis.json"
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(analysis, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return output_path


def generate_report(input_path: Path, report_date: str) -> Path:
    load_dotenv(ROOT_DIR / ".env")
    payload = load_news(input_path)

    if os.getenv("OPENAI_API_KEY"):
        markdown = create_ai_report(payload, report_date)
        try:
            analysis = create_ai_analysis(payload, report_date)
        except Exception as exc:
            print(f"AI structured analysis failed; using basic analysis instead: {exc}")
            analysis = create_basic_analysis(payload, report_date)
    elif os.getenv("GEMINI_API_KEY"):
        try:
            analysis = create_gemini_analysis(payload, report_date)
            markdown = create_report_from_analysis(analysis, payload, report_date)
        except Exception as exc:
            print(f"Gemini analysis failed; using basic analysis instead: {exc}")
            markdown = create_basic_report(payload, report_date)
            analysis = create_basic_analysis(payload, report_date)
    else:
        markdown = create_basic_report(payload, report_date)
        analysis = create_basic_analysis(payload, report_date)

    analysis_path = save_analysis(analysis, report_date)
    print(f"Saved analysis to {display_path(analysis_path, ROOT_DIR)}")
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

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests

from fetch_news import load_portfolio
from path_utils import display_path

ROOT_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT_DIR / "reports"
LOOKBACK_PERIOD = "1y"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
REQUEST_TIMEOUT_SECONDS = (5, 10)


def as_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    return round(float(value), 2)


def calculate_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def nearest_levels(close: pd.Series, last_close: float) -> tuple[list[float], list[float]]:
    recent = close.tail(120)
    rolling_lows = recent.rolling(5, center=True).min()
    rolling_highs = recent.rolling(5, center=True).max()
    supports = sorted({round(float(v), 2) for v in rolling_lows.dropna() if float(v) < last_close}, reverse=True)[:3]
    resistances = sorted({round(float(v), 2) for v in rolling_highs.dropna() if float(v) > last_close})[:3]
    return supports, resistances


def classify_trend(last_close: float, ema20: float | None, ema50: float | None, ema200: float | None) -> str:
    if ema20 and ema50 and ema200 and last_close > ema20 > ema50 > ema200:
        return "Uptrend"
    if ema20 and ema50 and ema200 and last_close < ema20 < ema50 < ema200:
        return "Downtrend"
    if ema50 and ema200 and last_close > ema50 and ema50 > ema200:
        return "Constructive"
    if ema50 and ema200 and last_close < ema50 and ema50 < ema200:
        return "Weak"
    return "Sideways/Mixed"


def momentum_note(rsi: float | None, macd: float | None, signal: float | None) -> str:
    parts: list[str] = []
    if rsi is not None:
        if rsi >= 70:
            parts.append("RSI is elevated, so short-term momentum may be stretched.")
        elif rsi <= 30:
            parts.append("RSI is depressed, so the asset may be oversold.")
        else:
            parts.append("RSI is in a neutral range.")
    if macd is not None and signal is not None:
        if macd > signal:
            parts.append("MACD is above signal, suggesting positive momentum.")
        else:
            parts.append("MACD is below signal, suggesting weaker momentum.")
    return " ".join(parts) or "Momentum data is not available."


def analyze_ticker(ticker: str, company: str) -> dict[str, Any]:
    end = int(time.time())
    start = end - 370 * 24 * 60 * 60
    response = requests.get(
        YAHOO_CHART_URL.format(ticker=ticker),
        params={
            "period1": start,
            "period2": end,
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={"User-Agent": "stock-news-agent/0.1"},
    )
    response.raise_for_status()
    chart = response.json()["chart"]
    if chart.get("error"):
        return {"ticker": ticker, "company": company, "error": str(chart["error"])}

    result = chart["result"][0]
    timestamps = result.get("timestamp", [])
    quote = result.get("indicators", {}).get("quote", [{}])[0]
    adjclose = result.get("indicators", {}).get("adjclose", [{}])[0].get("adjclose")
    close_values = adjclose or quote.get("close", [])
    volume_values = quote.get("volume", [])
    data = pd.DataFrame(
        {
            "Close": close_values,
            "Volume": volume_values,
        },
        index=pd.to_datetime(timestamps, unit="s"),
    ).dropna(subset=["Close"])

    if data.empty:
        return {"ticker": ticker, "company": company, "error": "No price data returned."}
    close = data["Close"]
    volume = data["Volume"]

    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    ema200 = close.ewm(span=200, adjust=False).mean()
    rsi = calculate_rsi(close)
    macd = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    signal = macd.ewm(span=9, adjust=False).mean()

    last_close = float(close.iloc[-1])
    last_ema20 = as_float(ema20.iloc[-1])
    last_ema50 = as_float(ema50.iloc[-1])
    last_ema200 = as_float(ema200.iloc[-1])
    last_rsi = as_float(rsi.iloc[-1])
    last_macd = as_float(macd.iloc[-1])
    last_signal = as_float(signal.iloc[-1])
    supports, resistances = nearest_levels(close, last_close)

    return {
        "ticker": ticker,
        "company": company,
        "last_close": as_float(last_close),
        "last_date": str(close.index[-1].date()),
        "ema20": last_ema20,
        "ema50": last_ema50,
        "ema200": last_ema200,
        "rsi14": last_rsi,
        "macd": last_macd,
        "macd_signal": last_signal,
        "trend": classify_trend(last_close, last_ema20, last_ema50, last_ema200),
        "support_zones": supports,
        "resistance_zones": resistances,
        "volume_latest": int(volume.iloc[-1]) if not pd.isna(volume.iloc[-1]) else None,
        "technical_note": momentum_note(last_rsi, last_macd, last_signal),
        "disclaimer": "Technical levels are context only, not buy or sell advice.",
    }


def analyze_portfolio(report_date: str) -> Path:
    portfolio = load_portfolio()
    results: dict[str, Any] = {}
    errors: list[str] = []

    for stock in portfolio:
        ticker = stock["ticker"]
        try:
            results[ticker] = analyze_ticker(ticker, stock["company"])
            if results[ticker].get("error"):
                errors.append(f"{ticker}: {results[ticker]['error']}")
        except Exception as exc:
            errors.append(f"{ticker}: {exc}")
            results[ticker] = {"ticker": ticker, "company": stock["company"], "error": str(exc)}

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / f"{report_date}-technicals.json"
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(
            {
                "date": report_date,
                "generated_at": datetime.now().isoformat(timespec="seconds"),
                "lookback_period": LOOKBACK_PERIOD,
                "errors": errors,
                "stocks": results,
            },
            file,
            ensure_ascii=False,
            indent=2,
        )
        file.write("\n")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze portfolio technical indicators.")
    parser.add_argument("--date", default=datetime.now().date().isoformat())
    args = parser.parse_args()
    output_path = analyze_portfolio(args.date)
    print(f"Saved technicals to {display_path(output_path, ROOT_DIR)}")


if __name__ == "__main__":
    main()

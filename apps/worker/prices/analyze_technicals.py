from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests

WORKER_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT_DIR))
for worker_subdir in ("news", "jobs"):
    sys.path.insert(0, str(WORKER_DIR / worker_subdir))

from fetch_news import load_portfolio
from path_utils import display_path
from packages.shared.technical_levels import calculate_review_zones

REPORTS_DIR = ROOT_DIR / "reports"
LOOKBACK_PERIOD = "1y"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
EODHD_URL = "https://eodhd.com/api/eod/{ticker}"
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


def nearest_resistances(high: pd.Series, last_close: float) -> list[float]:
    recent = high.tail(120)
    prior = recent.iloc[:-1] if len(recent) > 1 else recent

    def add_distinct(levels: list[float], value: float, reference: float) -> None:
        if reference <= 0 or any(abs(value - existing) / reference < 0.015 for existing in levels):
            return
        levels.append(round(value, 2))

    resistance_candidates: list[float] = []
    for horizon in (20, 60, 120):
        window = prior.tail(horizon)
        if window.empty:
            continue
        high = float(window.max())
        if high > last_close * 1.005:
            add_distinct(resistance_candidates, high, last_close)

    values = [float(value) for value in prior.dropna()]
    pivot_highs = [
        values[index]
        for index in range(2, len(values) - 2)
        if values[index] == max(values[index - 2:index + 3]) and values[index] > last_close * 1.005
    ]
    for value in sorted(pivot_highs):
        if len(resistance_candidates) >= 3:
            break
        add_distinct(resistance_candidates, value, last_close)

    return sorted(resistance_candidates)[:3]


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


def fetch_price_frame_eodhd(ticker: str, start: int, end: int) -> pd.DataFrame:
    api_key = os.getenv("EODHD_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("EODHD_API_KEY is not configured")
    symbol = ticker if "." in ticker else f"{ticker}.US"
    response = requests.get(
        EODHD_URL.format(ticker=symbol),
        params={
            "api_token": api_key,
            "fmt": "json",
            "from": datetime.fromtimestamp(start).date().isoformat(),
            "to": datetime.fromtimestamp(end).date().isoformat(),
            "period": "d",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    rows = response.json()
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("EODHD returned no price history")
    frame_rows = []
    for row in rows:
        raw_close = row.get("close")
        adjusted_close = row.get("adjusted_close") or raw_close
        if not raw_close or not adjusted_close:
            continue
        factor = float(adjusted_close) / float(raw_close)
        frame_rows.append({
            "date": row.get("date"),
            "Open": float(row.get("open") or raw_close) * factor,
            "High": float(row.get("high") or raw_close) * factor,
            "Low": float(row.get("low") or raw_close) * factor,
            "Close": float(adjusted_close),
            "Volume": row.get("volume") or 0,
        })
    if not frame_rows:
        raise RuntimeError("EODHD returned no usable price history")
    return pd.DataFrame(
        [{key: value for key, value in row.items() if key != "date"} for row in frame_rows],
        index=pd.to_datetime([row["date"] for row in frame_rows]),
    ).dropna(subset=["Close"])


def fetch_price_frame_yahoo(ticker: str, start: int, end: int) -> pd.DataFrame:
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
        headers={"User-Agent": "portfolio-investment-os/0.1"},
    )
    response.raise_for_status()
    chart = response.json()["chart"]
    if chart.get("error"):
        raise RuntimeError(str(chart["error"]))

    result = chart["result"][0]
    timestamps = result.get("timestamp", [])
    quote = result.get("indicators", {}).get("quote", [{}])[0]
    adjclose = result.get("indicators", {}).get("adjclose", [{}])[0].get("adjclose")
    raw_close_values = quote.get("close", [])
    close_values = adjclose or raw_close_values
    factors = [
        (float(adjusted) / float(raw)) if adjusted is not None and raw else 1.0
        for adjusted, raw in zip(close_values, raw_close_values)
    ]
    def adjusted_column(name: str) -> list[float | None]:
        return [
            (float(value) * factor) if value is not None else None
            for value, factor in zip(quote.get(name, []), factors)
        ]
    return pd.DataFrame(
        {
            "Open": adjusted_column("open"),
            "High": adjusted_column("high"),
            "Low": adjusted_column("low"),
            "Close": close_values,
            "Volume": quote.get("volume", []),
        },
        index=pd.to_datetime(timestamps, unit="s"),
    ).dropna(subset=["Close"])


def analyze_ticker(ticker: str, company: str) -> dict[str, Any]:
    end = int(time.time())
    start = end - 370 * 24 * 60 * 60
    provider = "eodhd"
    try:
        data = fetch_price_frame_eodhd(ticker, start, end)
    except Exception:
        provider = "yahoo-fallback"
        data = fetch_price_frame_yahoo(ticker, start, end)

    if data.empty:
        return {"ticker": ticker, "company": company, "error": "No price data returned."}
    close = data["Close"]
    volume = data["Volume"]
    open_prices = data["Open"] if "Open" in data else close
    high_prices = data["High"] if "High" in data else close
    low_prices = data["Low"] if "Low" in data else close

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
    price_frame = pd.DataFrame({
        "Open": open_prices,
        "High": high_prices,
        "Low": low_prices,
        "Close": close,
        "Volume": volume,
    })
    price_history = [
        {
            "date": str(index.date()),
            "open": as_float(row["Open"]),
            "high": as_float(row["High"]),
            "low": as_float(row["Low"]),
            "close": as_float(row["Close"]),
            "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
        }
        for index, row in price_frame.tail(180).iterrows()
    ]
    review_zones = calculate_review_zones(price_history)
    supports = [zone["center"] for zone in review_zones]
    resistances = nearest_resistances(high_prices, last_close)

    return {
        "ticker": ticker,
        "company": company,
        "provider": provider,
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
        "review_zones": review_zones,
        "resistance_zones": resistances,
        "volume_latest": int(volume.iloc[-1]) if not pd.isna(volume.iloc[-1]) else None,
        "price_history": price_history,
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

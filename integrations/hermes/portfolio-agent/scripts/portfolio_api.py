from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


TICKER_PATTERN = re.compile(r"^[A-Za-z0-9.-]{1,20}$")


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def normalize_ticker(value: str) -> str:
    ticker = value.strip().upper()
    if not TICKER_PATTERN.fullmatch(ticker):
        raise ValueError("Ticker must contain only letters, numbers, dots, or hyphens.")
    return ticker


def api_request(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    base_url = required_env("PORTFOLIO_API_BASE_URL").rstrip("/")
    token = required_env("PORTFOLIO_INTERNAL_API_TOKEN")
    discord_user_id = required_env("PORTFOLIO_DISCORD_USER_ID")
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Discord-User-ID": discord_user_id,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Kwan-Hermes-Portfolio-Skill/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            response_body = json.loads(exc.read().decode("utf-8"))
            detail = response_body.get("detail", "Portfolio API request failed")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            detail = "Portfolio API request failed"
        raise RuntimeError(f"{detail} (HTTP {exc.code})") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("Portfolio API is unreachable") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Hermes client for the Azure Portfolio API")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("context")
    subparsers.add_parser("brief")
    subparsers.add_parser("alerts")

    research = subparsers.add_parser("research")
    research.add_argument("ticker")
    research.add_argument("--question", default="")

    discover = subparsers.add_parser("discover")
    discover.add_argument("criteria")
    discover.add_argument("--limit", type=int, default=5, choices=range(1, 11))

    watch_add = subparsers.add_parser("watch-add")
    watch_add.add_argument("ticker")
    watch_add.add_argument("--reason", default="")

    watch_remove = subparsers.add_parser("watch-remove")
    watch_remove.add_argument("ticker")

    research_save = subparsers.add_parser("research-save")
    research_save.add_argument("ticker")
    research_save.add_argument("--note", required=True)
    research_save.add_argument("--source-url", default=None)
    research_save.add_argument("--source-label", default="Discord")

    thesis_add = subparsers.add_parser("thesis-add")
    thesis_add.add_argument("ticker")
    thesis_add.add_argument(
        "--section",
        required=True,
        choices=("business_overview", "growth_drivers", "bull_case", "bear_case", "moat", "key_risks", "sell_conditions"),
    )
    thesis_add.add_argument("--note", required=True)
    return parser


def execute(args: argparse.Namespace) -> Any:
    if args.command == "context":
        return api_request("GET", "/v1/portfolio/context")
    if args.command == "brief":
        return api_request("GET", "/v1/briefings/latest")
    if args.command == "alerts":
        return api_request("GET", "/v1/alerts/status")
    if args.command == "research":
        return api_request(
            "POST",
            "/v1/research",
            {"ticker": normalize_ticker(args.ticker), "question": args.question},
        )
    if args.command == "discover":
        return api_request(
            "POST",
            "/v1/discover",
            {"criteria": args.criteria, "limit": args.limit},
        )
    if args.command == "watch-add":
        return api_request(
            "POST",
            "/v1/watchlist",
            {
                "ticker": normalize_ticker(args.ticker),
                "reason": args.reason,
                "status": "not_started",
            },
        )
    if args.command == "watch-remove":
        ticker = urllib.parse.quote(normalize_ticker(args.ticker), safe="")
        return api_request("DELETE", f"/v1/watchlist/{ticker}")
    if args.command == "research-save":
        return api_request(
            "POST",
            "/v1/research-notes",
            {
                "ticker": normalize_ticker(args.ticker),
                "note": args.note,
                "source_url": args.source_url,
                "source_label": args.source_label,
            },
        )
    if args.command == "thesis-add":
        return api_request(
            "POST",
            "/v1/thesis/append",
            {
                "ticker": normalize_ticker(args.ticker),
                "section": args.section,
                "note": args.note,
            },
        )
    raise RuntimeError("Unsupported command")


def main() -> int:
    try:
        result = execute(build_parser().parse_args())
        print(json.dumps({"ok": True, "data": result}, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())

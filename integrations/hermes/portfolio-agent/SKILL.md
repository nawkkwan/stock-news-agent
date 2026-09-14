---
name: portfolio-agent
description: "Use the owner's Azure Portfolio API to inspect the live Supabase portfolio, research stocks, capture Discord research notes, append thesis sections, manage the watchlist, read briefings, and inspect alert status."
version: 1.1.0
author: Kwan Investment OS
license: MIT
platforms: [windows]
required_environment_variables:
  - name: PORTFOLIO_API_BASE_URL
    prompt: "Azure Portfolio API base URL"
    required_for: "Portfolio data and agent endpoints"
  - name: PORTFOLIO_INTERNAL_API_TOKEN
    prompt: "Internal Portfolio API bearer token"
    required_for: "Hermes owner authentication"
  - name: PORTFOLIO_DISCORD_USER_ID
    prompt: "Authorized Discord owner user ID"
    required_for: "Owner-scoped Portfolio API access"
metadata:
  hermes:
    tags: [Portfolio, Investing, Research, Supabase, Azure, Discord]
    requires_toolsets: [terminal]
---

# Portfolio Agent

Connect Hermes to the same owner-scoped portfolio data used by the investment
website. This system provides decision support only. It must never place trades
or modify holdings or transactions.

## When to use

Load this skill when the user asks about:

- their live portfolio, holdings, watchlist, thesis, concentration, or risks;
- research on a ticker;
- saving a Discord message or conversation insight as research evidence;
- adding an explicit note to one section of the owner's thesis;
- stock discovery by theme, sector, or criteria;
- adding or removing a ticker from the watchlist;
- the latest briefing or alert status.

## Command

On Windows, call the installed helper through the terminal:

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" COMMAND [OPTIONS]
```

The helper prints JSON. Read that JSON, then answer the user in concise Thai.
Never reveal environment variables, authorization headers, or internal tokens.

## Operations

### Live portfolio context

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" context
```

Use this before answering questions that depend on the user's actual portfolio.
Do not rely on memory for current quantities or watchlist state.

### Research a ticker

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" research GOOGL.US --question "ประเด็นเสี่ยงสำคัญคืออะไร"
```

Separate facts, inferences, missing evidence, risks, and cited source URLs.

### Discover candidates

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" discover "US healthcare quality stocks" --limit 5
```

Discovery produces research candidates only. Never add candidates to the
watchlist unless the user explicitly asks.

### Capture a Discord message as research

When the owner says that a message should be saved, extract the exact ticker and
save the message text without rewriting its meaning:

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" research-save GOOGL.US --note "ข้อความที่เจ้าของต้องการเก็บ" --source-label "Discord #ทั่วไป"
```

If a Discord message URL is available, also pass `--source-url "MESSAGE_URL"`.
The saved note appears in the stock's evidence section on the website and is
available in future portfolio context. Never save ordinary conversation unless
the owner explicitly says to save, remember, record, or add it.

### Append to the owner's thesis

Classify only an explicit thesis update into one of these exact fields:

- `business_overview`: what the company does or how it earns money;
- `growth_drivers`: why growth may occur or why the owner is interested;
- `bull_case`: favorable scenario or upside assumptions;
- `bear_case`: unfavorable scenario or counter-thesis;
- `moat`: durable competitive advantage;
- `key_risks`: material risks;
- `sell_conditions`: evidence that would invalidate the thesis.

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" thesis-add GOOGL.US --section growth_drivers --note "Cloud backlog is accelerating"
```

This operation appends and never overwrites existing thesis text. If the ticker
or destination section is ambiguous, ask the owner before writing. Confirm the
ticker, selected Thai section label, and saved text after success.

### Watchlist

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" watch-add PLTR.US --reason "ติดตามการเติบโตและ valuation"
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" watch-remove PLTR.US
```

Confirm the exact ticker before mutation. Only the watchlist, captured research
notes, and append-only thesis sections are writable. Holdings and transactions
remain read-only.

### Briefing and alerts

```powershell
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" brief
python "$env:LOCALAPPDATA\hermes\skills\finance\portfolio-agent\scripts\portfolio_api.py" alerts
```

## Sub-agent orchestration

For a request involving multiple independent tickers or research questions,
the lead Hermes session may use `delegate_task` to create one child task per
ticker. Each child must use this skill's `research` command. The lead session
then compares the results, removes duplication, calls out conflicting evidence,
and produces the final answer.

Use these role boundaries:

- Research: evidence and thesis implications for a specified ticker.
- Discovery: candidate shortlist only.
- Portfolio Secretary: current context, briefing, risks, and follow-ups.
- Lead: choose roles, delegate independent work, and combine results safely.

## Safety rules

- Never place or simulate a broker order.
- Never modify holdings or transactions.
- Never capture a Discord conversation without an explicit owner request.
- Thesis writes must append to one confirmed section and must not replace existing text.
- Never expose secrets in messages, logs, or delegated prompts.
- Reject requests from users not authorized by the API.
- Treat API errors as errors; do not invent portfolio values.
- State clearly that output is decision support, not financial advice.

## Verification

Run `context`. Success is valid JSON containing the portfolio and its current
holdings/watchlist. An HTTP 401 or 403 means the token or owner ID is wrong. An
HTTP 5xx means the Azure API or an upstream provider needs attention.

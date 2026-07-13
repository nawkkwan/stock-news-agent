"use client";

import { useMemo, useState, useTransition } from "react";
import { upsertWatchlistItem } from "./actions";

type MarketSymbol = {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
};

const statuses = ["not_started", "researching", "thesis_drafted", "ready_to_buy", "rejected"];

export function WatchlistAssetSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketSymbol[]>([]);
  const [selected, setSelected] = useState<MarketSymbol | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedLabel = useMemo(() => {
    if (!selected) return "No asset selected";
    return `${selected.symbol} — ${selected.name || selected.region || "Market symbol"}`;
  }, [selected]);

  function search() {
    const keywords = query.trim();
    if (keywords.length < 2) {
      setMessage("Type at least 2 characters to search.");
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/market-data/search?keywords=${encodeURIComponent(keywords)}`);
      const payload = await response.json();
      setResults(payload.results || []);
      if (payload.error) setMessage(payload.error);
      else if ((payload.results || []).length === 0) setMessage("No symbols matched that search.");
    });
  }

  return (
    <div className="asset-manager">
      <div className="search-row">
        <label>
          <span>Search global asset</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
            placeholder="Search ticker or company, e.g. Microsoft, VOO, Tesco"
            value={query}
          />
        </label>
        <button className="button secondary" disabled={isPending} onClick={search} type="button">
          Search
        </button>
      </div>

      {message ? <p className="muted">{message}</p> : null}

      {results.length > 0 ? (
        <div className="market-results">
          {results.map((result) => (
            <button
              className={selected?.symbol === result.symbol ? "market-result active" : "market-result"}
              key={`${result.symbol}-${result.region}`}
              onClick={() => {
                setSelected(result);
                setMessage(null);
              }}
              type="button"
            >
              <strong>{result.symbol}</strong>
              <span>{result.name}</span>
              <em>{result.region || "Global"}{result.currency ? ` / ${result.currency}` : ""}</em>
            </button>
          ))}
        </div>
      ) : null}

      <form action={upsertWatchlistItem} className="form-grid compact-form">
        <input name="ticker" type="hidden" value={selected?.symbol || ""} />
        <input name="company_name" type="hidden" value={selected?.name || ""} />
        <div className="selected-asset span-2">
          <span>Selected asset</span>
          <strong>{selectedLabel}</strong>
          <small>Search and select an asset before adding it to your Watchlist.</small>
        </div>
        <label>
          <span>Status</span>
          <select defaultValue="not_started" name="status">
            {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label>
          <span>Reason</span>
          <input name="reason" placeholder="Why this asset is worth watching" />
        </label>
        <button className="button" disabled={!selected} type="submit">Add to Watchlist</button>
      </form>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { upsertHolding } from "./actions";

type MarketSymbol = {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: number;
};

type MarketQuote = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  latestTradingDay: string | null;
  source: string;
};

function formatValue(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

export function PortfolioAssetSearch({ portfolioId }: { portfolioId?: string | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketSymbol[]>([]);
  const [selected, setSelected] = useState<MarketSymbol | null>(null);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const latestPrice = quote?.price ?? "";
  const currency = selected?.currency || "";
  const selectedLabel = useMemo(() => {
    if (!selected) {
      return "No asset selected";
    }
    return `${selected.symbol} - ${selected.name || selected.region || "Market symbol"}`;
  }, [selected]);

  function search() {
    const keywords = query.trim();
    if (keywords.length < 2) {
      setMessage("Type at least 2 characters to search.");
      return;
    }

    startTransition(async () => {
      setMessage(null);
      setQuote(null);
      const response = await fetch(`/api/market-data/search?keywords=${encodeURIComponent(keywords)}`);
      const payload = await response.json();
      setResults(payload.results || []);
      if (payload.error) {
        setMessage(payload.error);
      } else if ((payload.results || []).length === 0) {
        setMessage("No symbols matched that search.");
      }
    });
  }

  function selectSymbol(symbol: MarketSymbol) {
    setSelected(symbol);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/market-data/quote?symbol=${encodeURIComponent(symbol.symbol)}`);
      const payload = await response.json();
      setQuote(payload.quote || null);
      if (payload.error) {
        setMessage(payload.error);
      }
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
              onClick={() => selectSymbol(result)}
              type="button"
            >
              <strong>{result.symbol}</strong>
              <span>{result.name}</span>
              <em>
                {result.region || "Global"} {result.currency ? `/${result.currency}` : ""}
              </em>
            </button>
          ))}
        </div>
      ) : null}

      <form action={upsertHolding} className="form-grid compact-form">
        <input name="portfolio_id" type="hidden" value={portfolioId || ""} />
        <input name="ticker" type="hidden" value={selected?.symbol || ""} />
        <input name="company_name" type="hidden" value={selected?.name || ""} />
        <div className="selected-asset span-2">
          <span>Selected asset</span>
          <strong>{selectedLabel}</strong>
          {quote ? (
            <small>
              Latest quote {formatValue(quote.price)} {currency}
              {quote.latestTradingDay ? ` on ${quote.latestTradingDay}` : ""} / {quote.source}
            </small>
          ) : (
            <small>Search and select an asset before saving it into this portfolio.</small>
          )}
        </div>
        <label>
          <span>Shares</span>
          <input name="shares" step="any" type="number" />
        </label>
        <label>
          <span>Starting average cost</span>
          <input name="avg_cost" step="any" type="number" />
        </label>
        <label>
          <span>Latest price</span>
          <input defaultValue={latestPrice} key={`${selected?.symbol || "none"}-${latestPrice}`} name="latest_price" step="any" type="number" />
        </label>
        <label>
          <span>Latest market value (optional)</span>
          <input name="current_value" step="any" type="number" />
        </label>
        <label>
          <span>Target weight %</span>
          <input name="target_weight" step="any" type="number" />
        </label>
        <label>
          <span>Notes</span>
          <input name="notes" placeholder="Why this asset belongs in the portfolio" />
        </label>
        <button className="button" disabled={!selected} type="submit">
          Add asset to this portfolio
        </button>
      </form>
    </div>
  );
}

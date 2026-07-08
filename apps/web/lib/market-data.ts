export type MarketSymbol = {
  symbol: string;
  name: string;
  type: string;
  region: string;
  marketOpen: string;
  marketClose: string;
  timezone: string;
  currency: string;
  matchScore: number;
};

export type MarketQuote = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  latestTradingDay: string | null;
  source: string;
};

const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
const EODHD_URL = "https://eodhd.com/api";

function alphaVantageApiKey() {
  return process.env.ALPHA_VANTAGE_API_KEY || "";
}

function eodhdApiKey() {
  return process.env.EODHD_API_KEY || process.env.MARKET_DATA_API_KEY || "";
}

function toNumber(value: unknown) {
  const parsed = Number(String(value || "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchAlphaVantage(params: Record<string, string>) {
  const apiKey = alphaVantageApiKey();
  if (!apiKey) {
    return {
      configured: false,
      data: null,
      error: "Set ALPHA_VANTAGE_API_KEY on the server to enable global symbol search and latest quotes.",
    };
  }

  const url = new URL(ALPHA_VANTAGE_URL);
  for (const [key, value] of Object.entries({ ...params, apikey: apiKey })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "portfolio-investment-os/0.1",
    },
  });

  if (!response.ok) {
    return {
      configured: true,
      data: null,
      error: `Market data request failed with status ${response.status}.`,
    };
  }

  const data = await response.json();
  if (data?.Note || data?.Information) {
    return {
      configured: true,
      data: null,
      error: String(data.Note || data.Information),
    };
  }

  return { configured: true, data, error: null };
}

async function fetchEodhd(pathname: string, params: Record<string, string> = {}) {
  const apiKey = eodhdApiKey();
  if (!apiKey) {
    return {
      configured: false,
      data: null,
      error: "Set EODHD_API_KEY on the server to enable global symbol search and latest quotes.",
    };
  }

  const url = new URL(`${EODHD_URL}${pathname}`);
  for (const [key, value] of Object.entries({ ...params, api_token: apiKey, fmt: "json" })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "portfolio-investment-os/0.1",
    },
  });

  if (!response.ok) {
    return {
      configured: true,
      data: null,
      error: `EODHD request failed with status ${response.status}.`,
    };
  }

  const data = await response.json();
  if (data?.error || data?.message) {
    return {
      configured: true,
      data: null,
      error: String(data.error || data.message),
    };
  }

  return { configured: true, data, error: null };
}

async function searchEodhdSymbols(keywords: string) {
  const response = await fetchEodhd(`/search/${encodeURIComponent(keywords)}`);
  if (!response.data) {
    return { configured: response.configured, results: [] as MarketSymbol[], error: response.error };
  }

  const matches = Array.isArray(response.data) ? response.data : [];
  return {
    configured: true,
    results: matches.slice(0, 10).map((match: Record<string, unknown>) => {
      const code = String(match.Code || match.code || "").toUpperCase();
      const exchange = String(match.Exchange || match.exchange || "").toUpperCase();
      const symbol = code.includes(".") || !exchange ? code : `${code}.${exchange}`;
      return {
        symbol,
        name: String(match.Name || match.name || ""),
        type: String(match.Type || match.type || ""),
        region: String(match.Country || match.country || exchange || ""),
        marketOpen: "",
        marketClose: "",
        timezone: "",
        currency: String(match.Currency || match.currency || ""),
        matchScore: 1,
      };
    }),
    error: null,
  };
}

async function getEodhdQuote(symbol: string) {
  const response = await fetchEodhd(`/real-time/${encodeURIComponent(symbol)}`);
  if (!response.data) {
    return { configured: response.configured, quote: null, error: response.error };
  }

  const quote = response.data as Record<string, unknown>;
  const price = toNumber(quote.close) ?? toNumber(quote.price) ?? toNumber(quote.last);
  const previousClose = toNumber(quote.previousClose) ?? toNumber(quote.previous_close);
  const change = toNumber(quote.change);
  const changePercent = toNumber(quote.change_p) ?? toNumber(quote.changePercent);
  return {
    configured: true,
    quote: {
      symbol: String(quote.code || quote.symbol || symbol).toUpperCase(),
      price,
      previousClose,
      change,
      changePercent,
      latestTradingDay: quote.date ? String(quote.date) : null,
      source: "EODHD real-time",
    } satisfies MarketQuote,
    error: null,
  };
}

async function searchAlphaVantageSymbols(keywords: string) {
  const response = await fetchAlphaVantage({
    function: "SYMBOL_SEARCH",
    keywords,
  });

  if (!response.data) {
    return { configured: response.configured, results: [] as MarketSymbol[], error: response.error };
  }

  const matches = Array.isArray(response.data.bestMatches) ? response.data.bestMatches : [];
  return {
    configured: true,
    results: matches.slice(0, 8).map((match: Record<string, unknown>) => ({
      symbol: String(match["1. symbol"] || "").toUpperCase(),
      name: String(match["2. name"] || ""),
      type: String(match["3. type"] || ""),
      region: String(match["4. region"] || ""),
      marketOpen: String(match["5. marketOpen"] || ""),
      marketClose: String(match["6. marketClose"] || ""),
      timezone: String(match["7. timezone"] || ""),
      currency: String(match["8. currency"] || ""),
      matchScore: toNumber(match["9. matchScore"]) || 0,
    })),
    error: null,
  };
}

export async function searchMarketSymbols(keywords: string) {
  const trimmed = keywords.trim();
  if (trimmed.length < 2) {
    return { configured: true, results: [] as MarketSymbol[], error: null };
  }

  const eodhd = await searchEodhdSymbols(trimmed);
  if (eodhd.results.length > 0 || eodhd.configured) {
    return eodhd;
  }

  return searchAlphaVantageSymbols(trimmed);
}

export async function getMarketQuote(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return { configured: true, quote: null, error: "Symbol is required." };
  }

  const eodhd = await getEodhdQuote(normalized);
  if (eodhd.quote || eodhd.configured) {
    return eodhd;
  }

  const response = await fetchAlphaVantage({
    function: "GLOBAL_QUOTE",
    symbol: normalized,
  });

  if (!response.data) {
    return { configured: response.configured, quote: null, error: response.error };
  }

  const quote = response.data["Global Quote"] || {};
  return {
    configured: true,
    quote: {
      symbol: String(quote["01. symbol"] || normalized).toUpperCase(),
      price: toNumber(quote["05. price"]),
      previousClose: toNumber(quote["08. previous close"]),
      change: toNumber(quote["09. change"]),
      changePercent: toNumber(quote["10. change percent"]),
      latestTradingDay: quote["07. latest trading day"] ? String(quote["07. latest trading day"]) : null,
      source: "Alpha Vantage GLOBAL_QUOTE",
    } satisfies MarketQuote,
    error: null,
  };
}

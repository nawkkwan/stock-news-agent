import { createSupabaseServerClient } from "./supabase-server";
import type { StockResearchSnapshot } from "./investment-types";

export type MarketBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ReviewZone = {
  lower: number;
  upper: number;
  center: number;
  touches: number;
  volume_ratio: number;
  last_touch_date: string;
  distance_pct: number;
  score: number;
  score_breakdown?: { touches: number; volume: number; recency: number; time_span: number };
  confidence: "low" | "medium" | "high";
  method: string;
};

export type MarketOverview = {
  ticker: string;
  available: boolean;
  reason?: string;
  provider?: string;
  currency?: string;
  as_of?: string;
  price?: number;
  previous_close?: number;
  change?: number;
  change_pct?: number;
  day_low?: number;
  day_high?: number;
  support_zones?: number[];
  review_zones?: ReviewZone[];
  resistance_zones?: number[];
  history: MarketBar[];
};

export type StockApiOverview = {
  ticker: string;
  market: MarketOverview;
  snapshots: StockResearchSnapshot[];
};

export async function getStockApiOverview(ticker: string): Promise<StockApiOverview | null> {
  const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!apiBaseUrl) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return null;
    const response = await fetch(`${apiBaseUrl}/v1/user/stocks/${encodeURIComponent(ticker)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as StockApiOverview;
    if (!payload?.market || typeof payload.market !== "object") return null;
    const history = Array.isArray(payload.market.history)
      ? payload.market.history.filter((bar): bar is MarketBar => Boolean(bar && typeof bar.date === "string" && typeof bar.close === "number" && Number.isFinite(bar.close)))
      : [];
    return { ...payload, market: { ...payload.market, history }, snapshots: Array.isArray(payload.snapshots) ? payload.snapshots : [] };
  } catch {
    return null;
  }
}

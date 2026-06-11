export type WatchlistStatus =
  | "not_started"
  | "reading"
  | "thesis_drafted"
  | "ready_to_buy"
  | "rejected";

export type JournalAction = "buy" | "sell" | "hold" | "trim" | "add" | "research";
export type NewsImpact = "positive" | "neutral" | "negative";
export type NewsTimeframe = "short_term" | "long_term";
export type TransactionType = "deposit" | "withdrawal" | "buy" | "sell" | "dividend" | "fee";

export type Company = {
  id: string;
  ticker: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type Holding = {
  id: string;
  company_id: string | null;
  ticker: string;
  shares: number | null;
  avg_cost: number | null;
  current_value: number | null;
  latest_price: number | null;
  target_weight: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type PortfolioHolding = Holding & {
  shares: number;
  avg_cost: number;
  total_cost: number;
  market_value: number;
  unrealized_gain: number;
  unrealized_gain_pct: number | null;
  portfolio_weight: number;
};

export type PortfolioTransaction = {
  id: string;
  company_id: string | null;
  ticker: string | null;
  transaction_type: TransactionType;
  quantity: number | null;
  price_per_share: number | null;
  fee: number;
  currency: string;
  transaction_date: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
};

export type WatchlistItem = {
  id: string;
  company_id: string | null;
  ticker: string;
  status: WatchlistStatus;
  reason: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type ThesisNote = {
  id: string;
  company_id: string | null;
  ticker: string;
  business_overview: string | null;
  bull_case: string | null;
  bear_case: string | null;
  moat: string | null;
  key_risks: string | null;
  growth_drivers: string | null;
  sell_conditions: string | null;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type DecisionJournalEntry = {
  id: string;
  company_id: string | null;
  ticker: string | null;
  action: JournalAction;
  amount: number | null;
  reason: string | null;
  confidence_score: number | null;
  what_would_make_this_wrong: string | null;
  created_at: string;
  user_id: string | null;
};

export type NewsItem = {
  id: string;
  company_id: string | null;
  ticker: string;
  title: string;
  url: string | null;
  source: string | null;
  published_at: string | null;
  summary: string | null;
  impact: NewsImpact;
  timeframe: NewsTimeframe;
  thesis_changed: boolean;
  my_note: string | null;
  created_at: string;
  user_id: string | null;
};

export type InvestmentData = {
  configured: boolean;
  error?: string;
  companies: Company[];
  holdings: Holding[];
  portfolioHoldings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  portfolioValue: number;
  cashBalance: number;
  hasCashLedger: boolean;
  watchlist: WatchlistItem[];
  thesisNotes: ThesisNote[];
  decisions: DecisionJournalEntry[];
  news: NewsItem[];
};

export const watchlistStatuses: WatchlistStatus[] = [
  "not_started",
  "reading",
  "thesis_drafted",
  "ready_to_buy",
  "rejected",
];

export const journalActions: JournalAction[] = ["buy", "sell", "hold", "trim", "add", "research"];
export const newsImpacts: NewsImpact[] = ["positive", "neutral", "negative"];
export const newsTimeframes: NewsTimeframe[] = ["short_term", "long_term"];
export const transactionTypes: TransactionType[] = ["deposit", "withdrawal", "buy", "sell", "dividend", "fee"];

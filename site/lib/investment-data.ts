import { buildPortfolioHoldings } from "./portfolio-calculations";
import { createSupabaseServerClient, hasSupabaseConfig } from "./supabase-server";
import type {
  Company,
  DecisionJournalEntry,
  Holding,
  InvestmentData,
  NewsItem,
  PortfolioTransaction,
  ThesisNote,
  WatchlistItem,
} from "./investment-types";

export function normalizeTicker(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function nullableText(value: FormDataEntryValue | string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function nullableNumber(value: FormDataEntryValue | string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

async function emptyInvestmentData(configured: boolean, error?: string): Promise<InvestmentData> {
  return {
    configured,
    error,
    companies: [],
    holdings: [],
    portfolioHoldings: [],
    transactions: [],
    portfolioValue: 0,
    cashBalance: 0,
    hasCashLedger: false,
    watchlist: [],
    thesisNotes: [],
    decisions: [],
    news: [],
  };
}

export async function getInvestmentData(): Promise<InvestmentData> {
  if (!hasSupabaseConfig()) {
    return emptyInvestmentData(false);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return emptyInvestmentData(true, "Sign in to load your investment data.");
    }

    const [companiesResult, holdingsResult, transactionsResult, watchlistResult, thesisResult, decisionsResult, newsResult] =
      await Promise.all([
        supabase.from("companies").select("*").order("ticker", { ascending: true }),
        supabase.from("holdings").select("*").order("created_at", { ascending: false }),
        supabase.from("portfolio_transactions").select("*").order("transaction_date", { ascending: false }),
        supabase.from("watchlist").select("*").order("created_at", { ascending: false }),
        supabase.from("thesis_notes").select("*").order("created_at", { ascending: false }),
        supabase.from("decision_journal").select("*").order("created_at", { ascending: false }),
        supabase.from("news_items").select("*").order("published_at", { ascending: false }),
      ]);

    const firstError = [
      companiesResult.error,
      holdingsResult.error,
      transactionsResult.error,
      watchlistResult.error,
      thesisResult.error,
      decisionsResult.error,
      newsResult.error,
    ].find(Boolean);

    if (firstError) {
      throw firstError;
    }

    const holdings = (holdingsResult.data || []) as Holding[];
    const transactions = (transactionsResult.data || []) as PortfolioTransaction[];
    const portfolio = buildPortfolioHoldings(holdings, transactions);

    return {
      configured: true,
      companies: (companiesResult.data || []) as Company[],
      holdings,
      transactions,
      ...portfolio,
      watchlist: (watchlistResult.data || []) as WatchlistItem[],
      thesisNotes: (thesisResult.data || []) as ThesisNote[],
      decisions: (decisionsResult.data || []) as DecisionJournalEntry[],
      news: (newsResult.data || []) as NewsItem[],
    };
  } catch (error) {
    return emptyInvestmentData(true, error instanceof Error ? error.message : "Unable to load investment data.");
  }
}

export async function getCompanyData(ticker: string) {
  const data = await getInvestmentData();
  const normalized = ticker.toUpperCase();
  return {
    ...data,
    company: data.companies.find((company) => company.ticker === normalized) || null,
    holding: data.holdings.find((holding) => holding.ticker === normalized) || null,
    portfolioHolding: data.portfolioHoldings.find((holding) => holding.ticker === normalized) || null,
    companyTransactions: data.transactions.filter((transaction) => transaction.ticker === normalized),
    thesis: data.thesisNotes.find((note) => note.ticker === normalized) || null,
    watchlistItem: data.watchlist.find((item) => item.ticker === normalized) || null,
    companyNews: data.news.filter((item) => item.ticker === normalized),
    companyDecisions: data.decisions.filter((entry) => entry.ticker === normalized),
  };
}

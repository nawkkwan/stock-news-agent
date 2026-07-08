import { buildPortfolioHoldings } from "./portfolio-calculations";
import { createSupabaseServerClient, hasSupabaseConfig } from "./supabase-server";
import type {
  Company,
  Holding,
  InvestmentJournalEntry,
  InvestmentData,
  NewsItem,
  Portfolio,
  PortfolioSummary,
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

type InvestmentDataOptions = {
  selectedPortfolioId?: string | null;
};

async function emptyInvestmentData(configured: boolean, error?: string): Promise<InvestmentData> {
  return {
    configured,
    error,
    portfolios: [],
    selectedPortfolio: null,
    portfolioSummaries: [],
    companies: [],
    holdings: [],
    portfolioHoldings: [],
    transactions: [],
    portfolioValue: 0,
    cashBalance: 0,
    hasCashLedger: false,
    watchlist: [],
    thesisNotes: [],
    journalEntries: [],
    news: [],
  };
}

function pickSelectedPortfolio(portfolios: Portfolio[], selectedPortfolioId?: string | null) {
  if (selectedPortfolioId) {
    return portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) || portfolios[0] || null;
  }
  return portfolios[0] || null;
}

function buildPortfolioSummaries(
  portfolios: Portfolio[],
  holdings: Holding[],
  transactions: PortfolioTransaction[]
): PortfolioSummary[] {
  return portfolios.map((portfolio) => {
    const portfolioHoldings = holdings.filter((holding) => holding.portfolio_id === portfolio.id);
    const portfolioTransactions = transactions.filter((transaction) => transaction.portfolio_id === portfolio.id);
    const calculated = buildPortfolioHoldings(portfolioHoldings, portfolioTransactions);
    return {
      portfolio,
      portfolioValue: calculated.portfolioValue,
      cashBalance: calculated.cashBalance,
      hasCashLedger: calculated.hasCashLedger,
      holdingsCount: calculated.portfolioHoldings.length,
      unrealizedGain: calculated.portfolioHoldings.reduce((sum, holding) => sum + holding.unrealized_gain, 0),
      target_weight: portfolio.target_weight,
    };
  });
}

export async function getInvestmentData(options: InvestmentDataOptions = {}): Promise<InvestmentData> {
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

    const [portfoliosResult, companiesResult, holdingsResult, transactionsResult, watchlistResult, thesisResult, journalResult, newsResult] =
      await Promise.all([
        supabase.from("portfolios").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("companies").select("*").eq("user_id", user.id).order("ticker", { ascending: true }),
        supabase.from("holdings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("portfolio_transactions").select("*").eq("user_id", user.id).order("transaction_date", { ascending: false }),
        supabase.from("watchlist").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("thesis_notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("investment_journal").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("news_items").select("*").eq("user_id", user.id).order("published_at", { ascending: false }),
      ]);

    const firstError = [
      portfoliosResult.error,
      companiesResult.error,
      holdingsResult.error,
      transactionsResult.error,
      watchlistResult.error,
      thesisResult.error,
      journalResult.error,
      newsResult.error,
    ].find(Boolean);

    if (firstError) {
      throw firstError;
    }

    const portfolios = (portfoliosResult.data || []) as Portfolio[];
    const selectedPortfolio = pickSelectedPortfolio(portfolios, options.selectedPortfolioId);
    const holdings = (holdingsResult.data || []) as Holding[];
    const transactions = (transactionsResult.data || []) as PortfolioTransaction[];
    const journalEntries = (journalResult.data || []) as InvestmentJournalEntry[];
    const selectedHoldings = selectedPortfolio
      ? holdings.filter((holding) => holding.portfolio_id === selectedPortfolio.id)
      : holdings;
    const selectedTransactions = selectedPortfolio
      ? transactions.filter((transaction) => transaction.portfolio_id === selectedPortfolio.id)
      : transactions;
    const selectedJournalEntries = selectedPortfolio
      ? journalEntries.filter((entry) => !entry.portfolio_id || entry.portfolio_id === selectedPortfolio.id)
      : journalEntries;
    const portfolio = buildPortfolioHoldings(selectedHoldings, selectedTransactions);

    return {
      configured: true,
      portfolios,
      selectedPortfolio,
      portfolioSummaries: buildPortfolioSummaries(portfolios, holdings, transactions),
      companies: (companiesResult.data || []) as Company[],
      holdings,
      transactions: selectedTransactions,
      ...portfolio,
      watchlist: (watchlistResult.data || []) as WatchlistItem[],
      thesisNotes: (thesisResult.data || []) as ThesisNote[],
      journalEntries: selectedJournalEntries,
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
    companyJournalEntries: data.journalEntries.filter((entry) => entry.ticker === normalized),
  };
}

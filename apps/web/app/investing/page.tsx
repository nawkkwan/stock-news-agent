import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { getInvestmentData } from "../../lib/investment-data";
import {
  CompanyForm,
  ConfigNotice,
  DashboardHoldingsTable,
  ImportDailyPortfolioButton,
  NewsByHolding,
  PortfolioActivityTimeline,
  PortfolioAllocation,
  PortfolioForm,
  PortfolioSelector,
  PortfolioSummaryCards,
  PortfolioSnapshot,
  TradingBotPlaceholder,
  TransactionForm,
  WatchlistTable,
  type DashboardHolding,
  type DailyReportStock,
} from "./components";
import { PortfolioAssetSearch } from "./portfolio-asset-search";

export const dynamic = "force-dynamic";

type LatestReport = {
  date?: string;
  summary?: {
    total_portfolio_value_thb?: number | null;
  };
  stocks?: DailyReportStock[];
};

async function getLatestReport(): Promise<LatestReport | null> {
  try {
    const file = await fs.readFile(path.join(process.cwd(), "data", "latest-report.json"), "utf8");
    return JSON.parse(file) as LatestReport;
  } catch {
    return null;
  }
}

function formatReportDate(value?: string | null) {
  if (!value) {
    return "Seed";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function InvestingPage({
  searchParams,
}: {
  searchParams?: Promise<{ portfolio?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const [data, latestReport] = await Promise.all([
    getInvestmentData({ selectedPortfolioId: params.portfolio }),
    getLatestReport(),
  ]);
  const selectedPortfolioId = data.selectedPortfolio?.id || null;
  const reportHoldings: DashboardHolding[] = (latestReport?.stocks || [])
    .filter((stock) => stock.ticker && Number(stock.holding_value_thb) > 0)
    .map((stock) => ({
      id: `report-${stock.ticker}`,
      ticker: String(stock.ticker).toUpperCase(),
      company: stock.company || null,
      market_value: Number(stock.holding_value_thb),
      portfolio_weight: Number(stock.portfolio_weight_pct) || 0,
      unrealized_gain: stock.unrealized_gain_thb ?? null,
      unrealized_gain_pct: stock.unrealized_gain_pct ?? null,
    }));
  const isUsingSeedPortfolio = data.portfolioHoldings.length === 0 && reportHoldings.length > 0;
  const displayHoldings: DashboardHolding[] = isUsingSeedPortfolio ? reportHoldings : data.portfolioHoldings;
  const displayPortfolioValue = isUsingSeedPortfolio
    ? Number(latestReport?.summary?.total_portfolio_value_thb) || reportHoldings.reduce((sum, holding) => sum + holding.market_value, 0)
    : data.portfolioValue;
  const currentTickers = new Set(displayHoldings.map((holding) => holding.ticker.toUpperCase()));
  const reportStocks = (latestReport?.stocks || []).filter((stock) =>
    stock.ticker ? currentTickers.has(stock.ticker.toUpperCase()) : false
  );
  const unrealizedGain = displayHoldings.reduce((sum, holding) => sum + (holding.unrealized_gain || 0), 0);
  const displayPortfolioName = data.selectedPortfolio?.name || (isUsingSeedPortfolio ? "My Ports" : "No portfolio selected");

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Portfolio</h2>
            <p className="muted">Select one portfolio first. Every asset, cash movement, and activity below belongs to that portfolio.</p>
          </div>
          <ImportDailyPortfolioButton
            disabled={reportHoldings.length === 0}
            portfolioId={selectedPortfolioId}
          />
        </div>
        {data.portfolios.length > 0 ? (
          <PortfolioSelector portfolios={data.portfolios} selectedPortfolio={data.selectedPortfolio} />
        ) : null}
        {isUsingSeedPortfolio ? (
          <article className="portfolio-card seed-card">
            <div className="item-card-head">
              <div>
                <strong>My Ports</strong>
                <span>Seeded from the portfolio screenshot you sent. Import it to save these assets into Supabase.</span>
              </div>
              <span>{formatReportDate(latestReport?.date)}</span>
            </div>
            <dl className="mini-grid">
              <div>
                <dt>Value</dt>
                <dd>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(displayPortfolioValue)}</dd>
              </div>
              <div>
                <dt>Assets</dt>
                <dd>{displayHoldings.length}</dd>
              </div>
              <div>
                <dt>Unrealized P/L</dt>
                <dd className={unrealizedGain >= 0 ? "positive-text" : "negative-text"}>
                  {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(unrealizedGain)}
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>Portfolio seed</dd>
              </div>
            </dl>
          </article>
        ) : null}
        {data.portfolioSummaries.length > 0 ? <PortfolioSummaryCards summaries={data.portfolioSummaries} /> : null}
      </section>

      <PortfolioSnapshot
        cashBalance={data.cashBalance}
        hasCashLedger={data.hasCashLedger}
        holdingsCount={displayHoldings.length}
        portfolioName={displayPortfolioName}
        portfolioValue={displayPortfolioValue}
        unrealizedGain={unrealizedGain}
      />

      <section className="dashboard-grid">
        <PortfolioAllocation
          cashBalance={data.cashBalance}
          hasCashLedger={data.hasCashLedger}
          holdings={displayHoldings}
        />
        <div className="panel dashboard-panel">
          <div className="section-head">
            <div>
              <h2>Assets in this portfolio</h2>
              <p className="muted">
                {isUsingSeedPortfolio
                  ? "Showing My Ports seed assets from your screenshot. Import once to persist them in Supabase."
                  : `Only holdings inside ${data.selectedPortfolio?.name || "the selected portfolio"} appear here.`}
              </p>
            </div>
          </div>
          <DashboardHoldingsTable holdings={displayHoldings} />
        </div>
      </section>

      <section className="two-column align-start">
        <div className="panel dashboard-panel">
          <div className="section-head">
            <div>
              <h2>Add asset to this portfolio</h2>
              <p className="muted">Search global symbols, fetch a latest quote, then save the asset into the selected portfolio.</p>
            </div>
          </div>
          <PortfolioAssetSearch portfolioId={selectedPortfolioId} />
        </div>
        <div className="panel dashboard-panel">
          <div className="section-head">
            <div>
              <h2>Cash and activity</h2>
              <p className="muted">Deposit cash, buy/sell assets, withdraw cash, or record dividends for this portfolio.</p>
            </div>
          </div>
          <TransactionForm portfolioId={selectedPortfolioId} />
        </div>
      </section>

      <section className="panel dashboard-panel">
        <div className="section-head">
          <div>
            <h2>Daily notes import</h2>
            <p className="muted">Use this once to save the visible My Ports seed into Supabase. After import, Supabase is the source of truth.</p>
          </div>
          <ImportDailyPortfolioButton
            disabled={reportHoldings.length === 0}
            portfolioId={selectedPortfolioId}
          />
        </div>
        <DashboardHoldingsTable holdings={reportHoldings.slice(0, 6)} />
      </section>

      <section className="panel dashboard-panel">
        <div className="section-head">
          <div>
            <h2>News by Holding</h2>
            <p className="muted">Latest daily report filtered to tickers currently in this portfolio.</p>
          </div>
          <Link className="button secondary" href="/daily">
            Daily News
          </Link>
        </div>
        <NewsByHolding reportDate={latestReport?.date} stocks={reportStocks} />
      </section>

      <section className="two-column align-start">
        <div className="panel dashboard-panel">
          <div className="section-head">
            <div>
              <h2>Portfolio Activity</h2>
              <p className="muted">Transactions and notes for the selected portfolio.</p>
            </div>
            <Link className="button secondary" href="/investing/journey">
              Full activity
            </Link>
          </div>
          <PortfolioActivityTimeline
            journalEntries={data.journalEntries}
            transactions={data.transactions}
          />
        </div>
        <div className="panel dashboard-panel">
          <div className="section-head">
            <div>
              <h2>Watchlist</h2>
              <p className="muted">Research queue for future portfolio candidates.</p>
            </div>
            <Link className="button secondary" href="/investing/watchlist">
              Manage
            </Link>
          </div>
          <WatchlistTable items={data.watchlist.slice(0, 6)} />
        </div>
      </section>

      <section className="two-column align-start">
        <div className="panel dashboard-panel">
          <div className="section-head">
            <h2>{data.selectedPortfolio ? "Edit selected portfolio" : "Create portfolio"}</h2>
          </div>
          <PortfolioForm portfolio={data.selectedPortfolio} />
        </div>
        <div className="panel dashboard-panel">
          <h2>Create another portfolio</h2>
          <PortfolioForm />
        </div>
      </section>

      <section className="panel dashboard-panel">
        <details>
          <summary>Add company profile</summary>
          <CompanyForm />
        </details>
      </section>

      <TradingBotPlaceholder />
    </main>
  );
}

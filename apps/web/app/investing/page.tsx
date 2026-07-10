import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { getInvestmentData } from "../../lib/investment-data";
import {
  ConfigNotice,
  DashboardHoldingsTable,
  NewsByHolding,
  PortfolioAllocation,
  PortfolioSelector,
  PortfolioSummaryCards,
  PortfolioSnapshot,
  type DashboardHolding,
  type DailyReportStock,
} from "./components";

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
            <p className="muted">Select a portfolio to review its value, allocation, holdings, news, and technical context.</p>
          </div>
          <Link className="button secondary" href="/investing/settings">Manage portfolio</Link>
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

    </main>
  );
}

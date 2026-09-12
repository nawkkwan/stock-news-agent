import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { getInvestmentData } from "../../lib/investment-data";
import {
  ConfigNotice,
  DashboardHoldingsTable,
  NewsByHolding,
  PortfolioAllocation,
  PortfolioPerformance,
  PortfolioSummary,
  PortfolioTransactionHistory,
  type DashboardHolding,
  type DailyReportStock,
} from "./components";
import { AddTransactionDrawer } from "./add-transaction-drawer";
import { PortfolioAssetSearch } from "./portfolio-asset-search";

export const dynamic = "force-dynamic";

type LatestReport = {
  date?: string;
  summary?: { total_portfolio_value_thb?: number | null };
  stocks?: DailyReportStock[];
};

async function getLatestReport(): Promise<LatestReport | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "latest-report.json"), "utf8")) as LatestReport;
  } catch {
    return null;
  }
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
  const isUsingSeedPortfolio = data.portfolios.length === 0 && data.portfolioHoldings.length === 0 && reportHoldings.length > 0;
  const displayHoldings = isUsingSeedPortfolio ? reportHoldings : data.portfolioHoldings;
  const displayPortfolioValue = isUsingSeedPortfolio
    ? Number(latestReport?.summary?.total_portfolio_value_thb) || reportHoldings.reduce((sum, holding) => sum + holding.market_value, 0)
    : data.portfolioValue;
  const currentTickers = new Set(displayHoldings.map((holding) => holding.ticker.toUpperCase()));
  const reportStocks = (latestReport?.stocks || []).filter((stock) => stock.ticker && currentTickers.has(stock.ticker.toUpperCase()));
  const unrealizedGain = displayHoldings.reduce((sum, holding) => sum + (holding.unrealized_gain || 0), 0);
  const portfolioId = data.selectedPortfolio?.id || null;
  const portfolioCurrency = isUsingSeedPortfolio ? "THB" : data.selectedPortfolio?.base_currency || "USD";
  const lastUpdated = data.selectedPortfolio?.updated_at || latestReport?.date || null;
  const formattedLastUpdated = lastUpdated
    ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(lastUpdated))
    : "Not available";

  return (
    <main className="page-shell portfolio-page">
      <ConfigNotice configured={data.configured} error={data.error} />

      <header className="portfolio-page-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>{data.selectedPortfolio?.name || "Main Portfolio"}</h2>
          <p>Track holdings, allocation and portfolio performance.</p>
          <small>Last updated: {formattedLastUpdated}</small>
        </div>
        <AddTransactionDrawer currency={portfolioCurrency} holdings={data.portfolioHoldings} portfolioId={portfolioId} />
      </header>

      <PortfolioSummary
        currency={portfolioCurrency}
        holdingsCount={displayHoldings.length}
        portfolioValue={displayPortfolioValue}
        unrealizedGain={unrealizedGain}
      />

      <section className="portfolio-core-grid">
        <section className="panel portfolio-section holdings-section">
          <div className="portfolio-section-head">
            <div>
              <h2>Holdings</h2>
              <p>Your current positions, sorted by market value.</p>
            </div>
            <span>{displayHoldings.length} {displayHoldings.length === 1 ? "asset" : "assets"}</span>
          </div>
          <DashboardHoldingsTable holdings={displayHoldings} canDelete={!isUsingSeedPortfolio} />
          {!isUsingSeedPortfolio ? (
            <details className="portfolio-secondary-action">
              <summary>+ Add an asset manually</summary>
              <div><PortfolioAssetSearch portfolioId={portfolioId} /></div>
            </details>
          ) : null}
        </section>
        <PortfolioAllocation cashBalance={data.cashBalance} hasCashLedger={data.hasCashLedger} holdings={displayHoldings} />
      </section>

      <PortfolioPerformance />

      <section className="panel portfolio-section">
        <div className="portfolio-section-head">
          <div>
            <h2>News for your holdings</h2>
            <p>Latest daily report filtered to assets in this portfolio.</p>
          </div>
          <Link className="portfolio-text-link" href="/daily">Daily Report →</Link>
        </div>
        <NewsByHolding reportDate={latestReport?.date} stocks={reportStocks} />
      </section>

      <section className="panel portfolio-section">
        <div className="portfolio-section-head">
          <div>
            <h2>Transaction History</h2>
            <p>All recorded activity for this portfolio.</p>
          </div>
        </div>
        <PortfolioTransactionHistory
          portfolioName={data.selectedPortfolio?.name || "Main Portfolio"}
          transactions={data.transactions}
        />
      </section>
    </main>
  );
}

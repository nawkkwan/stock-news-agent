import Link from "next/link";
import { getInvestmentData } from "../../../lib/investment-data";
import { ConfigNotice, JourneyList, PortfolioSelector, TransactionForm } from "../components";
import { PortfolioAssetSearch } from "../portfolio-asset-search";

export const dynamic = "force-dynamic";

export default async function JourneyPage({
  searchParams,
}: {
  searchParams?: Promise<{ portfolio?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const data = await getInvestmentData({ selectedPortfolioId: params.portfolio });
  const selectedPortfolioId = data.selectedPortfolio?.id || null;

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Add to Portfolio</h2>
            <p className="muted">Choose a portfolio, add a stock, then record the actual purchase details and your reason.</p>
          </div>
          <Link className="button secondary" href="/investing/settings">Manage portfolio</Link>
        </div>
        {data.portfolios.length > 0 ? <PortfolioSelector portfolios={data.portfolios} selectedPortfolio={data.selectedPortfolio} pathname="/investing/journey" /> : null}
      </section>
      <section className="two-column align-start">
        <div className="panel">
          <h2>Add an asset</h2>
          <p className="muted">Search a ticker, fetch its latest quote, then add it to the selected portfolio.</p>
          <PortfolioAssetSearch portfolioId={selectedPortfolioId} />
        </div>
        <div className="panel">
          <h2>Record a Transaction</h2>
          <p className="muted">Record a buy, sell, deposit, dividend, or withdrawal using the actual date and price.</p>
          <TransactionForm holdings={data.portfolioHoldings} portfolioId={selectedPortfolioId} />
        </div>
      </section>

      <section className="panel">
        <h2>Selected portfolio snapshot</h2>
        <dl className="mini-grid">
          <div>
            <dt>Portfolio</dt>
            <dd>{data.selectedPortfolio?.name || "No portfolio selected"}</dd>
          </div>
          <div>
            <dt>Portfolio value</dt>
            <dd>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(data.portfolioValue)}</dd>
          </div>
          <div>
            <dt>Cash balance</dt>
            <dd>{data.hasCashLedger ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(data.cashBalance) : "Not tracked"}</dd>
          </div>
          <div>
            <dt>Open holdings</dt>
            <dd>{data.portfolioHoldings.length}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Transaction History</h2>
        <JourneyList transactions={data.transactions} />
      </section>
    </main>
  );
}

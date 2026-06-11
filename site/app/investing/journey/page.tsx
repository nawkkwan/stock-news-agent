import { getInvestmentData } from "../../../lib/investment-data";
import { ConfigNotice, JourneyList, TransactionForm } from "../components";

export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const data = await getInvestmentData();

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />
      <section className="two-column align-start">
        <div className="panel">
          <h2>Add journey entry</h2>
          <TransactionForm />
        </div>
        <div className="panel">
          <h2>Portfolio snapshot</h2>
          <dl className="mini-grid">
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
            <div>
              <dt>Journey entries</dt>
              <dd>{data.transactions.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="panel">
        <h2>Investment journey</h2>
        <JourneyList transactions={data.transactions} />
      </section>
    </main>
  );
}

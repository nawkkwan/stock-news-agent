import Link from "next/link";
import { getInvestmentData } from "../../lib/investment-data";
import {
  CompanyForm,
  ConfigNotice,
  DecisionsList,
  HoldingsTable,
  NewsList,
  JourneyList,
  TransactionForm,
  WatchlistTable,
} from "./components";

export const dynamic = "force-dynamic";

export default async function InvestingPage() {
  const data = await getInvestmentData();
  const latestNews = data.news.slice(0, 5);
  const recentDecisions = data.decisions.slice(0, 5);

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />

      <section className="summary-grid" aria-label="Investment summary">
        <div>
          <span>Companies</span>
          <strong>{data.companies.length}</strong>
        </div>
        <div>
          <span>Holdings</span>
          <strong>{data.portfolioHoldings.length}</strong>
        </div>
        <div>
          <span>Watchlist</span>
          <strong>{data.watchlist.length}</strong>
        </div>
        <div>
          <span>Portfolio value</span>
          <strong>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(data.portfolioValue)}</strong>
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="section-head">
            <h2>Holdings</h2>
          </div>
          <HoldingsTable holdings={data.portfolioHoldings} />
        </div>
        <div className="panel">
          <div className="section-head">
            <h2>Watchlist</h2>
            <Link className="button secondary" href="/investing/watchlist">
              Manage
            </Link>
          </div>
          <WatchlistTable items={data.watchlist.slice(0, 6)} />
        </div>
      </section>

      <section className="two-column align-start">
        <div className="panel">
          <h2>Add company</h2>
          <CompanyForm />
        </div>
        <div className="panel">
          <h2>Add transaction</h2>
          <TransactionForm />
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Latest journey</h2>
          <Link className="button secondary" href="/investing/journey">
            Open full journey
          </Link>
        </div>
        <JourneyList transactions={data.transactions.slice(0, 5)} />
      </section>

      <section className="two-column align-start">
        <div className="panel">
          <div className="section-head">
            <h2>Latest news</h2>
          </div>
          <NewsList news={latestNews} />
        </div>
        <div className="panel">
          <div className="section-head">
            <h2>Recent decisions</h2>
            <Link className="button secondary" href="/investing/journal">
              Open journal
            </Link>
          </div>
          <DecisionsList decisions={recentDecisions} />
        </div>
      </section>
    </main>
  );
}

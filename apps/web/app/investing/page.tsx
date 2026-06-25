import Link from "next/link";
import { getInvestmentData } from "../../lib/investment-data";
import {
  CompanyForm,
  ConfigNotice,
  HoldingsTable,
  InvestmentJournalList,
  NewsList,
  JourneyList,
  PortfolioForm,
  PortfolioSelector,
  PortfolioSummaryCards,
  TransactionForm,
  WatchlistTable,
} from "./components";

export const dynamic = "force-dynamic";

export default async function InvestingPage({
  searchParams,
}: {
  searchParams?: Promise<{ portfolio?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const data = await getInvestmentData({ selectedPortfolioId: params.portfolio });
  const latestNews = data.news.slice(0, 5);
  const recentJournalEntries = data.journalEntries.slice(0, 5);
  const selectedPortfolioId = data.selectedPortfolio?.id || null;

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Portfolios</h2>
            <p className="muted">Separate accounts, strategies, and future bot portfolios without mixing records.</p>
          </div>
        </div>
        <PortfolioSelector portfolios={data.portfolios} selectedPortfolio={data.selectedPortfolio} />
        <PortfolioSummaryCards summaries={data.portfolioSummaries} />
      </section>

      <section className="summary-grid" aria-label="Investment summary">
        <div>
          <span>Selected portfolio</span>
          <strong>{data.selectedPortfolio?.name || "None"}</strong>
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
          <h2>{data.selectedPortfolio ? "Edit selected portfolio" : "Create portfolio"}</h2>
          <PortfolioForm portfolio={data.selectedPortfolio} />
        </div>
        <div className="panel">
          <h2>Create another portfolio</h2>
          <PortfolioForm />
        </div>
      </section>

      <section className="two-column align-start">
        <div className="panel">
          <h2>Add company</h2>
          <CompanyForm />
        </div>
        <div className="panel">
          <h2>Add transaction</h2>
          <TransactionForm portfolioId={selectedPortfolioId} />
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
            <h2>Recent journal entries</h2>
            <Link className="button secondary" href="/investing/journal">
              Open journal
            </Link>
          </div>
          <InvestmentJournalList entries={recentJournalEntries} />
        </div>
      </section>
    </main>
  );
}

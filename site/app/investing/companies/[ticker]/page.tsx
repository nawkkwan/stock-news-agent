import Link from "next/link";
import { getCompanyData, formatDate, formatNumber } from "../../../../lib/investment-data";
import {
  CompanyForm,
  ConfigNotice,
  DecisionForm,
  DecisionsList,
  HoldingForm,
  NewsForm,
  NewsList,
  ThesisForm,
  TransactionForm,
  WatchlistForm,
} from "../../components";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const data = await getCompanyData(ticker);

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />
      <section className="company-hero">
        <div>
          <Link href="/investing">Back to overview</Link>
          <h2>{ticker}</h2>
          <p>{data.company?.name || "Company profile not filled yet."}</p>
        </div>
        <dl className="mini-grid">
          <div>
            <dt>Sector</dt>
            <dd>{data.company?.sector || "-"}</dd>
          </div>
          <div>
            <dt>Industry</dt>
            <dd>{data.company?.industry || "-"}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{formatNumber(data.thesis?.confidence_score)}</dd>
          </div>
          <div>
            <dt>Portfolio weight</dt>
            <dd>{formatNumber(data.portfolioHolding?.portfolio_weight, "%")}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDate(data.company?.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="two-column align-start">
        <div className="panel">
          <h2>Company</h2>
          <CompanyForm company={data.company} ticker={ticker} />
        </div>
        <div className="panel">
          <h2>Holding settings</h2>
          <HoldingForm holding={data.holding} ticker={ticker} />
        </div>
      </section>

      <section className="panel">
        <h2>Add to journey</h2>
        <TransactionForm ticker={ticker} />
      </section>

      <section className="panel">
        <h2>Investment thesis</h2>
        <ThesisForm thesis={data.thesis} ticker={ticker} />
      </section>

      <section className="two-column align-start">
        <div className="panel">
          <h2>Watchlist</h2>
          <WatchlistForm item={data.watchlistItem} ticker={ticker} />
        </div>
        <div className="panel">
          <h2>Add decision</h2>
          <DecisionForm ticker={ticker} />
        </div>
      </section>

      <section className="two-column align-start">
        <div className="panel">
          <h2>Add news impact</h2>
          <NewsForm ticker={ticker} />
        </div>
        <div className="panel">
          <h2>Decision history</h2>
          <DecisionsList decisions={data.companyDecisions} />
        </div>
      </section>

      <section className="panel">
        <h2>Related news</h2>
        <NewsList news={data.companyNews} editable />
      </section>
    </main>
  );
}

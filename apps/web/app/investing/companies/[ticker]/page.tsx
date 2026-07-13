import Link from "next/link";
import { getCompanyData, formatNumber } from "../../../../lib/investment-data";
import { ConfigNotice, NewsList, ThesisForm, WatchlistForm } from "../../components";

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
          <Link href="/investing">Back to My Portfolio</Link>
          <h2>{ticker}</h2>
          <p>{data.company?.name || "Company profile not filled yet."}</p>
        </div>
        <dl className="mini-grid">
          <div><dt>Sector</dt><dd>{data.company?.sector || "-"}</dd></div>
          <div><dt>Industry</dt><dd>{data.company?.industry || "-"}</dd></div>
          <div><dt>Confidence</dt><dd>{formatNumber(data.thesis?.confidence_score)}</dd></div>
          <div><dt>Portfolio weight</dt><dd>{formatNumber(data.portfolioHolding?.portfolio_weight, "%")}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <h2>Investment thesis</h2>
        <ThesisForm thesis={data.thesis} ticker={ticker} />
      </section>

      <section className="panel">
        <h2>Watchlist</h2>
        <WatchlistForm item={data.watchlistItem} ticker={ticker} />
      </section>

      <section className="panel">
        <h2>Related news</h2>
        <NewsList news={data.companyNews} />
      </section>
    </main>
  );
}

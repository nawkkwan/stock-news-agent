import { getInvestmentData } from "../../../lib/investment-data";
import { ConfigNotice, WatchlistForm, WatchlistTable } from "../components";
import { WatchlistAssetSearch } from "../watchlist-asset-search";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const data = await getInvestmentData();

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />
      <section className="panel">
        <h2>Add to Watchlist</h2>
        <p className="muted">Search for a ticker or company, then select the exact asset you want to research.</p>
        <WatchlistAssetSearch />
      </section>

      <section className="panel">
        <h2>Watchlist stocks</h2>
        <WatchlistTable items={data.watchlist} />
      </section>

      <section className="panel">
        <h2>Update research status</h2>
        <div className="edit-grid">
          {data.watchlist.map((item) => (
            <article className="item-card" key={item.id}>
              <strong>{item.ticker}</strong>
              <WatchlistForm item={item} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

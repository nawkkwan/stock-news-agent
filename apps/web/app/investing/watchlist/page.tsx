import { getInvestmentData } from "../../../lib/investment-data";
import { ConfigNotice, WatchlistForm, WatchlistTable } from "../components";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const data = await getInvestmentData();

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />
      <section className="panel">
        <h2>Add ticker</h2>
        <WatchlistForm />
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

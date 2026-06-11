import { getInvestmentData } from "../../../lib/investment-data";
import { journalActions, type JournalAction } from "../../../lib/investment-types";
import { ConfigNotice, DecisionForm, DecisionsList } from "../components";

export const dynamic = "force-dynamic";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string | string[]; action?: string | string[] }>;
}) {
  const params = await searchParams;
  const ticker = String(firstValue(params.ticker) || "").trim().toUpperCase();
  const action = firstValue(params.action) as JournalAction | undefined;
  const data = await getInvestmentData();
  const decisions = data.decisions.filter((entry) => {
    const tickerMatch = ticker ? entry.ticker === ticker : true;
    const actionMatch = action && journalActions.includes(action) ? entry.action === action : true;
    return tickerMatch && actionMatch;
  });

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />
      <section className="panel">
        <h2>Add journal entry</h2>
        <DecisionForm ticker={ticker} />
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Decision journal</h2>
          <form className="filter-row">
            <input name="ticker" placeholder="Ticker" defaultValue={ticker} />
            <select name="action" defaultValue={action || ""}>
              <option value="">All actions</option>
              {journalActions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button className="button secondary" type="submit">
              Filter
            </button>
          </form>
        </div>
        <DecisionsList decisions={decisions} editable />
      </section>
    </main>
  );
}

import fs from "node:fs/promises";
import path from "node:path";

type ReportStock = {
  ticker?: string;
  company?: string;
  key_takeaway?: string;
  key_news?: string;
  possible_impact?: string;
  impact?: string;
  portfolio_weight_pct?: number;
  target_weight_pct?: number;
};

type LatestReport = {
  date?: string;
  generated_at?: string;
  status?: string;
  portfolio_summary?: string;
  stocks?: ReportStock[];
};

async function getLatestReport(): Promise<LatestReport | null> {
  try {
    const file = await fs.readFile(path.join(process.cwd(), "data", "latest-report.json"), "utf8");
    return JSON.parse(file) as LatestReport;
  } catch {
    return null;
  }
}

export default async function DailyPage() {
  const report = await getLatestReport();
  const stocks = report?.stocks || [];

  return (
    <main className="page-shell">
      <section className="panel">
        <p className="eyebrow">Daily Notes</p>
        <h2>{report?.date || "No report loaded"}</h2>
        <p>{report?.portfolio_summary || "Generate a daily report to populate this view."}</p>
      </section>

      <section className="summary-grid" aria-label="Daily report summary">
        <div>
          <span>Status</span>
          <strong>{report?.status || "-"}</strong>
        </div>
        <div>
          <span>Stocks</span>
          <strong>{stocks.length}</strong>
        </div>
        <div>
          <span>Generated</span>
          <strong>{report?.generated_at ? new Date(report.generated_at).toLocaleDateString("en-US") : "-"}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>JSON</strong>
        </div>
      </section>

      <section className="panel">
        <h2>Portfolio impact</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Weight</th>
                <th>Target</th>
                <th>Company</th>
                <th>Takeaway</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => (
                <tr key={stock.ticker}>
                  <td>{stock.ticker || "-"}</td>
                  <td>{stock.portfolio_weight_pct ?? "-"}</td>
                  <td>{stock.target_weight_pct ?? "-"}</td>
                  <td>{stock.company || "-"}</td>
                  <td>{stock.key_takeaway || stock.key_news || "-"}</td>
                  <td>{stock.possible_impact || stock.impact || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

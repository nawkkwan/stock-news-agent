import { getInvestmentData } from "../../../lib/investment-data";
import {
  CompanyForm,
  ConfigNotice,
  ImportDailyPortfolioButton,
  PortfolioForm,
  PortfolioSelector,
} from "../components";

export const dynamic = "force-dynamic";

export default async function PortfolioSettingsPage({
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
        <h2>Portfolio settings</h2>
        <p className="muted">Import your initial Daily Notes snapshot once, then manage portfolio details here.</p>
        {data.portfolios.length > 0 ? <PortfolioSelector portfolios={data.portfolios} selectedPortfolio={data.selectedPortfolio} pathname="/investing/settings" /> : null}
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Import Daily Notes portfolio</h2>
            <p className="muted">Creates or updates holdings from the latest daily report. This does not add transactions.</p>
          </div>
          <ImportDailyPortfolioButton portfolioId={selectedPortfolioId} />
        </div>
      </section>

      <section className="two-column align-start">
        <div className="panel">
          <h2>{data.selectedPortfolio ? "Edit selected portfolio" : "Create your first portfolio"}</h2>
          <PortfolioForm portfolio={data.selectedPortfolio} />
        </div>
        <div className="panel">
          <h2>Create another portfolio</h2>
          <PortfolioForm />
        </div>
      </section>

      <section className="panel">
        <details>
          <summary>Add company profile</summary>
          <CompanyForm />
        </details>
      </section>
    </main>
  );
}

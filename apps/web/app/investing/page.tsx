import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { getInvestmentData } from "../../lib/investment-data";
import {
  ConfigNotice,
  DashboardHoldingsTable,
  NewsByHolding,
  PortfolioAllocation,
  PortfolioForm,
  PortfolioSelector,
  PortfolioSnapshot,
  PortfolioTransactionHistory,
  TransactionForm,
  type DashboardHolding,
  type DailyReportStock,
} from "./components";
import { PortfolioAssetSearch } from "./portfolio-asset-search";

export const dynamic = "force-dynamic";

type LatestReport = {
  date?: string;
  summary?: { total_portfolio_value_thb?: number | null };
  stocks?: DailyReportStock[];
};

async function getLatestReport(): Promise<LatestReport | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "latest-report.json"), "utf8")) as LatestReport;
  } catch {
    return null;
  }
}

export default async function InvestingPage({
  searchParams,
}: {
  searchParams?: Promise<{ portfolio?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const [data, latestReport] = await Promise.all([
    getInvestmentData({ selectedPortfolioId: params.portfolio }),
    getLatestReport(),
  ]);
  const reportHoldings: DashboardHolding[] = (latestReport?.stocks || [])
    .filter((stock) => stock.ticker && Number(stock.holding_value_thb) > 0)
    .map((stock) => ({
      id: `report-${stock.ticker}`,
      ticker: String(stock.ticker).toUpperCase(),
      company: stock.company || null,
      market_value: Number(stock.holding_value_thb),
      portfolio_weight: Number(stock.portfolio_weight_pct) || 0,
      unrealized_gain: stock.unrealized_gain_thb ?? null,
      unrealized_gain_pct: stock.unrealized_gain_pct ?? null,
    }));
  const isUsingSeedPortfolio = data.portfolios.length === 0 && data.portfolioHoldings.length === 0 && reportHoldings.length > 0;
  const displayHoldings = isUsingSeedPortfolio ? reportHoldings : data.portfolioHoldings;
  const displayPortfolioValue = isUsingSeedPortfolio
    ? Number(latestReport?.summary?.total_portfolio_value_thb) || reportHoldings.reduce((sum, holding) => sum + holding.market_value, 0)
    : data.portfolioValue;
  const currentTickers = new Set(displayHoldings.map((holding) => holding.ticker.toUpperCase()));
  const reportStocks = (latestReport?.stocks || []).filter((stock) => stock.ticker && currentTickers.has(stock.ticker.toUpperCase()));
  const unrealizedGain = displayHoldings.reduce((sum, holding) => sum + (holding.unrealized_gain || 0), 0);
  const portfolioId = data.selectedPortfolio?.id || null;

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>My Portfolio</h2>
            <p className="muted">เพิ่มหุ้นใหม่หรือบันทึกซื้อขายได้ด้านล่าง หุ้นที่ถือจะอัปเดตให้อัตโนมัติ</p>
          </div>
          <a className="button" href="#portfolio-activity">เพิ่มหุ้นหรือบันทึกซื้อขาย</a>
        </div>
        {data.portfolios.length > 1 ? <PortfolioSelector portfolios={data.portfolios} selectedPortfolio={data.selectedPortfolio} /> : null}
        <details className="portfolio-create">
          <summary>+ เพิ่ม Portfolio ใหม่</summary>
          <PortfolioForm />
        </details>
      </section>

      <PortfolioSnapshot
        cashBalance={data.cashBalance}
        hasCashLedger={data.hasCashLedger}
        holdingsCount={displayHoldings.length}
        portfolioName={data.selectedPortfolio?.name || "My Portfolio"}
        portfolioValue={displayPortfolioValue}
        unrealizedGain={unrealizedGain}
      />

      <section className="dashboard-grid" id="portfolio-activity">
        <details className="panel dashboard-panel activity-panel">
          <summary className="activity-panel-summary">
            <span>
              <strong>เพิ่มหุ้นใหม่</strong>
              <small>ค้นหาและเพิ่มหุ้นเข้า Portfolio</small>
            </span>
            <span className="activity-panel-toggle" aria-hidden="true">⌄</span>
          </summary>
          <div className="activity-panel-content">
            <p className="muted">ค้นหาหุ้น เลือกราคาล่าสุด แล้วเพิ่มเข้า Portfolio ที่กำลังดูอยู่</p>
            <PortfolioAssetSearch portfolioId={portfolioId} />
          </div>
        </details>
        <details className="panel dashboard-panel activity-panel">
          <summary className="activity-panel-summary">
            <span>
              <strong>บันทึกซื้อขาย</strong>
              <small>เพิ่มรายการซื้อ ขาย หรือเงินสด</small>
            </span>
            <span className="activity-panel-toggle" aria-hidden="true">⌄</span>
          </summary>
          <div className="activity-panel-content">
            <p className="muted">บันทึกซื้อหรือขายเอง ระบบจะอัปเดตจำนวนหุ้นในพอร์ตให้</p>
            <TransactionForm holdings={data.portfolioHoldings} portfolioId={portfolioId} />
          </div>
        </details>
      </section>

      <section className="dashboard-grid">
        <PortfolioAllocation cashBalance={data.cashBalance} hasCashLedger={data.hasCashLedger} holdings={displayHoldings} />
        <div className="panel dashboard-panel">
          <h2>หุ้นที่ถืออยู่</h2>
          <p className="muted">รายการหุ้นทั้งหมดใน Portfolio นี้</p>
          <DashboardHoldingsTable holdings={displayHoldings} canDelete={!isUsingSeedPortfolio} />
        </div>
      </section>

      <section className="panel dashboard-panel">
        <h2>ประวัติซื้อขาย</h2>
        <p className="muted">รายการที่บันทึกไว้ แยกตามหุ้นใน Portfolio ที่กำลังดู</p>
        <PortfolioTransactionHistory
          portfolioName={data.selectedPortfolio?.name || "My Portfolio"}
          transactions={data.transactions}
        />
      </section>

      <section className="panel dashboard-panel">
        <div className="section-head">
          <div>
            <h2>News by Holding</h2>
            <p className="muted">Latest daily report filtered to stocks in this portfolio.</p>
          </div>
          <Link className="button secondary" href="/daily">Daily News</Link>
        </div>
        <NewsByHolding reportDate={latestReport?.date} stocks={reportStocks} />
      </section>
    </main>
  );
}

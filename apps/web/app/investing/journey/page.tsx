import { getInvestmentData } from "../../../lib/investment-data";
import { ConfigNotice, JourneyList, TransactionForm } from "../components";

export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const data = await getInvestmentData();
  const selectedPortfolioId = data.selectedPortfolio?.id || null;

  return (
    <main className="page-shell">
      <ConfigNotice configured={data.configured} error={data.error} />
      <section className="panel">
        <h2>บันทึกซื้อขาย</h2>
        <p className="muted">เพิ่มรายการซื้อหรือขายเอง ระบบจะสร้างและอัปเดตหุ้นใน My Portfolio ให้โดยอัตโนมัติ</p>
        <TransactionForm holdings={data.portfolioHoldings} portfolioId={selectedPortfolioId} />
      </section>

      <section className="panel">
        <h2>ประวัติซื้อขาย</h2>
        <JourneyList transactions={data.transactions} />
      </section>
    </main>
  );
}

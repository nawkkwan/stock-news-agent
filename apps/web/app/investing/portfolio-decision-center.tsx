import Link from "next/link";
import type { StockResearchSnapshot, WatchlistItem } from "../../lib/investment-types";
import type { DailyReportStock } from "./components";
import { DeleteWatchlistButton } from "./delete-watchlist-button";

function riskScore(stock: DailyReportStock) {
  const risk = String(stock.risk_level || "").toLowerCase();
  const relevance = String(stock.relevance_score || "").toLowerCase();
  return (risk === "high" ? 4 : risk === "medium" ? 2 : 0) + (relevance === "high" ? 2 : relevance === "medium" ? 1 : 0);
}

function formatLevel(value: number | undefined) {
  return value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function PortfolioDecisionCenter({
  stocks,
  watchlist,
  snapshots,
  holdingTickers,
  reportDate,
}: {
  stocks: DailyReportStock[];
  watchlist: WatchlistItem[];
  snapshots: StockResearchSnapshot[];
  holdingTickers: string[];
  reportDate?: string | null;
}) {
  const priority = [...stocks].sort((left, right) => riskScore(right) - riskScore(left)).slice(0, 4);
  const pathFor = (ticker: string) => holdingTickers.find((item) => item.split(".")[0] === ticker.split(".")[0]) || ticker;
  const latestSnapshotByTicker = new Map<string, StockResearchSnapshot>();
  for (const snapshot of snapshots) {
    if (!latestSnapshotByTicker.has(snapshot.ticker)) latestSnapshotByTicker.set(snapshot.ticker, snapshot);
  }

  return (
    <section className="panel portfolio-section portfolio-decision-center">
      <div className="portfolio-section-head">
        <div><p className="eyebrow">Today</p><h2>วันนี้ต้องรู้</h2><p>เรียงข่าว ความเสี่ยง และจุดทบทวนที่สำคัญต่อพอร์ต</p></div>
        <span>{reportDate ? `ข้อมูลรอบ ${reportDate}` : "รอ Daily Worker รอบแรก"}</span>
      </div>
      {priority.length ? (
        <div className="today-signal-grid">
          {priority.map((stock) => {
            const supports = stock.technical?.support_zones || [];
            const snapshot = latestSnapshotByTicker.get(pathFor(String(stock.ticker || ""))) || latestSnapshotByTicker.get(String(stock.ticker || ""));
            return (
              <Link className="today-signal-card" href={`/investing/companies/${pathFor(String(stock.ticker || ""))}`} key={stock.ticker}>
                <header><strong>{stock.ticker}</strong><span className={`risk-${String(stock.risk_level || "unknown").toLowerCase()}`}>{stock.risk_level || "Unrated"} risk</span></header>
                <h3>{stock.key_takeaway || stock.key_news || "ยังไม่มีข่าวสำคัญใหม่"}</h3>
                <p>{stock.possible_impact || stock.what_to_monitor || "เปิดหน้าหุ้นเพื่อตรวจหลักฐานและบริบทพอร์ต"}</p>
                <footer><span>Weight {stock.portfolio_weight_pct ?? "—"}%</span><span>Watch {supports.length ? `${formatLevel(Math.min(...supports))}–${formatLevel(Math.max(...supports))}` : "รอข้อมูล"}</span><span>{snapshot ? `${snapshot.source} saved` : "daily evidence"}</span></footer>
              </Link>
            );
          })}
        </div>
      ) : <div className="portfolio-empty-state"><strong>ยังไม่มีสัญญาณรายวัน</strong><span>พอร์ตยังใช้งานได้ตามปกติ และระบบจะแสดงข้อมูลเมื่อ Daily Worker บันทึกรอบถัดไป</span></div>}

      <div className="portfolio-watchlist-strip">
        <div><strong>Watchlist</strong><span>หุ้นที่ต้องตามต่อ — ลบได้โดยไม่ลบ Research History</span></div>
        <div className="watchlist-chip-list">
          {watchlist.map((item) => <div className="watchlist-chip" key={item.id}><Link href={`/investing/companies/${item.ticker}`}>{item.ticker}<small>{item.status.replaceAll("_", " ")}</small></Link><DeleteWatchlistButton id={item.id} ticker={item.ticker} /></div>)}
          {!watchlist.length ? <Link className="portfolio-text-link" href="/investing/watchlist">+ เพิ่มหุ้นที่ต้องการติดตาม</Link> : null}
        </div>
      </div>
    </section>
  );
}

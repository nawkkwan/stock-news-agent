import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { getInvestmentData } from "../../../lib/investment-data";
import AgentRoomClient from "./agent-room-client";

type RoomStock = {
  ticker?: string;
  relevance_score?: string;
  risk_level?: string;
};

type RoomReport = {
  date?: string;
  generated_at?: string;
  summary?: {
    total_articles?: number;
    risk_alerts?: string[];
  };
  stocks?: RoomStock[];
};

async function getRoomReport(): Promise<RoomReport | null> {
  try {
    const file = await fs.readFile(path.join(process.cwd(), "data", "latest-report.json"), "utf8");
    return JSON.parse(file) as RoomReport;
  } catch {
    return null;
  }
}

function formatRunTime(value?: string) {
  if (!value) return "Waiting for first run";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export default async function AgentRoomPage() {
  const [report, data] = await Promise.all([getRoomReport(), getInvestmentData()]);
  const stocks = report?.stocks || [];
  const prioritySignals = stocks.filter(
    (stock) => stock.relevance_score === "High" || stock.risk_level === "High"
  );
  const thesisTickers = new Set(data.thesisNotes.map((item) => item.ticker));
  const readyWatchlist = data.watchlist.filter(
    (item) => thesisTickers.has(item.ticker) && ["thesis_drafted", "ready_to_buy"].includes(item.status)
  );

  return (
    <main className="page-shell room-page">
      <header className="room-header">
        <div>
          <p className="eyebrow">Pixel Agent Operations Room</p>
          <h2>คืนนี้ทีมวิจัยกำลังเฝ้าพอร์ตให้คุณ</h2>
          <p>สถานะในห้องคำนวณจาก Daily Report, Thesis และ Watchlist ที่มีอยู่จริง</p>
        </div>
        <div className="room-header-actions">
          <span className="room-clock">Last run · {formatRunTime(report?.generated_at)}</span>
          <Link href="/agent">Back to dashboard</Link>
        </div>
      </header>

      <AgentRoomClient metrics={{
        articles: report?.summary?.total_articles ?? 0,
        signals: prioritySignals.length,
        holdings: stocks.length,
        risks: report?.summary?.risk_alerts?.length || 0,
        watchlist: data.watchlist.length,
        ready: readyWatchlist.length,
      }} />

      <section className="room-console-grid">
        <article className="room-console">
          <p className="eyebrow">Incoming queue</p>
          <h3>สิ่งที่กำลังรอตรวจ</h3>
          <ul>
            {prioritySignals.slice(0, 5).map((stock) => (
              <li key={stock.ticker}><span>{stock.ticker}</span><strong>{stock.relevance_score} relevance · {stock.risk_level} risk</strong></li>
            ))}
            {!prioritySignals.length ? <li><span>QUEUE</span><strong>No high-priority signals</strong></li> : null}
          </ul>
        </article>

        <article className="room-console">
          <p className="eyebrow">Research memory</p>
          <h3>ความพร้อมของทีม</h3>
          <ul>
            <li><span>THESIS</span><strong>{data.thesisNotes.length} company notes connected</strong></li>
            <li><span>JOURNAL</span><strong>{data.journalEntries.length} decision records available</strong></li>
            <li><span>WATCH</span><strong>{readyWatchlist.length} names ready for review</strong></li>
          </ul>
        </article>

        <article className="room-console room-console-next">
          <p className="eyebrow">Next upgrade</p>
          <h3>จากห้องที่มองเห็น ไปสู่ทีมที่ลงมือค้นเอง</h3>
          <p>
            ตอนนี้ห้องแสดงสถานะจาก pipeline เดิม ขั้นต่อไปคือเชื่อม Thesis-aware output และ ReAct tools
            เพื่อให้แต่ละโต๊ะมีงานของตัวเองจริง พร้อมส่งหลักฐานให้ Reviewer ตรวจ
          </p>
        </article>
      </section>
    </main>
  );
}

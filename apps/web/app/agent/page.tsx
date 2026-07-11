import fs from "node:fs/promises";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { getInvestmentData } from "../../lib/investment-data";

type ReportArticle = {
  title?: string;
  url?: string;
  source?: string;
};

type ReportStock = {
  ticker?: string;
  company?: string;
  key_takeaway?: string;
  key_news?: string;
  possible_impact?: string;
  risk_level?: string;
  relevance_score?: string;
  confidence?: string;
  portfolio_weight_pct?: number;
  technical?: { last_close?: number };
  articles?: ReportArticle[];
};

type LatestReport = {
  date?: string;
  generated_at?: string;
  status?: string;
  summary?: {
    portfolio_summary?: string;
    risk_alerts?: string[];
    total_articles?: number;
  };
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

function priorityScore(stock: ReportStock) {
  const relevance = stock.relevance_score === "High" ? 3 : stock.relevance_score === "Medium" ? 2 : 1;
  const risk = stock.risk_level === "High" ? 3 : stock.risk_level === "Medium" ? 2 : 1;
  return relevance * 10 + risk + (stock.portfolio_weight_pct || 0) / 100;
}

function reviewState(status: string, hasThesis: boolean) {
  if (!hasThesis) return { label: "Not ready", tone: "muted" };
  if (status === "ready_to_buy") return { label: "Review zone", tone: "warning" };
  if (status === "thesis_drafted") return { label: "Thesis ready", tone: "positive" };
  if (status === "rejected") return { label: "Rejected", tone: "danger" };
  return { label: "Monitoring", tone: "neutral" };
}

export default async function AgentPage() {
  const [report, data] = await Promise.all([getLatestReport(), getInvestmentData()]);
  const stocks = report?.stocks || [];
  const priorityStocks = [...stocks].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 3);
  const thesisTickers = new Set(data.thesisNotes.map((note) => note.ticker));
  const thesisCoverage = data.portfolioHoldings.length
    ? Math.round((data.portfolioHoldings.filter((holding) => thesisTickers.has(holding.ticker)).length / data.portfolioHoldings.length) * 100)
    : 0;
  const highSignals = stocks.filter(
    (stock) => stock.relevance_score === "High" || stock.risk_level === "High"
  ).length;

  return (
    <main className="page-shell agent-page">
      <section className="agent-hero">
        <div className="agent-portrait-wrap">
          <Image
            className="agent-portrait"
            src="/agent/pixel-portfolio-agent.png"
            alt="Pixel art portfolio research assistant"
            width={1254}
            height={1254}
            priority
          />
          <span className="agent-online"><i /> Online · report mode</span>
        </div>

        <div className="agent-intro">
          <p className="eyebrow">Pixel Portfolio Agent · MVP</p>
          <h2>I watch the noise, you make the decision.</h2>
          <p className="agent-lead">
            วันนี้ผมอ่านรายงานล่าสุด เทียบข่าวกับน้ำหนักพอร์ต และตรวจความพร้อมของ Watchlist แล้ว
            หน้านี้เป็น decision support และจะไม่แก้พอร์ตหรือส่งคำสั่งซื้อขาย
          </p>
          <div className="agent-command">
            <span className="agent-prompt">AGENT://</span>
            <p>{report?.summary?.portfolio_summary || "ยังไม่มี Daily Report ให้ตรวจ กรุณารัน worker ก่อน"}</p>
          </div>
          <div className="agent-actions">
            <Link className="agent-primary-action" href="/agent/room">Enter agent room</Link>
            <Link className="agent-primary-action" href="/daily">Open daily report</Link>
            <Link className="agent-secondary-action" href="/investing/watchlist">Manage watchlist</Link>
          </div>
        </div>
      </section>

      <section className="agent-stats" aria-label="Agent status">
        <div><span>Report date</span><strong>{report?.date || "-"}</strong></div>
        <div><span>News scanned</span><strong>{report?.summary?.total_articles ?? "-"}</strong></div>
        <div><span>Priority signals</span><strong>{highSignals}</strong></div>
        <div><span>Thesis coverage</span><strong>{thesisCoverage}%</strong></div>
      </section>

      {data.error ? <p className="notice danger">Portfolio context: {data.error}</p> : null}

      <section className="agent-mode-grid">
        <article className="agent-mode-card scout">
          <div className="agent-mode-head">
            <span className="agent-mode-icon" aria-hidden="true">01</span>
            <div><p className="eyebrow">Scout mode</p><h3>คัดสัญญาณจากข่าว</h3></div>
          </div>
          <p>จัดลำดับจาก relevance, risk และน้ำหนักในพอร์ต เพื่อให้เริ่มอ่านจากสิ่งที่มีผลมากที่สุด</p>
          <div className="agent-signal-list">
            {priorityStocks.length ? priorityStocks.map((stock) => (
              <article className="agent-signal" key={stock.ticker}>
                <div className="agent-signal-title">
                  <strong>{stock.ticker || "-"}</strong>
                  <span className={`agent-badge ${(stock.risk_level || "unknown").toLowerCase()}`}>
                    {stock.risk_level || "Unknown"} risk
                  </span>
                </div>
                <p>{stock.key_takeaway || stock.key_news || "No takeaway available."}</p>
                {stock.articles?.[0]?.url ? (
                  <a href={stock.articles[0].url} target="_blank" rel="noreferrer">
                    Source · {stock.articles[0].source || "Open article"}
                  </a>
                ) : null}
              </article>
            )) : <p className="muted">No report signals available.</p>}
          </div>
        </article>

        <article className="agent-mode-card analyst">
          <div className="agent-mode-head">
            <span className="agent-mode-icon" aria-hidden="true">02</span>
            <div><p className="eyebrow">Analyst mode</p><h3>เชื่อมข่าวกับพอร์ต</h3></div>
          </div>
          <p>เวอร์ชันนี้แสดงผลวิเคราะห์จาก Daily Worker พร้อมบริบทน้ำหนักพอร์ต ส่วนการเทียบ Thesis แบบเต็มจะเป็นขั้นถัดไป</p>
          <div className="agent-review-stack">
            {priorityStocks.slice(0, 2).map((stock) => (
              <div className="agent-review-card" key={stock.ticker}>
                <div><strong>{stock.ticker}</strong><span>{stock.portfolio_weight_pct ?? 0}% of report portfolio</span></div>
                <p>{stock.possible_impact || "No impact analysis available."}</p>
                <footer>
                  <span>Confidence: {stock.confidence || "Unknown"}</span>
                  <span>Thesis: {stock.ticker && thesisTickers.has(stock.ticker) ? "connected" : "missing"}</span>
                </footer>
              </div>
            ))}
            {!priorityStocks.length ? <p className="muted">Run the daily report to populate analyst cards.</p> : null}
          </div>
        </article>

        <article className="agent-mode-card ranger">
          <div className="agent-mode-head">
            <span className="agent-mode-icon" aria-hidden="true">03</span>
            <div><p className="eyebrow">Watchlist mode</p><h3>เฝ้า Review Zone</h3></div>
          </div>
          <p>สถานะบอกความพร้อมในการกลับมาทบทวน ไม่ใช่คำแนะนำซื้อขาย และไม่ใช้ราคาลงเป็นสัญญาณเพียงอย่างเดียว</p>
          <div className="agent-watch-list">
            {data.watchlist.length ? data.watchlist.slice(0, 6).map((item) => {
              const reportStock = stocks.find((stock) => stock.ticker === item.ticker);
              const state = reviewState(item.status, thesisTickers.has(item.ticker));
              return (
                <div className="agent-watch-row" key={item.id}>
                  <div><strong>{item.ticker}</strong><span>{item.reason || "No watch reason recorded"}</span></div>
                  <div className="agent-watch-meta">
                    <span>{reportStock?.technical?.last_close ? `$${reportStock.technical.last_close}` : "No quote"}</span>
                    <span className={`agent-state ${state.tone}`}>{state.label}</span>
                  </div>
                </div>
              );
            }) : <p className="muted">Add a company to the Watchlist to begin monitoring.</p>}
          </div>
        </article>
      </section>

      <section className="agent-roadmap">
        <div>
          <p className="eyebrow">Agent boundary</p>
          <h2>เห็นข้อมูลจริงก่อน เพิ่มความอัตโนมัติทีหลัง</h2>
        </div>
        <ol>
          <li className="complete"><span>01</span><div><strong>Read existing context</strong><p>Daily report, portfolio, thesis และ watchlist</p></div></li>
          <li><span>02</span><div><strong>Thesis-aware worker</strong><p>ให้ worker วิเคราะห์ affected assumption และ evidence</p></div></li>
          <li><span>03</span><div><strong>ReAct tools</strong><p>ค้นแหล่งหลักเพิ่มเมื่อข้อมูลไม่พอ</p></div></li>
          <li><span>04</span><div><strong>Reflexion memory</strong><p>จำ feedback ที่ตรวจสอบได้จากคุณ</p></div></li>
        </ol>
      </section>
    </main>
  );
}

import Link from "next/link";
import { getCompanyData, formatDate, formatNumber } from "../../../../lib/investment-data";
import { getLatestReport } from "../../../../lib/latest-report";
import { getCurrentUserOrNull } from "../../../../lib/supabase-server";
import { getStockApiOverview, type MarketBar, type MarketOverview } from "../../../../lib/stock-research";
import { ConfigNotice, ThesisForm, WatchlistForm, type DailyReportStock } from "../../components";
import { DeleteWatchlistButton } from "../../delete-watchlist-button";
import { StockResearchButton } from "../../stock-research-button";

export const dynamic = "force-dynamic";

type DailyReport = { date?: string; generated_at?: string; stocks?: DailyReportStock[] };
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function PriceChart({ history }: { history: MarketBar[] }) {
  if (history.length < 2) {
    return <div className="stock-chart-empty"><strong>ยังไม่มีข้อมูลกราฟราคา</strong><span>ระบบจะแสดงกราฟเมื่อ EODHD ส่งข้อมูลรายวันกลับมา</span></div>;
  }
  const width = 760;
  const height = 250;
  const values = history.map((item) => item.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = history.map((item, index) => `${(index / (history.length - 1)) * width},${height - ((item.close - min) / range) * (height - 24) - 12}`).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <div className="stock-chart-wrap">
      <svg aria-label="กราฟราคาปิดรายวัน" className="stock-price-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs><linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#28d79d" stopOpacity=".34"/><stop offset="1" stopColor="#28d79d" stopOpacity="0"/></linearGradient></defs>
        <polygon fill="url(#price-fill)" points={area} />
        <polyline fill="none" points={points} stroke="#63edc6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      </svg>
      <div className="stock-chart-axis"><span>{history[0]?.date}</span><span>{money(min)}</span><span>{money(max)}</span><span>{history.at(-1)?.date}</span></div>
    </div>
  );
}

export default async function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const [data, report, apiOverview, user] = await Promise.all([
    getCompanyData(ticker),
    getLatestReport<DailyReport>(),
    getStockApiOverview(ticker),
    getCurrentUserOrNull(),
  ]);
  const tickerCode = ticker.split(".")[0];
  const reportStock = (report?.stocks || []).find((stock) => {
    const candidate = String(stock.ticker || "").toUpperCase();
    return candidate === ticker || candidate.split(".")[0] === tickerCode;
  });
  const market: MarketOverview = apiOverview?.market || {
    ticker,
    available: Boolean(reportStock?.technical?.last_close),
    provider: reportStock?.technical?.last_close ? "Daily Worker" : undefined,
    as_of: reportStock?.technical?.last_date,
    price: reportStock?.technical?.last_close,
    support_zones: reportStock?.technical?.support_zones,
    resistance_zones: reportStock?.technical?.resistance_zones,
    history: [],
  };
  const snapshot = data.researchSnapshots[0] || apiOverview?.snapshots?.[0] || null;
  const decision = record(snapshot?.decision_summary);
  const watchZone = record(decision.watch_zone);
  const supports = (market.support_zones || reportStock?.technical?.support_zones || []).filter(Number.isFinite);
  const watchLower = number(watchZone.lower) ?? (supports.length ? Math.min(...supports) : null);
  const watchUpper = number(watchZone.upper) ?? (supports.length ? Math.max(...supports) : null);
  const facts = strings(decision.facts).length ? strings(decision.facts) : [reportStock?.key_takeaway || reportStock?.key_news || "ยังไม่มีข้อเท็จจริงใหม่จากรอบรายวัน"];
  const inferences = strings(decision.inferences).length ? strings(decision.inferences) : [reportStock?.possible_impact || reportStock?.impact].filter((item): item is string => Boolean(item));
  const risks = strings(decision.risks).length ? strings(decision.risks) : (reportStock?.bearish_points || []);
  const conditions = strings(watchZone.conditions).length ? strings(watchZone.conditions) : [
    "ตรวจว่าข่าวเปลี่ยนสมมติฐานธุรกิจจริงหรือไม่",
    "ตรวจราคาและ Volume อีกครั้งเมื่อเข้าช่วงนี้",
    "ทบทวนน้ำหนักรวมและความเสี่ยงของพอร์ตก่อนตัดสินใจ",
  ];
  const isHermesOwner = Boolean(user?.id && process.env.OWNER_SUPABASE_USER_ID && user.id === process.env.OWNER_SUPABASE_USER_ID);
  const change = market.change_pct;

  return (
    <main className="page-shell stock-detail-page">
      <ConfigNotice configured={data.configured} error={data.error} />
      <header className="stock-detail-hero">
        <div>
          <Link className="stock-back-link" href="/investing">← กลับไป My Portfolio</Link>
          <p className="eyebrow">Stock decision workspace</p>
          <h1>{data.company?.name || reportStock?.company || tickerCode}</h1>
          <p>{ticker} · {data.company?.sector || "ยังไม่มีข้อมูล Sector"}</p>
        </div>
        <div className="stock-quote">
          <strong>{money(market.price, market.currency)}</strong>
          {change !== undefined ? <span className={change >= 0 ? "positive-text" : "negative-text"}>{change >= 0 ? "+" : ""}{formatNumber(change, "%")}</span> : null}
          <small>ข้อมูล {market.provider || "ยังไม่พร้อม"} · {market.as_of || "ไม่มีวันที่"}</small>
        </div>
      </header>

      <section className="stock-market-grid">
        <article className="panel stock-chart-panel">
          <div className="portfolio-section-head"><div><h2>Price history</h2><p>ราคาปิดรายวันจาก EODHD — ไม่ใช่ราคาสำหรับส่งคำสั่งซื้อขาย</p></div><span>{market.history.length ? `${market.history.length} sessions` : "Waiting for data"}</span></div>
          <PriceChart history={market.history} />
        </article>
        <article className="panel stock-position-card">
          <p className="eyebrow">Position context</p>
          <dl>
            <div><dt>น้ำหนักในพอร์ต</dt><dd>{formatNumber(data.portfolioHolding?.portfolio_weight, "%")}</dd></div>
            <div><dt>มูลค่าปัจจุบัน</dt><dd>{money(data.portfolioHolding?.market_value)}</dd></div>
            <div><dt>Average cost</dt><dd>{money(data.portfolioHolding?.avg_cost)}</dd></div>
            <div><dt>Day range</dt><dd>{market.day_low ? `${money(market.day_low)} – ${money(market.day_high)}` : "—"}</dd></div>
          </dl>
          {!market.available && market.reason ? <p className="market-data-note">{market.reason}</p> : null}
        </article>
      </section>

      <section className="panel stock-decision-card">
        <div className="stock-decision-head">
          <div><p className="eyebrow">วันนี้ต้องรู้</p><h2>Decision Card</h2><p>ข้อเท็จจริง ผลกระทบ และจุดที่ควรกลับมาทบทวน</p></div>
          <StockResearchButton ticker={ticker} isHermesOwner={isHermesOwner} />
        </div>
        <div className="decision-grid">
          <article><span>01 · FACTS</span><h3>เกิดอะไรขึ้น</h3><ul>{facts.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article><span>02 · PORTFOLIO IMPACT</span><h3>กระทบพอร์ตอย่างไร</h3>{inferences.length ? <ul>{inferences.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p>ยังไม่มีหลักฐานพอสำหรับสรุปผลกระทบ</p>}</article>
          <article><span>03 · RISKS</span><h3>สิ่งที่ต้องจับตา</h3>{risks.length ? <ul>{risks.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p>{reportStock?.what_to_monitor || "ยังไม่มีความเสี่ยงใหม่ที่บันทึกไว้"}</p>}</article>
          <article className="watch-zone-card"><span>04 · WATCH ZONE</span><h3>{watchLower !== null && watchUpper !== null ? `${money(watchLower)} – ${money(watchUpper)}` : "ยังคำนวณไม่ได้"}</h3><p>{String(watchZone.rationale || "ช่วงแนวรับล่าสุดสำหรับกลับมาทบทวน ไม่ใช่สัญญาณซื้อ")}</p><ul>{conditions.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
        <footer className="decision-footer"><span>อัปเดต: {formatDate(snapshot?.as_of || report?.date || market.as_of)}</span><span>Research: {snapshot?.source || (reportStock ? "daily" : "not available")}</span></footer>
      </section>

      <section className="panel stock-news-section">
        <div className="portfolio-section-head"><div><h2>ข่าวและหลักฐาน</h2><p>อ่านต้นทางก่อนเปลี่ยน Thesis หรือการตัดสินใจ</p></div><span>{data.companyNews.length || reportStock?.articles?.length || 0} sources</span></div>
        <div className="stock-source-list">
          {data.companyNews.slice(0, 8).map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.source || "Unknown source"} · {formatDate(item.published_at)}</span></div><p>{item.summary || "ยังไม่มีสรุปจาก Agent"}</p>{item.url ? <a href={item.url} rel="noreferrer" target="_blank">เปิดแหล่งข่าว ↗</a> : null}</article>)}
          {!data.companyNews.length && reportStock?.articles?.slice(0, 8).map((item) => <article key={item.url || item.title}><div><strong>{item.title || "Untitled source"}</strong><span>{item.source || "Unknown source"} · {formatDate(item.published)}</span></div>{item.url ? <a href={item.url} rel="noreferrer" target="_blank">เปิดแหล่งข่าว ↗</a> : null}</article>)}
          {!data.companyNews.length && !reportStock?.articles?.length ? <div className="stock-chart-empty"><strong>ยังไม่มีข่าวที่ตรงกับหุ้นนี้</strong><span>ระบบตรวจล่าสุด {formatDate(report?.generated_at || report?.date)} และยังไม่พบแหล่งข่าวที่บันทึกได้</span></div> : null}
        </div>
      </section>

      <section className="panel research-history">
        <div className="portfolio-section-head"><div><h2>Research history</h2><p>ผลรายวันและ Deep Dive แยกจากประวัติสนทนา Hermes</p></div><span>{data.researchSnapshots.length} snapshots</span></div>
        {data.researchSnapshots.length ? <div className="research-history-list">{data.researchSnapshots.slice(0, 8).map((item) => <article key={item.id}><strong>{item.source.toUpperCase()} · {formatDate(item.as_of)}</strong><p>{String(record(item.decision_summary).summary || "บันทึกผลวิเคราะห์แล้ว")}</p></article>)}</div> : <p className="empty-state">ยังไม่มี Research Snapshot — กดวิเคราะห์หรือรอ Daily Worker รอบถัดไป</p>}
      </section>

      <details className="panel stock-notes-panel">
        <summary><span><strong>บันทึกการลงทุนของฉัน</strong><small>Thesis และ Watchlist ที่แก้ไขเอง</small></span><span>เปิดแก้ไข</span></summary>
        <div className="stock-notes-grid">
          <section><h2>Investment thesis</h2><ThesisForm thesis={data.thesis} ticker={ticker} /></section>
          <section><h2>Watchlist</h2><WatchlistForm item={data.watchlistItem} ticker={ticker} />{data.watchlistItem ? <DeleteWatchlistButton id={data.watchlistItem.id} ticker={ticker} /> : null}</section>
        </div>
      </details>
    </main>
  );
}

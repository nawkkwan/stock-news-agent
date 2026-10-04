import Link from "next/link";
import { getCompanyData, formatDate, formatNumber } from "../../../../lib/investment-data";
import { getLatestReport } from "../../../../lib/latest-report";
import { getStockApiOverview, type MarketBar, type MarketOverview, type ReviewZone } from "../../../../lib/stock-research";
import type { StockResearchSnapshot } from "../../../../lib/investment-types";
import { ConfigNotice, WatchlistForm, type DailyReportStock } from "../../components";
import { ThesisForm } from "../../thesis-form";
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

type ResearchSource = { title: string; url: string };

function researchSources(value: unknown): ResearchSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    const url = String(source.url || "").trim();
    if (!url) return [];
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return [];
    } catch {
      return [];
    }
    return [{ title: String(source.title || source.source || "เปิดแหล่งข้อมูล"), url }];
  });
}

function ResearchHistoryCard({ item }: { item: StockResearchSnapshot }) {
  const decision = record(item.decision_summary);
  const evidenceGroups = [
    ["ข้อเท็จจริง", strings(decision.facts)],
    ["ข้อสรุปของ Agent", strings(decision.inferences)],
    ["ความเสี่ยง", strings(decision.risks)],
  ] as const;
  const sources = researchSources(decision.sources);
  return (
    <details className="research-history-item">
      <summary>
        <div>
          <strong>{item.source.toUpperCase()} · {formatDate(item.as_of)}</strong>
          <p>{String(decision.summary || "บันทึกผลวิเคราะห์แล้ว")}</p>
        </div>
        <span>{sources.length || item.news_count} แหล่งข้อมูล</span>
      </summary>
      <div className="research-history-body">
        {evidenceGroups.map(([label, values]) => values.length ? (
          <section key={label}><strong>{label}</strong><ul>{values.map((value) => <li key={value}>{value}</li>)}</ul></section>
        ) : null)}
        {sources.length ? (
          <section className="research-history-sources">
            <strong>ข่าวและแหล่งอ้างอิงที่ Agent พบ</strong>
            <div>{sources.map((source) => <a href={source.url} key={source.url} rel="noreferrer" target="_blank">{source.title} ↗</a>)}</div>
          </section>
        ) : <p className="research-history-no-sources">Snapshot นี้ไม่มี URL แหล่งข่าวแนบมา</p>}
      </div>
    </details>
  );
}

function money(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function reviewZones(value: unknown): ReviewZone[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ReviewZone => {
    if (!item || typeof item !== "object") return false;
    const zone = item as Partial<ReviewZone>;
    return [zone.lower, zone.upper, zone.center, zone.touches, zone.volume_ratio, zone.score]
      .every((field) => typeof field === "number" && Number.isFinite(field));
  }).slice(0, 3);
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
  const [data, report, apiOverview] = await Promise.all([
    getCompanyData(ticker),
    getLatestReport<DailyReport>(),
    getStockApiOverview(ticker),
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
    review_zones: reportStock?.technical?.review_zones,
    resistance_zones: reportStock?.technical?.resistance_zones,
    history: [],
  };
  const snapshot = data.researchSnapshots[0] || apiOverview?.snapshots?.[0] || null;
  const hermesEvidence = record(data.hermesThesis?.evidence_summary);
  const hermesSources = researchSources(hermesEvidence.sources);
  const decision = record(snapshot?.decision_summary);
  const watchZone = record(decision.watch_zone);
  const marketZones = reviewZones(market.review_zones);
  const snapshotZones = reviewZones(watchZone.zones);
  const evidenceZones = marketZones.length ? marketZones : snapshotZones.length ? snapshotZones : reviewZones(reportStock?.technical?.review_zones);
  const facts = strings(decision.facts).length ? strings(decision.facts) : [reportStock?.key_takeaway || reportStock?.key_news || "ยังไม่มีข้อเท็จจริงใหม่จากรอบรายวัน"];
  const inferences = strings(decision.inferences).length ? strings(decision.inferences) : [reportStock?.possible_impact || reportStock?.impact].filter((item): item is string => Boolean(item));
  const risks = strings(decision.risks).length ? strings(decision.risks) : (reportStock?.bearish_points || []);
  const conditions = strings(watchZone.conditions).length ? strings(watchZone.conditions) : [
    "ตรวจว่าข่าวเปลี่ยนสมมติฐานธุรกิจจริงหรือไม่",
    "ตรวจราคาและ Volume อีกครั้งเมื่อเข้าช่วงนี้",
    "ทบทวนน้ำหนักรวมและความเสี่ยงของพอร์ตก่อนตัดสินใจ",
  ];
  const thesisReviewState = !data.thesis && !data.hermesThesis
    ? { label: "ยังไม่มี Thesis", tone: "empty" }
    : data.thesis && data.hermesThesis
      ? { label: "มี Thesis ทั้ง 2 ฝั่ง", tone: "reviewed" }
      : data.hermesThesis
        ? { label: "มีมุมมองจาก Hermes", tone: "reviewed" }
        : { label: "มี Thesis ของคุณ", tone: "pending" };
  const thesisSections: Array<[string, string | null]> = data.thesis ? [
    ["ภาพรวมธุรกิจ", data.thesis.business_overview],
    ["เหตุผลที่สนใจ", data.thesis.growth_drivers],
    ["Bull case", data.thesis.bull_case],
    ["Bear case", data.thesis.bear_case],
    ["Moat", data.thesis.moat],
    ["ความเสี่ยงสำคัญ", data.thesis.key_risks],
    ["เงื่อนไขที่ทำให้ Thesis ผิด", data.thesis.sell_conditions],
  ] : [];
  const hermesThesisSections: Array<[string, string | null]> = data.hermesThesis ? [
    ["ภาพรวมธุรกิจ", data.hermesThesis.business_overview],
    ["Growth drivers", data.hermesThesis.growth_drivers],
    ["Bull case", data.hermesThesis.bull_case],
    ["Bear case", data.hermesThesis.bear_case],
    ["Moat", data.hermesThesis.moat],
    ["ความเสี่ยงสำคัญ", data.hermesThesis.key_risks],
    ["เงื่อนไขที่ทำให้ Thesis ผิด", data.hermesThesis.sell_conditions],
  ] : [];
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
          <StockResearchButton ticker={ticker} />
        </div>
        <div className="decision-grid">
          <article><span>01 · FACTS</span><h3>เกิดอะไรขึ้น</h3><ul>{facts.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article><span>02 · PORTFOLIO IMPACT</span><h3>กระทบพอร์ตอย่างไร</h3>{inferences.length ? <ul>{inferences.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p>ยังไม่มีหลักฐานพอสำหรับสรุปผลกระทบ</p>}</article>
          <article><span>03 · RISKS</span><h3>สิ่งที่ต้องจับตา</h3>{risks.length ? <ul>{risks.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p>{reportStock?.what_to_monitor || "ยังไม่มีความเสี่ยงใหม่ที่บันทึกไว้"}</p>}</article>
          <article className="watch-zone-card">
            <span>04 · REVIEW LEVELS</span>
            <h3>{evidenceZones.length ? `พบ ${evidenceZones.length} โซนที่มีหลักฐาน` : "หลักฐานยังไม่พอสร้างโซน"}</h3>
            <div className="review-level-list">
              {evidenceZones.map((zone, index) => {
                const confidence = zone.confidence === "high" ? "หลักฐานสูง" : zone.confidence === "medium" ? "หลักฐานกลาง" : "หลักฐานต่ำ";
                return (
                  <div key={`${zone.center}-${zone.last_touch_date}`}>
                    <span>โซน {index + 1} · {confidence} · {formatNumber(zone.score)} คะแนน</span>
                    <strong>{money(zone.lower, market.currency)} – {money(zone.upper, market.currency)}</strong>
                    <small>{formatNumber(zone.distance_pct, "%")} จากราคาปัจจุบัน · แตะ {zone.touches} รอบ · Volume {formatNumber(zone.volume_ratio)}x</small>
                    <small>แตะล่าสุด {formatDate(zone.last_touch_date)}</small>
                  </div>
                );
              })}
            </div>
            <p>{String(watchZone.rationale || "แสดงเฉพาะ Swing Low ที่ราคาเคยตอบสนองอย่างน้อย 2 รอบ คะแนนรวม Touch, Volume, Recency และ Time span ไม่ใช่สัญญาณซื้อ")}</p>
            <ul>{conditions.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
        <footer className="decision-footer"><span>อัปเดต: {formatDate(snapshot?.as_of || report?.date || market.as_of)}</span><span>Research: {snapshot?.source || (reportStock ? "daily" : "not available")}</span></footer>
      </section>

      <section className="panel thesis-workspace">
        <div className="thesis-workspace-head">
          <div>
            <p className="eyebrow">Owner thesis · Agent thesis</p>
            <h2>Investment Thesis สองมุมมอง</h2>
            <p>ฝั่งซ้ายคือสิ่งที่คุณพิมพ์เอง ฝั่งขวาคือ Thesis จาก AI Agent และงานค้นคว้า โดยไม่เขียนทับกัน</p>
          </div>
          <span className={`thesis-review-badge ${thesisReviewState.tone}`}>{thesisReviewState.label}</span>
        </div>

        <div className="thesis-workspace-grid">
          <div className="thesis-owner-column">
            {data.thesis ? (
              <>
                <div className="thesis-provenance"><span>K</span><div><strong>Thesis ของฉัน</strong><small>แก้ไขล่าสุด {formatDate(data.thesis.updated_at)}</small></div></div>
                <h3 className="thesis-note-title">{data.thesis.title || `${tickerCode} — Thesis ของฉัน`}</h3>
                <div className="thesis-reading-grid">
                  {thesisSections.map(([label, value]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <p>{value || "ยังไม่ได้บันทึก"}</p>
                    </article>
                  ))}
                  <article>
                    <span>ความมั่นใจของคุณ</span>
                    <p>{data.thesis.confidence_score === null ? "ยังไม่ได้ประเมิน" : `${formatNumber(data.thesis.confidence_score)} / 100`}</p>
                  </article>
                </div>
              </>
            ) : (
              <div className="thesis-empty-state">
                <strong>ยังไม่มี Thesis สำหรับ {tickerCode}</strong>
                <p>เริ่มจากเหตุผลที่สนใจ สมมติฐานหลัก และสิ่งที่จะทำให้มุมมองนี้ผิด</p>
              </div>
            )}

            <details className="thesis-editor">
              <summary>{data.thesis ? "แก้ไข Thesis ต้นฉบับ" : "เริ่มเขียน Thesis"}</summary>
              <ThesisForm thesis={data.thesis} ticker={ticker} />
            </details>
          </div>

          <aside className="thesis-review-column">
            <div className="thesis-review-card">
              <p className="eyebrow">Agent thesis</p>
              <h3>{data.hermesThesis ? "มุมมองของ AI Agent" : data.thesis ? "พร้อมสร้าง Thesis จากหลักฐาน" : "ยังไม่มีมุมมองจาก Agent"}</h3>
              {data.hermesThesis ? (
                <>
                  <div className="thesis-provenance hermes"><span>AI</span><div><strong>เขียนโดย AI Agent</strong><small>อัปเดตล่าสุด {formatDate(data.hermesThesis.updated_at)} · {data.hermesThesis.source_kind?.startsWith("gemini") ? "สร้างด้วย Gemini" : "ข้อมูลเดิมจาก Hermes"}</small></div></div>
                  <h4 className="thesis-note-title">{data.hermesThesis.title || `${tickerCode} — มุมมอง Agent`}</h4>
                  <div className="hermes-thesis-reading">
                    {hermesThesisSections.map(([label, value]) => value ? <article key={label}><span>{label}</span><p>{value}</p></article> : null)}
                    <article><span>ความมั่นใจของ Agent</span><p>{data.hermesThesis.confidence_score === null ? "ยังไม่มีหลักฐานพอประเมิน" : `${formatNumber(data.hermesThesis.confidence_score)} / 100`}</p></article>
                  </div>
                  {hermesSources.length ? <div className="hermes-thesis-sources"><strong>หลักฐานล่าสุด</strong>{hermesSources.slice(0, 5).map((source) => <a href={source.url} key={source.url} rel="noreferrer" target="_blank">{source.title} ↗</a>)}</div> : null}
                </>
              ) : (
                <p>{data.thesis ? "Gemini จะหาหลักฐานที่สนับสนุนและขัดแย้ง แล้วบันทึก Agent thesis แยกจากต้นฉบับของคุณ" : "คุณเริ่มจาก Thesis ของตัวเองก่อน แล้วค่อยให้ Gemini ตรวจหลักฐานได้"}</p>
              )}
              {data.thesis ? (
                <StockResearchButton
                  ticker={ticker}
                  label={data.hermesThesis ? "อัปเดต Agent Thesis ด้วย Gemini" : "ให้ Gemini ตรวจ Thesis"}
                  question={`ตรวจสอบ Thesis ที่ฉันบันทึกสำหรับ ${ticker} เทียบกับหลักฐานล่าสุด แล้วสร้าง hermes_thesis เป็นมุมมองของ AI Agent แยกต่างหาก หาหลักฐานที่สนับสนุนและขัดแย้ง ชี้สมมติฐานที่ยังไม่มีข้อมูลรองรับ ความเสี่ยงที่ตกหล่น และสิ่งที่ควรติดตามต่อ โดยห้ามแก้ไข Thesis ต้นฉบับ`}
                />
              ) : null}
            </div>

            <div className="thesis-watch-card">
              <div><p className="eyebrow">My watchlist</p><h3>{data.watchlistItem ? data.watchlistItem.ticker : "ยังไม่ได้ติดตาม"}</h3></div>
              {data.watchlistItem ? <><span>{data.watchlistItem.status.replaceAll("_", " ")}</span><p>{data.watchlistItem.reason || "ยังไม่ได้บันทึกเหตุผล"}</p></> : <p>เพิ่มหุ้นนี้เพื่อให้ Nakin และ Hermes ใช้เหตุผลเดียวกับที่แสดงบนเว็บ</p>}
              <details className="watchlist-editor">
                <summary>{data.watchlistItem ? "แก้ไข Watchlist" : "เพิ่มเข้า Watchlist"}</summary>
                <WatchlistForm item={data.watchlistItem} ticker={ticker} />
                {data.watchlistItem ? <DeleteWatchlistButton id={data.watchlistItem.id} ticker={ticker} /> : null}
              </details>
            </div>
          </aside>
        </div>
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
        <div className="portfolio-section-head"><div><h2>Research history</h2><p>ทุก Deep Dive ของ Hermes/PixelAgent เก็บทั้งบทสรุป ข้อเท็จจริง ความเสี่ยง และลิงก์ข่าวที่ค้นพบ</p></div><span>{data.researchSnapshots.length} snapshots</span></div>
        {data.researchSnapshots.length ? <div className="research-history-list">{data.researchSnapshots.slice(0, 12).map((item) => <ResearchHistoryCard item={item} key={item.id} />)}</div> : <p className="empty-state">ยังไม่มี Research Snapshot — กดวิเคราะห์หรือใช้ /research ผ่าน PixelAgent</p>}
      </section>

    </main>
  );
}

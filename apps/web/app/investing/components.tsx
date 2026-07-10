import Link from "next/link";
import {
  journalActions,
  newsImpacts,
  newsTimeframes,
  transactionTypes,
  watchlistStatuses,
  type Company,
  type Holding,
  type InvestmentJournalEntry,
  type NewsItem,
  type Portfolio,
  type PortfolioSummary,
  type ThesisNote,
  type PortfolioHolding,
  type PortfolioTransaction,
  type WatchlistItem,
} from "../../lib/investment-types";
import { formatDate, formatNumber } from "../../lib/investment-data";
import {
  upsertCompany,
  addTransaction,
  upsertInvestmentJournalEntry,
  upsertHolding,
  upsertNewsItem,
  upsertPortfolio,
  upsertThesis,
  upsertWatchlistItem,
} from "./actions";
export { ImportDailyPortfolioButton } from "./import-daily-portfolio-button";

export function ConfigNotice({ configured, error }: { configured: boolean; error?: string }) {
  if (!configured) {
    return (
      <section className="notice">
        <strong>Supabase is not configured.</strong>
        <span> Add server environment variables before using the Investment OS forms.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="notice danger">
        <strong>Database error.</strong>
        <span> {error}</span>
      </section>
    );
  }

  return null;
}

export function EmptyState({ label }: { label: string }) {
  return <p className="empty-state">{label}</p>;
}

export function PortfolioForm({ portfolio }: { portfolio?: Portfolio | null }) {
  return (
    <form action={upsertPortfolio} className="form-grid compact-form">
      <input type="hidden" name="id" value={portfolio?.id || ""} />
      <Field label="Portfolio name" name="name" defaultValue={portfolio?.name || ""} required />
      <Field label="Target allocation %" name="target_weight" type="number" defaultValue={portfolio?.target_weight} />
      <Field label="Base currency" name="base_currency" defaultValue={portfolio?.base_currency || "USD"} required />
      <TextArea label="Description" name="description" defaultValue={portfolio?.description} />
      <button className="button" type="submit">
        Save portfolio
      </button>
    </form>
  );
}

export function PortfolioSelector({
  portfolios,
  selectedPortfolio,
  pathname = "/investing",
}: {
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  pathname?: string;
}) {
  if (portfolios.length === 0) {
    return <EmptyState label="No portfolios yet. Save a portfolio to start tracking separate accounts." />;
  }

  return (
    <div className="portfolio-tabs" aria-label="Portfolios">
      {portfolios.map((portfolio) => (
        <Link
          className={portfolio.id === selectedPortfolio?.id ? "portfolio-tab active" : "portfolio-tab"}
          href={`${pathname}?portfolio=${portfolio.id}`}
          key={portfolio.id}
        >
          {portfolio.name}
        </Link>
      ))}
    </div>
  );
}

export function PortfolioSummaryCards({ summaries }: { summaries: PortfolioSummary[] }) {
  if (summaries.length === 0) {
    return <EmptyState label="Portfolio summaries will appear after the first portfolio is created." />;
  }

  return (
    <div className="portfolio-card-grid">
      {summaries.map((summary) => (
        <article className="portfolio-card" key={summary.portfolio.id}>
          <div className="item-card-head">
            <div>
              <strong>{summary.portfolio.name}</strong>
              <span>{summary.portfolio.description || summary.portfolio.base_currency}</span>
            </div>
            <span>{formatNumber(summary.target_weight, "%")}</span>
          </div>
          <dl className="mini-grid">
            <div>
              <dt>Value</dt>
              <dd>{formatNumber(summary.portfolioValue)}</dd>
            </div>
            <div>
              <dt>Open holdings</dt>
              <dd>{summary.holdingsCount}</dd>
            </div>
            <div>
              <dt>Unrealized P/L</dt>
              <dd className={summary.unrealizedGain >= 0 ? "positive-text" : "negative-text"}>
                {formatNumber(summary.unrealizedGain)}
              </dd>
            </div>
            <div>
              <dt>Cash</dt>
              <dd>{summary.hasCashLedger ? formatNumber(summary.cashBalance) : "Not tracked"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} step={type === "number" ? "any" : undefined} defaultValue={defaultValue ?? ""} required={required} />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <label className="span-2">
      <span>{label}</span>
      <textarea name={name} rows={4} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  name,
  values,
  defaultValue,
}: {
  label: string;
  name: string;
  values: T[];
  defaultValue: T;
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue}>
        {values.map((value) => (
          <option key={value} value={value}>
            {value.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CompanyForm({ company, ticker }: { company?: Company | null; ticker?: string }) {
  return (
    <form action={upsertCompany} className="form-grid">
      <input type="hidden" name="id" value={company?.id || ""} />
      <Field label="Ticker" name="ticker" defaultValue={company?.ticker || ticker || ""} required />
      <Field label="Name" name="name" defaultValue={company?.name} />
      <Field label="Sector" name="sector" defaultValue={company?.sector} />
      <Field label="Industry" name="industry" defaultValue={company?.industry} />
      <TextArea label="Description" name="description" defaultValue={company?.description} />
      <button className="button" type="submit">
        Save company
      </button>
    </form>
  );
}

export function HoldingForm({
  holding,
  ticker,
  portfolioId,
}: {
  holding?: Holding | null;
  ticker?: string;
  portfolioId?: string | null;
}) {
  return (
    <form action={upsertHolding} className="form-grid">
      <input type="hidden" name="id" value={holding?.id || ""} />
      <input type="hidden" name="portfolio_id" value={portfolioId || holding?.portfolio_id || ""} />
      <Field label="Ticker" name="ticker" defaultValue={holding?.ticker || ticker || ""} required />
      <Field label="Shares" name="shares" type="number" defaultValue={holding?.shares} />
      <Field label="Avg cost" name="avg_cost" type="number" defaultValue={holding?.avg_cost} />
      <Field label="Latest price" name="latest_price" type="number" defaultValue={holding?.latest_price} />
      <Field label="Fallback market value" name="current_value" type="number" defaultValue={holding?.current_value} />
      <Field label="Target weight %" name="target_weight" type="number" defaultValue={holding?.target_weight} />
      <TextArea label="Notes" name="notes" defaultValue={holding?.notes} />
      <button className="button" type="submit">
        Save holding settings
      </button>
    </form>
  );
}

export function TransactionForm({ ticker, portfolioId }: { ticker?: string; portfolioId?: string | null }) {
  return (
    <form action={addTransaction} className="form-grid">
      <input type="hidden" name="portfolio_id" value={portfolioId || ""} />
      <SelectField label="Action type" name="transaction_type" values={transactionTypes} defaultValue="buy" />
      <Field label="Ticker" name="ticker" defaultValue={ticker || ""} />
      <Field label="Quantity" name="quantity" type="number" />
      <Field label="Price on transaction date / cash amount" name="price_per_share" type="number" required />
      <Field label="Fee" name="fee" type="number" defaultValue={0} />
      <Field label="Currency" name="currency" defaultValue="USD" required />
      <Field label="Date" name="transaction_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <TextArea label="Reason" name="reason" />
      <TextArea label="Notes" name="notes" />
      <button className="button" type="submit">
        Add activity
      </button>
    </form>
  );
}

export function WatchlistForm({ item, ticker }: { item?: WatchlistItem | null; ticker?: string }) {
  return (
    <form action={upsertWatchlistItem} className="form-grid compact-form">
      <input type="hidden" name="id" value={item?.id || ""} />
      <Field label="Ticker" name="ticker" defaultValue={item?.ticker || ticker || ""} required />
      <SelectField label="Status" name="status" values={watchlistStatuses} defaultValue={item?.status || "not_started"} />
      <TextArea label="Reason" name="reason" defaultValue={item?.reason} />
      <button className="button" type="submit">
        Save watchlist
      </button>
    </form>
  );
}

export function ThesisForm({ thesis, ticker }: { thesis?: ThesisNote | null; ticker: string }) {
  return (
    <form action={upsertThesis} className="form-grid thesis-form">
      <input type="hidden" name="id" value={thesis?.id || ""} />
      <input type="hidden" name="ticker" value={ticker} />
      <TextArea label="Business Overview" name="business_overview" defaultValue={thesis?.business_overview} />
      <TextArea label="Why I'm Interested" name="growth_drivers" defaultValue={thesis?.growth_drivers} />
      <TextArea label="Bull Case" name="bull_case" defaultValue={thesis?.bull_case} />
      <TextArea label="Bear Case" name="bear_case" defaultValue={thesis?.bear_case} />
      <TextArea label="Moat" name="moat" defaultValue={thesis?.moat} />
      <TextArea label="Key Risks" name="key_risks" defaultValue={thesis?.key_risks} />
      <TextArea label="Sell Conditions" name="sell_conditions" defaultValue={thesis?.sell_conditions} />
      <Field label="My Confidence" name="confidence_score" type="number" defaultValue={thesis?.confidence_score} />
      <button className="button" type="submit">
        Save thesis
      </button>
    </form>
  );
}

export function InvestmentJournalForm({ entry, ticker }: { entry?: InvestmentJournalEntry | null; ticker?: string }) {
  return (
    <form action={upsertInvestmentJournalEntry} className="form-grid compact-form">
      <input type="hidden" name="id" value={entry?.id || ""} />
      <Field label="Date" name="date" type="date" defaultValue={entry?.date || new Date().toISOString().slice(0, 10)} required />
      <Field label="Ticker" name="ticker" defaultValue={entry?.ticker || ticker || ""} />
      <SelectField label="Action" name="action" values={journalActions} defaultValue={entry?.action || "research"} />
      <Field label="Amount" name="amount" type="number" defaultValue={entry?.amount} />
      <Field label="Confidence" name="confidence" type="number" defaultValue={entry?.confidence} />
      <TextArea label="Reason" name="reason" defaultValue={entry?.reason} />
      <TextArea label="Risk" name="risk" defaultValue={entry?.risk} />
      <TextArea
        label="What would make this wrong"
        name="what_would_make_this_wrong"
        defaultValue={entry?.what_would_make_this_wrong}
      />
      <button className="button" type="submit">
        Save note
      </button>
    </form>
  );
}

export function NewsForm({ item, ticker }: { item?: NewsItem | null; ticker?: string }) {
  return (
    <form action={upsertNewsItem} className="form-grid compact-form">
      <input type="hidden" name="id" value={item?.id || ""} />
      <Field label="Ticker" name="ticker" defaultValue={item?.ticker || ticker || ""} required />
      <Field label="Title" name="title" defaultValue={item?.title} required />
      <Field label="URL" name="url" type="url" defaultValue={item?.url} />
      <Field label="Source" name="source" defaultValue={item?.source} />
      <Field label="Published at" name="published_at" type="datetime-local" defaultValue={item?.published_at?.slice(0, 16)} />
      <SelectField label="Impact" name="impact" values={newsImpacts} defaultValue={item?.impact || "neutral"} />
      <SelectField label="Timeframe" name="timeframe" values={newsTimeframes} defaultValue={item?.timeframe || "short_term"} />
      <label className="checkbox-label">
        <input name="thesis_changed" type="checkbox" defaultChecked={Boolean(item?.thesis_changed)} />
        <span>Thesis changed</span>
      </label>
      <TextArea label="Summary" name="summary" defaultValue={item?.summary} />
      <TextArea label="My note" name="my_note" defaultValue={item?.my_note} />
      <button className="button" type="submit">
        Save news impact
      </button>
    </form>
  );
}

export function HoldingsTable({ holdings }: { holdings: PortfolioHolding[] }) {
  if (holdings.length === 0) {
    return <EmptyState label="No holdings yet." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Shares</th>
            <th>Avg cost</th>
            <th>Latest price</th>
            <th>Market value</th>
            <th>P/L</th>
            <th>Weight</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.id}>
              <td>
                <Link href={`/investing/companies/${holding.ticker}`}>{holding.ticker}</Link>
              </td>
              <td>{formatNumber(holding.shares)}</td>
              <td>{formatNumber(holding.avg_cost)}</td>
              <td>{formatNumber(holding.latest_price)}</td>
              <td>{formatNumber(holding.market_value)}</td>
              <td className={holding.unrealized_gain >= 0 ? "positive-text" : "negative-text"}>
                {formatNumber(holding.unrealized_gain)} ({formatNumber(holding.unrealized_gain_pct, "%")})
              </td>
              <td>{formatNumber(holding.portfolio_weight, "%")}</td>
              <td>{formatNumber(holding.target_weight, "%")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const allocationColors = ["#28d7a3", "#6ee7f9", "#a7f3d0", "#facc15", "#f59e0b", "#f472b6", "#818cf8", "#94a3b8"];

type AllocationSlice = {
  label: string;
  value: number;
  weight: number;
  color: string;
};

export type DashboardHolding = {
  id: string;
  ticker: string;
  company?: string | null;
  shares?: number | null;
  avg_cost?: number | null;
  market_value: number;
  portfolio_weight: number;
  unrealized_gain?: number | null;
  unrealized_gain_pct?: number | null;
};

export function PortfolioSnapshot({
  portfolioName,
  portfolioValue,
  unrealizedGain,
  cashBalance,
  hasCashLedger,
  holdingsCount,
}: {
  portfolioName?: string | null;
  portfolioValue: number;
  unrealizedGain: number;
  cashBalance: number;
  hasCashLedger: boolean;
  holdingsCount: number;
}) {
  const gainClassName = unrealizedGain >= 0 ? "positive-text" : "negative-text";

  return (
    <section className="dashboard-hero">
      <div>
        <p className="eyebrow">My Portfolio</p>
        <h2>{portfolioName || "Daily notes portfolio"}</h2>
        <p className="muted">Simple view first: what you hold, how much it weighs, and what news matters today.</p>
      </div>
      <div className="metric-grid">
        <div className="metric-card primary">
          <span>Total value</span>
          <strong>{formatNumber(portfolioValue)}</strong>
        </div>
        <div className="metric-card">
          <span>Unrealized P/L</span>
          <strong className={gainClassName}>{formatNumber(unrealizedGain)}</strong>
        </div>
        <div className="metric-card">
          <span>Cash balance</span>
          <strong>{hasCashLedger ? formatNumber(cashBalance) : "Not tracked"}</strong>
        </div>
        <div className="metric-card">
          <span>Open holdings</span>
          <strong>{holdingsCount}</strong>
        </div>
      </div>
    </section>
  );
}

function buildAllocationSlices({
  holdings,
  cashBalance,
  hasCashLedger,
}: {
  holdings: DashboardHolding[];
  cashBalance: number;
  hasCashLedger: boolean;
}) {
  const holdingSlices = holdings
    .filter((holding) => holding.market_value > 0)
    .map((holding, index) => ({
      label: holding.ticker,
      value: holding.market_value,
      color: allocationColors[index % allocationColors.length],
    }));
  const slices = hasCashLedger && cashBalance > 0
    ? [
        ...holdingSlices,
        {
          label: "Cash",
          value: cashBalance,
          color: "#64748b",
        },
      ]
    : holdingSlices;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return slices.map((slice) => ({
    ...slice,
    weight: total > 0 ? (slice.value / total) * 100 : 0,
  }));
}

export function PortfolioAllocation({
  holdings,
  cashBalance,
  hasCashLedger,
}: {
  holdings: DashboardHolding[];
  cashBalance: number;
  hasCashLedger: boolean;
}) {
  const slices = buildAllocationSlices({ holdings, cashBalance, hasCashLedger });
  const totalValue = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (slices.length === 0) {
    return (
      <section className="panel dashboard-panel">
        <div className="section-head">
          <h2>My Portfolio Allocation</h2>
        </div>
        <EmptyState label="Add a buy transaction and latest prices to populate allocation." />
      </section>
    );
  }

  return (
    <section className="panel dashboard-panel">
      <div className="section-head">
        <div>
          <h2>Allocation</h2>
          <p className="muted">Donut chart uses the same weights as the asset list.</p>
        </div>
        <strong>{formatNumber(totalValue)}</strong>
      </div>
      <div className="allocation-layout">
        <DonutChart slices={slices} totalValue={totalValue} />
        <div className="allocation-list">
          {slices.map((slice) => (
            <div className="allocation-row" key={slice.label}>
              <span className="allocation-swatch" style={{ background: slice.color }} />
              <div>
                <strong>{slice.label}</strong>
                <span>{formatNumber(slice.value)}</span>
              </div>
              <b>{formatNumber(slice.weight, "%")}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DonutChart({ slices, totalValue }: { slices: AllocationSlice[]; totalValue: number }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap" aria-label="Portfolio allocation chart">
      <svg className="donut-chart" viewBox="0 0 180 180" role="img">
        <circle className="donut-track" cx="90" cy="90" r={radius} />
        {slices.map((slice) => {
          const length = (slice.weight / 100) * circumference;
          const strokeDasharray = `${length} ${circumference - length}`;
          const strokeDashoffset = -offset;
          offset += length;
          return (
            <circle
              className="donut-slice"
              cx="90"
              cy="90"
              key={slice.label}
              r={radius}
              stroke={slice.color}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <span>Total</span>
        <strong>{formatNumber(totalValue)}</strong>
      </div>
    </div>
  );
}

export function DashboardHoldingsTable({ holdings }: { holdings: DashboardHolding[] }) {
  if (holdings.length === 0) {
    return <EmptyState label="No assets in this portfolio yet. Add an asset, record a buy transaction, or import the Daily News snapshot." />;
  }

  return (
    <div className="asset-list">
      <div className="asset-list-head">
        <span>{holdings.length} assets</span>
        <span>Holding value</span>
        <span>Weight / P&L</span>
      </div>
      {holdings.map((holding) => {
        const hasGain = holding.unrealized_gain !== null && holding.unrealized_gain !== undefined;
        const gainClass = (holding.unrealized_gain || 0) >= 0 ? "positive-text" : "negative-text";
        return (
          <article className="asset-row" key={holding.id}>
            <div className="asset-main">
              <div className="asset-logo">{holding.ticker.slice(0, 1)}</div>
              <div>
                <Link href={`/investing/companies/${holding.ticker}`}>{holding.ticker}</Link>
                <span>{holding.company || "Portfolio holding"}</span>
              </div>
            </div>
            <div className="asset-value">
              <strong>{formatNumber(holding.market_value)}</strong>
              {holding.shares ? <span>{formatNumber(holding.shares)} shares</span> : <span>Value-only holding</span>}
            </div>
            <div className="asset-profit">
              <strong>{formatNumber(holding.portfolio_weight, "%")}</strong>
              {hasGain ? (
                <span className={gainClass}>
                  {formatNumber(holding.unrealized_gain)} ({formatNumber(holding.unrealized_gain_pct, "%")})
                </span>
              ) : (
                <span className="muted">P/L later</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export type DailyReportStock = {
  ticker?: string;
  company?: string;
  key_takeaway?: string;
  key_news?: string;
  possible_impact?: string;
  impact?: string;
  confidence?: string;
  time_horizon?: string;
  timeframe?: string;
  holding_value_thb?: number;
  portfolio_weight_pct?: number;
  unrealized_gain_thb?: number;
  unrealized_gain_pct?: number;
  technical_summary?: string;
  technical?: {
    last_close?: number;
    last_date?: string;
    rsi14?: number;
    macd?: number;
    macd_signal?: number;
    trend?: string;
    support_zones?: number[];
    resistance_zones?: number[];
    technical_note?: string;
  };
};

function formatTechnicalValue(value?: number | null) {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

function formatLevels(levels?: number[]) {
  return levels && levels.length > 0 ? levels.map((level) => formatNumber(level)).join(" / ") : "-";
}

export function NewsByHolding({
  reportDate,
  stocks,
}: {
  reportDate?: string | null;
  stocks: DailyReportStock[];
}) {
  if (stocks.length === 0) {
    return <EmptyState label="No latest report items matched the selected holdings." />;
  }

  return (
    <div className="news-card-grid compact-news">
      {stocks.map((stock) => (
        <article className="news-impact-card" key={stock.ticker}>
          <div className="item-card-head">
            <div>
              <strong>{stock.ticker || "-"}</strong>
              <span>{stock.company || "Portfolio holding"}</span>
            </div>
            <time>{reportDate || "Latest"}</time>
          </div>
          <p>{stock.key_takeaway || stock.key_news || "No takeaway included in the latest report."}</p>
          <p className="muted">{stock.possible_impact || stock.impact || "No impact note included."}</p>
          {stock.technical ? (
            <div className="technical-snapshot" aria-label={`${stock.ticker || "Holding"} technical snapshot`}>
              <div className="technical-title">
                <strong>Technical snapshot</strong>
                <span>{stock.technical.trend || "Trend unavailable"}</span>
              </div>
              <dl className="technical-grid">
                <div>
                  <dt>Last close</dt>
                  <dd>{formatTechnicalValue(stock.technical.last_close)}</dd>
                </div>
                <div>
                  <dt>RSI (14)</dt>
                  <dd>{formatTechnicalValue(stock.technical.rsi14)}</dd>
                </div>
                <div>
                  <dt>MACD / Signal</dt>
                  <dd>{formatTechnicalValue(stock.technical.macd)} / {formatTechnicalValue(stock.technical.macd_signal)}</dd>
                </div>
                <div>
                  <dt>Support</dt>
                  <dd>{formatLevels(stock.technical.support_zones)}</dd>
                </div>
                <div>
                  <dt>Resistance</dt>
                  <dd>{formatLevels(stock.technical.resistance_zones)}</dd>
                </div>
              </dl>
              {stock.technical.technical_note ? <p className="technical-note">{stock.technical.technical_note}</p> : null}
            </div>
          ) : stock.technical_summary ? (
            <p className="technical-note">{stock.technical_summary}</p>
          ) : null}
          <div className="tag-row">
            {stock.confidence ? <span>{stock.confidence}</span> : null}
            {stock.time_horizon || stock.timeframe ? <span>{stock.time_horizon || stock.timeframe}</span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function PortfolioActivityTimeline({
  transactions,
  journalEntries,
}: {
  transactions: PortfolioTransaction[];
  journalEntries: InvestmentJournalEntry[];
}) {
  const activities = [
    ...transactions.slice(0, 5).map((transaction) => ({
      id: `transaction-${transaction.id}`,
      date: transaction.transaction_date,
      label: transaction.transaction_type.toUpperCase(),
      ticker: transaction.ticker || "Cash",
      primary: transaction.reason || transaction.notes || "Portfolio transaction",
      secondary: `${formatNumber(transaction.quantity)} shares at ${formatNumber(transaction.price_per_share)}`,
    })),
    ...journalEntries.slice(0, 5).map((entry) => ({
      id: `journal-${entry.id}`,
      date: entry.date,
      label: entry.action.toUpperCase(),
      ticker: entry.ticker || "Portfolio",
      primary: entry.reason || "Journal entry",
      secondary: entry.risk || entry.what_would_make_this_wrong || "Investment journal",
    })),
  ]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 8);

  if (activities.length === 0) {
    return <EmptyState label="Add transactions or notes to build an activity timeline." />;
  }

  return (
    <div className="timeline-list">
      {activities.map((activity) => (
        <article className="timeline-item" key={activity.id}>
          <time>{formatDate(activity.date)}</time>
          <div>
            <strong>{activity.label} / {activity.ticker}</strong>
            <p>{activity.primary}</p>
            <span>{activity.secondary}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TradingBotPlaceholder() {
  const points = "0,80 48,68 96,72 144,44 192,52 240,24 288,34 336,18";

  return (
    <section className="panel agent-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Future AI Agent</p>
          <h2>Trading Bot Lab</h2>
          <p className="muted">Reserved for paper trading, risk rules, and strategy review. No live orders are connected.</p>
        </div>
        <span className="status-pill">Future phase</span>
      </div>
      <div className="agent-grid">
        <div className="agent-chart" aria-label="Future simulated strategy chart">
          <svg viewBox="0 0 336 96" preserveAspectRatio="none">
            <polyline points={points} />
          </svg>
        </div>
        <dl className="mini-grid">
          <div>
            <dt>Mode</dt>
            <dd>Paper only</dd>
          </div>
          <div>
            <dt>Broker</dt>
            <dd>Not connected</dd>
          </div>
          <div>
            <dt>Risk rules</dt>
            <dd>Pending</dd>
          </div>
          <div>
            <dt>Agent status</dt>
            <dd>Design stage</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function JourneyList({ transactions }: { transactions: PortfolioTransaction[] }) {
  if (transactions.length === 0) {
    return <EmptyState label="No activity yet. Add your first deposit or purchase." />;
  }

  return (
    <div className="list-stack">
      {transactions.map((transaction) => (
        <article className="item-card" key={transaction.id}>
          <div className="item-card-head">
            <div>
              <strong>{transaction.transaction_type.toUpperCase()}</strong>
              <span>{transaction.ticker || "Cash"} · {transaction.currency}</span>
            </div>
            <time>{formatDate(transaction.transaction_date)}</time>
          </div>
          <dl className="mini-grid">
            <div>
              <dt>Quantity</dt>
              <dd>{formatNumber(transaction.quantity)}</dd>
            </div>
            <div>
              <dt>Price / amount</dt>
              <dd>{formatNumber(transaction.price_per_share)}</dd>
            </div>
            <div>
              <dt>Fee</dt>
              <dd>{formatNumber(transaction.fee)}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{transaction.reason || "-"}</dd>
            </div>
          </dl>
          {transaction.notes ? <p className="muted">{transaction.notes}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function WatchlistTable({ items }: { items: WatchlistItem[] }) {
  if (items.length === 0) {
    return <EmptyState label="No watchlist items yet." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={`/investing/companies/${item.ticker}`}>{item.ticker}</Link>
              </td>
              <td>{item.status.replaceAll("_", " ")}</td>
              <td>{item.reason || "-"}</td>
              <td>{formatDate(item.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvestmentJournalList({ entries, editable = false }: { entries: InvestmentJournalEntry[]; editable?: boolean }) {
  if (entries.length === 0) {
    return <EmptyState label="No notes recorded yet." />;
  }

  return (
    <div className="list-stack">
      {entries.map((entry) => (
        <article className="item-card" key={entry.id}>
          <div className="item-card-head">
            <div>
              <strong>{entry.action}</strong>
              <span>{entry.ticker || "Portfolio"}</span>
            </div>
            <time>{formatDate(entry.date)}</time>
          </div>
          <p>{entry.reason || "No reason added."}</p>
          <dl className="mini-grid">
            <div>
              <dt>Amount</dt>
              <dd>{formatNumber(entry.amount)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{formatNumber(entry.confidence)}</dd>
            </div>
            <div>
              <dt>Risk</dt>
              <dd>{entry.risk || "-"}</dd>
            </div>
          </dl>
          {entry.what_would_make_this_wrong ? <p className="muted">{entry.what_would_make_this_wrong}</p> : null}
          {editable ? (
            <details>
              <summary>Edit</summary>
              <InvestmentJournalForm entry={entry} />
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function NewsList({ news, editable = false }: { news: NewsItem[]; editable?: boolean }) {
  if (news.length === 0) {
    return <EmptyState label="No news items tracked yet." />;
  }

  return (
    <div className="list-stack">
      {news.map((item) => (
        <article className={`item-card impact-${item.impact}`} key={item.id}>
          <div className="item-card-head">
            <div>
              <strong>{item.title}</strong>
              <span>{item.ticker} · {item.source || "Unknown source"}</span>
            </div>
            <time>{formatDate(item.published_at || item.created_at)}</time>
          </div>
          <p>{item.summary || item.my_note || "No summary added."}</p>
          <div className="tag-row">
            <span>{item.impact}</span>
            <span>{item.timeframe.replaceAll("_", " ")}</span>
            {item.thesis_changed ? <span>thesis changed</span> : null}
          </div>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              Open source
            </a>
          ) : null}
          {editable ? (
            <details>
              <summary>Edit impact</summary>
              <NewsForm item={item} />
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
}

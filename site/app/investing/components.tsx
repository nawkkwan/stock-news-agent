import Link from "next/link";
import {
  journalActions,
  newsImpacts,
  newsTimeframes,
  transactionTypes,
  watchlistStatuses,
  type Company,
  type DecisionJournalEntry,
  type Holding,
  type NewsItem,
  type ThesisNote,
  type PortfolioHolding,
  type PortfolioTransaction,
  type WatchlistItem,
} from "../../lib/investment-types";
import { formatDate, formatNumber } from "../../lib/investment-data";
import {
  upsertCompany,
  addTransaction,
  upsertDecision,
  upsertHolding,
  upsertNewsItem,
  upsertThesis,
  upsertWatchlistItem,
} from "./actions";

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

export function HoldingForm({ holding, ticker }: { holding?: Holding | null; ticker?: string }) {
  return (
    <form action={upsertHolding} className="form-grid">
      <input type="hidden" name="id" value={holding?.id || ""} />
      <Field label="Ticker" name="ticker" defaultValue={holding?.ticker || ticker || ""} required />
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

export function TransactionForm({ ticker }: { ticker?: string }) {
  return (
    <form action={addTransaction} className="form-grid">
      <SelectField label="Journey type" name="transaction_type" values={transactionTypes} defaultValue="buy" />
      <Field label="Ticker" name="ticker" defaultValue={ticker || ""} />
      <Field label="Quantity" name="quantity" type="number" />
      <Field label="Price / cash amount" name="price_per_share" type="number" required />
      <Field label="Fee" name="fee" type="number" defaultValue={0} />
      <Field label="Currency" name="currency" defaultValue="USD" required />
      <Field label="Date" name="transaction_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <TextArea label="Reason" name="reason" />
      <TextArea label="Notes" name="notes" />
      <button className="button" type="submit">
        Add to journey
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

export function DecisionForm({ entry, ticker }: { entry?: DecisionJournalEntry | null; ticker?: string }) {
  return (
    <form action={upsertDecision} className="form-grid compact-form">
      <input type="hidden" name="id" value={entry?.id || ""} />
      <Field label="Ticker" name="ticker" defaultValue={entry?.ticker || ticker || ""} />
      <SelectField label="Action" name="action" values={journalActions} defaultValue={entry?.action || "research"} />
      <Field label="Amount" name="amount" type="number" defaultValue={entry?.amount} />
      <Field label="Confidence" name="confidence_score" type="number" defaultValue={entry?.confidence_score} />
      <TextArea label="Reason" name="reason" defaultValue={entry?.reason} />
      <TextArea
        label="What would make this wrong"
        name="what_would_make_this_wrong"
        defaultValue={entry?.what_would_make_this_wrong}
      />
      <button className="button" type="submit">
        Save decision
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

export function JourneyList({ transactions }: { transactions: PortfolioTransaction[] }) {
  if (transactions.length === 0) {
    return <EmptyState label="No journey entries yet. Add your first deposit or purchase." />;
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

export function DecisionsList({ decisions, editable = false }: { decisions: DecisionJournalEntry[]; editable?: boolean }) {
  if (decisions.length === 0) {
    return <EmptyState label="No decisions recorded yet." />;
  }

  return (
    <div className="list-stack">
      {decisions.map((entry) => (
        <article className="item-card" key={entry.id}>
          <div className="item-card-head">
            <div>
              <strong>{entry.action}</strong>
              <span>{entry.ticker || "Portfolio"}</span>
            </div>
            <time>{formatDate(entry.created_at)}</time>
          </div>
          <p>{entry.reason || "No reason added."}</p>
          <dl className="mini-grid">
            <div>
              <dt>Amount</dt>
              <dd>{formatNumber(entry.amount)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{formatNumber(entry.confidence_score)}</dd>
            </div>
          </dl>
          {entry.what_would_make_this_wrong ? <p className="muted">{entry.what_would_make_this_wrong}</p> : null}
          {editable ? (
            <details>
              <summary>Edit</summary>
              <DecisionForm entry={entry} />
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

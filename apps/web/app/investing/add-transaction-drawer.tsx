"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PortfolioHolding, TransactionType } from "../../lib/investment-types";
import { addTransaction } from "./actions";

const transactionOptions: Array<{ value: TransactionType; label: string }> = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "dividend", label: "Dividend" },
  { value: "fee", label: "Fee" },
];

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || "USD"}`;
  }
}

export function AddTransactionDrawer({
  portfolioId,
  holdings,
  currency = "USD",
}: {
  portfolioId?: string | null;
  holdings: PortfolioHolding[];
  currency?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [transactionType, setTransactionType] = useState<TransactionType>("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("0");
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const isTrade = transactionType === "buy" || transactionType === "sell";
  const transactionValue = useMemo(() => {
    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);
    const numericFee = Number(fee) || 0;
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return null;
    if (!isTrade) return numericPrice;
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) return null;
    const gross = numericQuantity * numericPrice;
    return transactionType === "buy" ? gross + numericFee : Math.max(0, gross - numericFee);
  }, [fee, isTrade, price, quantity, transactionType]);

  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("drawer-open");
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("drawer-open");
    };
  }, [isOpen, isPending]);

  function openDrawer() {
    setFeedback(null);
    setIsOpen(true);
  }

  function closeDrawer() {
    if (!isPending) setIsOpen(false);
  }

  function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);
    startTransition(async () => {
      try {
        await addTransaction(formData);
        formRef.current?.reset();
        setTransactionType("buy");
        setQuantity("");
        setPrice("");
        setFee("0");
        setSelectedCurrency(currency);
        setIsOpen(false);
        setFeedback({ kind: "success", message: "Transaction recorded." });
        router.refresh();
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Could not record the transaction.",
        });
      }
    });
  }

  return (
    <div className="portfolio-header-action">
      <button className="button portfolio-primary-cta" onClick={openDrawer} type="button">
        <span aria-hidden="true">+</span> Add Transaction
      </button>
      {feedback ? <p className={`transaction-feedback ${feedback.kind}`} role="status">{feedback.message}</p> : null}

      {isOpen ? (
        <div
          className="transaction-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <aside aria-labelledby="transaction-drawer-title" aria-modal="true" className="transaction-drawer" role="dialog">
            <div className="transaction-drawer-head">
              <div>
                <p className="eyebrow">Portfolio activity</p>
                <h2 id="transaction-drawer-title">Add Transaction</h2>
                <p>Record activity without leaving your portfolio.</p>
              </div>
              <button aria-label="Close transaction drawer" className="drawer-close" disabled={isPending} onClick={closeDrawer} type="button">×</button>
            </div>

            <form className="transaction-drawer-form" onSubmit={submitTransaction} ref={formRef}>
              <input name="portfolio_id" type="hidden" value={portfolioId || ""} />

              <fieldset className="transaction-type-fieldset">
                <legend>Transaction Type</legend>
                <div className="transaction-type-grid">
                  {transactionOptions.map((option, index) => (
                    <label className={transactionType === option.value ? "active" : ""} key={option.value}>
                      <input
                        checked={transactionType === option.value}
                        name="transaction_type"
                        onChange={() => setTransactionType(option.value)}
                        ref={index === 0 ? firstFieldRef as React.RefObject<HTMLInputElement> : undefined}
                        type="radio"
                        value={option.value}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {isTrade ? (
                <label className="drawer-field">
                  <span>Ticker</span>
                  {transactionType === "sell" ? (
                    <select name="ticker" required defaultValue="">
                      <option disabled value="">Select an owned asset</option>
                      {holdings.map((holding) => (
                        <option key={holding.id} value={holding.ticker}>
                          {holding.ticker} · {holding.shares} shares
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input autoComplete="off" list="transaction-holdings" name="ticker" placeholder="e.g. GOOGL" required />
                      <datalist id="transaction-holdings">
                        {holdings.map((holding) => <option key={holding.id} value={holding.ticker} />)}
                      </datalist>
                    </>
                  )}
                </label>
              ) : (
                <label className="drawer-field">
                  <span>Ticker <small>(optional)</small></span>
                  <input autoComplete="off" name="ticker" placeholder="e.g. VOO" />
                </label>
              )}

              {isTrade ? (
                <label className="drawer-field">
                  <span>Quantity</span>
                  <input min="0" name="quantity" onChange={(event) => setQuantity(event.target.value)} required step="any" type="number" value={quantity} />
                </label>
              ) : <input name="quantity" type="hidden" value="" />}

              <div className="drawer-field-row">
                <label className="drawer-field">
                  <span>{isTrade ? "Price" : "Amount"}</span>
                  <input min="0" name="price_per_share" onChange={(event) => setPrice(event.target.value)} required step="any" type="number" value={price} />
                </label>
                <label className="drawer-field">
                  <span>Fee</span>
                  <input min="0" name="fee" onChange={(event) => setFee(event.target.value)} step="any" type="number" value={fee} />
                </label>
              </div>

              <div className="drawer-field-row">
                <label className="drawer-field">
                  <span>Currency</span>
                  <input name="currency" onChange={(event) => setSelectedCurrency(event.target.value.toUpperCase())} required value={selectedCurrency} />
                </label>
                <label className="drawer-field">
                  <span>Date</span>
                  <input defaultValue={new Date().toISOString().slice(0, 10)} name="transaction_date" required type="date" />
                </label>
              </div>

              <label className="drawer-field">
                <span>Reason</span>
                <textarea name="reason" placeholder="Investment rationale" rows={2} />
              </label>
              <label className="drawer-field">
                <span>Notes</span>
                <textarea name="notes" placeholder="Optional details" rows={3} />
              </label>

              <div className="transaction-value-card">
                <span>Transaction Value</span>
                <strong>{transactionValue === null ? "—" : formatCurrency(transactionValue, selectedCurrency)}</strong>
              </div>

              {feedback?.kind === "error" ? <p className="transaction-feedback error" role="alert">{feedback.message}</p> : null}
              <button className="button drawer-submit" disabled={isPending || (transactionType === "sell" && holdings.length === 0)} type="submit">
                {isPending ? "Saving…" : transactionType === "sell" ? "Record Sale" : "Add Transaction"}
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

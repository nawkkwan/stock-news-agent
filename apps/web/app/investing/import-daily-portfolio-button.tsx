"use client";

import { useActionState } from "react";
import {
  importDailyReportPortfolio,
} from "./actions";
import type { ImportDailyPortfolioResult } from "./actions";

const initialState: ImportDailyPortfolioResult = {
  status: "idle",
  message: "",
};

export function ImportDailyPortfolioButton({
  disabled,
  portfolioId,
}: {
  disabled?: boolean;
  portfolioId?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    importDailyReportPortfolio,
    initialState
  );

  return (
    <form action={formAction} className="import-daily-form">
      <input type="hidden" name="portfolio_id" value={portfolioId || ""} />
      <button className="button secondary" disabled={disabled || isPending} type="submit">
        {isPending ? "Importing…" : "Import Daily notes portfolio"}
      </button>
      {state.status !== "idle" ? (
        <p className={state.status === "success" ? "form-feedback success" : "form-feedback error"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { deleteHolding } from "./actions";

export function DeleteHoldingButton({ id, ticker }: { id: string; ticker: string }) {
  return (
    <details className="holding-actions">
      <summary aria-label={`Actions for ${ticker}`}>•••</summary>
      <div className="holding-actions-menu">
        <a href={`/investing/companies/${ticker}`}>View details</a>
        <a href={`/investing/companies/${ticker}`}>Edit</a>
        <form
          action={deleteHolding}
          onSubmit={(event) => {
            if (!window.confirm(`Remove ${ticker} from this portfolio? Transaction history will be kept.`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button type="submit">Remove from portfolio</button>
        </form>
      </div>
    </details>
  );
}

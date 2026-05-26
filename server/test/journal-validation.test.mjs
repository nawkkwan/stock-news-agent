import test from "node:test";
import assert from "node:assert/strict";

import { validateJournalInput } from "../src/journal-validation.js";

test("validateJournalInput normalizes a valid journal entry", () => {
  const result = validateJournalInput({
    date: "2026-05-26",
    ticker: "voo",
    action: "BUY",
    amount_thb: "3000",
    price: "510.25",
    quantity: "0.18",
    reason: "DCA long-term core holding",
    thesis: "S&P 500 core allocation",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    date: "2026-05-26",
    ticker: "VOO",
    action: "buy",
    amount_thb: 3000,
    price: 510.25,
    quantity: 0.18,
    reason: "DCA long-term core holding",
    thesis: "S&P 500 core allocation",
    mood: null,
    source_url: null,
    notes: null,
  });
});

test("validateJournalInput rejects missing core fields", () => {
  const result = validateJournalInput({
    date: "26/05/2026",
    ticker: "",
    action: "pray",
    reason: "",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "date must use YYYY-MM-DD",
    "ticker is required",
    "action must be one of buy, sell, hold, add, trim, watch",
    "reason is required",
  ]);
});

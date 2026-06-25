import test from "node:test";
import assert from "node:assert/strict";

import { validateJournalInput } from "../src/journal-validation.js";

test("validateJournalInput normalizes a valid journal entry", () => {
  const result = validateJournalInput({
    date: "2026-05-26",
    ticker: "voo",
    action: "RESEARCH",
    amount: "3000",
    reason: "DCA long-term core holding",
    confidence: "75",
    risk: "Valuation could compress if rates rise",
    what_would_make_this_wrong: "Earnings quality deteriorates",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    date: "2026-05-26",
    ticker: "VOO",
    action: "research",
    amount: 3000,
    reason: "DCA long-term core holding",
    confidence: 75,
    risk: "Valuation could compress if rates rise",
    what_would_make_this_wrong: "Earnings quality deteriorates",
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
    "action must be one of buy, sell, hold, trim, add, research",
    "reason is required",
  ]);
});

test("validateJournalInput rejects confidence outside the journal range", () => {
  const result = validateJournalInput({
    date: "2026-05-26",
    ticker: "VOO",
    action: "buy",
    reason: "Sizing a new position",
    confidence: "101",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["confidence must be between 0 and 100"]);
});

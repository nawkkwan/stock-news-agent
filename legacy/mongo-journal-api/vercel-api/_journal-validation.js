const ACTIONS = new Set(["buy", "sell", "hold", "trim", "add", "research"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateJournalInput(input) {
  const errors = [];
  const date = cleanText(input?.date);
  const ticker = cleanText(input?.ticker).toUpperCase();
  const action = cleanText(input?.action).toLowerCase();
  const reason = cleanText(input?.reason);

  if (!isDateOnly(date)) {
    errors.push("date must use YYYY-MM-DD");
  }
  if (!/^[A-Z0-9.]{1,12}$/.test(ticker)) {
    errors.push("ticker is required");
  }
  if (!ACTIONS.has(action)) {
    errors.push(`action must be one of ${Array.from(ACTIONS).join(", ")}`);
  }
  if (reason.length < 3) {
    errors.push("reason is required");
  }

  const amount = parseNumber(input?.amount);
  const confidence = parseNumber(input?.confidence);

  if (input?.amount !== undefined && amount === null) {
    errors.push("amount must be a number");
  }
  if (input?.confidence !== undefined && confidence === null) {
    errors.push("confidence must be a number");
  }
  if (confidence !== null && (confidence < 0 || confidence > 100)) {
    errors.push("confidence must be between 0 and 100");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      date,
      ticker,
      action,
      amount,
      reason,
      confidence,
      risk: cleanOptionalText(input?.risk),
      what_would_make_this_wrong: cleanOptionalText(input?.what_would_make_this_wrong),
    },
  };
}

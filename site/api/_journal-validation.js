const ACTIONS = new Set(["buy", "sell", "hold", "add", "trim", "watch"]);

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

  const amountThb = parseNumber(input?.amount_thb);
  const price = parseNumber(input?.price);
  const quantity = parseNumber(input?.quantity);

  if (input?.amount_thb !== undefined && amountThb === null) {
    errors.push("amount_thb must be a number");
  }
  if (input?.price !== undefined && price === null) {
    errors.push("price must be a number");
  }
  if (input?.quantity !== undefined && quantity === null) {
    errors.push("quantity must be a number");
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
      amount_thb: amountThb,
      price,
      quantity,
      reason,
      thesis: cleanOptionalText(input?.thesis),
      mood: cleanOptionalText(input?.mood),
      source_url: cleanOptionalText(input?.source_url),
      notes: cleanOptionalText(input?.notes),
    },
  };
}

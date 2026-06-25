const MONEY_PATTERN = /[+-]?\s*\d[\d,]*(?:\.\d+)?/g;
const TICKER_PATTERN = /\b[A-Z]{1,5}\b/g;
const IGNORED_TOKENS = new Set(["THB", "ETF", "USD", "NYSE", "NASDAQ"]);

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function parseMoney(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleaned = String(value)
    .replace(/[^\d.-]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export function calculateGainLoss(currentValue, costValue) {
  const current = Number(currentValue);
  const cost = Number(costValue);

  if (!Number.isFinite(current) || !Number.isFinite(cost) || cost <= 0) {
    return { amount: null, pct: null };
  }

  const amount = roundMoney(current - cost);
  return {
    amount,
    pct: roundMoney((amount / cost) * 100),
  };
}

function normalizeLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function inferTickers(lines) {
  const tickers = [];
  lines.forEach((line) => {
    const ticker = Array.from(line.matchAll(TICKER_PATTERN), (match) => match[0]).find(
      (candidate) => !IGNORED_TOKENS.has(candidate)
    );
    if (ticker && !tickers.includes(ticker)) {
      tickers.push(ticker);
    }
  });
  return tickers;
}

function lineContainsTicker(line, ticker) {
  return new RegExp(`\\b${ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line);
}

function readAmounts(lines) {
  return lines
    .flatMap((line) => Array.from(line.matchAll(MONEY_PATTERN), (match) => parseMoney(match[0])))
    .filter((value) => value !== null);
}

function readPercent(line) {
  const match = String(line).match(/[+-]?\s*\d[\d,]*(?:\.\d+)?\s*%/);
  return match ? parseMoney(match[0]) : null;
}

function readPercents(line) {
  return Array.from(String(line).matchAll(/[+-]?\s*\d[\d,]*(?:\.\d+)?\s*%/g), (match) => parseMoney(match[0]))
    .filter((value) => value !== null);
}

function readThbAmount(line) {
  const match = String(line).match(/[([+\-\s]*\d[\d,]*(?:\.\d+)?\s*(?:THB|\u0e1a\u0e32\u0e17)/i);
  return match ? parseMoney(match[0]) : null;
}

function readHoldingValueAmounts(line) {
  const cleaned = String(line)
    .replace(/[+-]?\s*\d[\d,]*(?:\.\d+)?\s*%/g, " ")
    .replace(/[([+\-\s]*\d[\d,]*(?:\.\d+)?\s*(?:THB|\u0e1a\u0e32\u0e17)/gi, " ")
    .replace(/[≈~]?\s*\d[\d,]*(?:\.\d+)?\s*USD/gi, " ");
  return readAmounts([cleaned]).filter((amount) => Math.abs(amount) >= 100);
}

function pickDimeTableValues(lines) {
  const valueCandidates = [];
  const profitAmounts = [];
  const profitPercents = [];

  lines.forEach((line) => {
    const percents = readPercents(line);
    const thbAmount = readThbAmount(line);

    if (thbAmount !== null && /[+-]/.test(line)) {
      profitAmounts.push(thbAmount);
    }
    if (percents.length > 0) {
      profitPercents.push(...percents);
    }
    readHoldingValueAmounts(line)
      .forEach((amount) => valueCandidates.push(amount));
  });

  const currentValue = valueCandidates[0] ?? null;
  const profitAmount = profitAmounts[0] ?? null;
  const portfolioWeightPct = profitPercents.length > 1 ? profitPercents[0] : null;
  const gainLossPct = profitPercents.length > 0 ? profitPercents[profitPercents.length - 1] : null;

  if (currentValue === null || profitAmount === null) {
    return null;
  }

  return {
    portfolioWeightPct,
    currentValue,
    costValue: roundMoney(currentValue - profitAmount),
    gainLossAmount: roundMoney(profitAmount),
    gainLossPct,
  };
}

function scoreLine(line, type) {
  const normalized = line.toLowerCase();
  if (type === "current") {
    if (/current|market\s*value|value|\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32|\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19/.test(normalized)) {
      return 3;
    }
  }
  if (type === "cost" && /cost|invest|\u0e15\u0e49\u0e19\u0e17\u0e38\u0e19|\u0e40\u0e07\u0e34\u0e19\u0e25\u0e07\u0e17\u0e38\u0e19/.test(normalized)) {
    return 3;
  }
  return 1;
}

function pickAmount(lines, type, fallbackIndex) {
  const candidates = lines
    .map((line, index) => ({
      amounts: readAmounts([line]),
      score: scoreLine(line, type),
      index,
    }))
    .filter((candidate) => candidate.amounts.length > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const labeledCandidates = candidates.filter((candidate) => candidate.score > 1);
  if (labeledCandidates.length > 0) {
    return labeledCandidates[0].amounts[0];
  }

  return readAmounts(lines.slice(1))[fallbackIndex] ?? null;
}

export function extractDimeHoldings(ocrText, tickers = null) {
  const lines = String(ocrText || "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);
  const portfolioTickers = tickers && tickers.length ? tickers : inferTickers(lines);

  return portfolioTickers.flatMap((ticker) => {
    const tickerIndex = lines.findIndex((line) => lineContainsTicker(line, ticker));
    if (tickerIndex === -1) {
      return [];
    }

    const nextTickerIndex = lines.findIndex(
      (line, index) => index > tickerIndex && portfolioTickers.some((nextTicker) => lineContainsTicker(line, nextTicker))
    );
    const endIndex = nextTickerIndex === -1 ? tickerIndex + 6 : Math.min(nextTickerIndex, tickerIndex + 6);
    const block = lines.slice(tickerIndex, endIndex);
    const dimeTableValues = pickDimeTableValues(block);
    if (dimeTableValues) {
      return [
        {
          ticker,
          ...dimeTableValues,
        },
      ];
    }

    const currentValue = pickAmount(block, "current", 0);
    const costValue = pickAmount(block, "cost", 1);
    const gainLoss = calculateGainLoss(currentValue, costValue);

    return [
      {
        ticker,
        currentValue,
        costValue,
        gainLossAmount: gainLoss.amount,
        gainLossPct: gainLoss.pct,
      },
    ];
  });
}

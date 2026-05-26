import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateGainLoss,
  extractDimeHoldings,
  parseMoney,
} from "./portfolio-upload.mjs";

test("parseMoney reads Thai and US formatted amounts", () => {
  assert.equal(parseMoney("฿12,345.67"), 12345.67);
  assert.equal(parseMoney("1,234"), 1234);
  assert.equal(parseMoney("- 99.50 THB"), -99.5);
});

test("calculateGainLoss returns amount and percentage", () => {
  assert.deepEqual(calculateGainLoss(1250, 1000), {
    amount: 250,
    pct: 25,
  });
});

test("calculateGainLoss handles missing or zero cost", () => {
  assert.deepEqual(calculateGainLoss(1250, 0), {
    amount: null,
    pct: null,
  });
});

test("extractDimeHoldings matches report tickers and nearby current/cost amounts", () => {
  const ocrText = `
    VOO Vanguard S&P 500 ETF
    มูลค่าปัจจุบัน ฿7,896.41
    เงินลงทุน ฿7,500.00

    GOOGL Alphabet
    Market value 2,546.17 THB
    Cost 2,700.00 THB
  `;

  assert.deepEqual(extractDimeHoldings(ocrText, ["VOO", "GOOGL", "MSFT"]), [
    {
      ticker: "VOO",
      currentValue: 7896.41,
      costValue: 7500,
      gainLossAmount: 396.41,
      gainLossPct: 5.29,
    },
    {
      ticker: "GOOGL",
      currentValue: 2546.17,
      costValue: 2700,
      gainLossAmount: -153.83,
      gainLossPct: -5.7,
    },
  ]);
});

test("extractDimeHoldings can infer tickers for another user's portfolio", () => {
  const ocrText = `
    NVDA
    Market value 10,500.00 THB
    Cost 9,000.00 THB

    AAPL
    Current value 4,200.00 THB
    Invested 4,500.00 THB
  `;

  assert.deepEqual(extractDimeHoldings(ocrText), [
    {
      ticker: "NVDA",
      currentValue: 10500,
      costValue: 9000,
      gainLossAmount: 1500,
      gainLossPct: 16.67,
    },
    {
      ticker: "AAPL",
      currentValue: 4200,
      costValue: 4500,
      gainLossAmount: -300,
      gainLossPct: -6.67,
    },
  ]);
});

test("extractDimeHoldings does not infer S and P from S&P 500 names", () => {
  const ocrText = `
    VOO Vanguard S&P 500 ETF
    Market value 7,896.41 THB
    Cost 7,500.00 THB
  `;

  assert.deepEqual(extractDimeHoldings(ocrText), [
    {
      ticker: "VOO",
      currentValue: 7896.41,
      costValue: 7500,
      gainLossAmount: 396.41,
      gainLossPct: 5.29,
    },
  ]);
});

test("extractDimeHoldings scores Thai Dime labels for current value and cost", () => {
  const currentLabel = "\u0e21\u0e39\u0e25\u0e04\u0e48\u0e32\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19";
  const costLabel = "\u0e15\u0e49\u0e19\u0e17\u0e38\u0e19";
  const ocrText = `
    MSFT Microsoft
    ${costLabel} 1,200.00 THB
    ${currentLabel} 1,500.00 THB
  `;

  assert.deepEqual(extractDimeHoldings(ocrText), [
    {
      ticker: "MSFT",
      currentValue: 1500,
      costValue: 1200,
      gainLossAmount: 300,
      gainLossPct: 25,
    },
  ]);
});

test("extractDimeHoldings reads Dime holding value with profit amount format", () => {
  const ocrText = `
    6 assets Holding Value (THB) % Profit & Amount
    VOO
    49.91%
    8,244.27
    253.36 USD
    10.58%
    (+788.71 THB)

    GOOGL
    15.69%
    2,591.97
    79.65 USD
    20.80%
    (+446.28 THB)

    XLV
    10.51%
    1,735.48
    53.33 USD
    -4.61%
    (-83.83 THB)
  `;

  assert.deepEqual(extractDimeHoldings(ocrText), [
    {
      ticker: "VOO",
      currentValue: 8244.27,
      costValue: 7455.56,
      gainLossAmount: 788.71,
      gainLossPct: 10.58,
    },
    {
      ticker: "GOOGL",
      currentValue: 2591.97,
      costValue: 2145.69,
      gainLossAmount: 446.28,
      gainLossPct: 20.8,
    },
    {
      ticker: "XLV",
      currentValue: 1735.48,
      costValue: 1819.31,
      gainLossAmount: -83.83,
      gainLossPct: -4.61,
    },
  ]);
});

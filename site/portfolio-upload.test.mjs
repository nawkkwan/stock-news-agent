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

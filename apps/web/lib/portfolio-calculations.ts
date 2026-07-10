import type { Holding, PortfolioHolding, PortfolioTransaction } from "./investment-types";

type Position = {
  shares: number;
  avgCost: number;
  totalCost: number;
};

function number(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function calculatePositions(transactions: PortfolioTransaction[]) {
  const positions = new Map<string, Position>();
  let cashBalance = 0;
  const hasCashLedger = transactions.some((transaction) =>
    ["deposit", "withdrawal", "dividend", "fee"].includes(transaction.transaction_type)
  );

  const ordered = [...transactions].sort(
    (left, right) =>
      new Date(left.transaction_date).getTime() - new Date(right.transaction_date).getTime() ||
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );

  for (const transaction of ordered) {
    const quantity = number(transaction.quantity);
    const price = number(transaction.price_per_share);
    const fee = number(transaction.fee);
    const ticker = transaction.ticker?.toUpperCase() || null;

    if (transaction.transaction_type === "deposit") {
      cashBalance += price;
      continue;
    }
    if (transaction.transaction_type === "withdrawal") {
      cashBalance -= price;
      continue;
    }
    if (transaction.transaction_type === "dividend") {
      cashBalance += price - fee;
      continue;
    }
    if (transaction.transaction_type === "fee") {
      cashBalance -= fee || price;
      continue;
    }
    if (!ticker || quantity <= 0 || price < 0) {
      continue;
    }

    const current = positions.get(ticker) || { shares: 0, avgCost: 0, totalCost: 0 };

    if (transaction.transaction_type === "buy") {
      const purchaseCost = quantity * price + fee;
      const shares = current.shares + quantity;
      const totalCost = current.totalCost + purchaseCost;
      positions.set(ticker, {
        shares,
        totalCost,
        avgCost: shares > 0 ? totalCost / shares : 0,
      });
      if (hasCashLedger) {
        cashBalance -= purchaseCost;
      }
    }

    if (transaction.transaction_type === "sell") {
      const soldShares = Math.min(quantity, current.shares);
      const shares = current.shares - soldShares;
      const totalCost = Math.max(0, current.totalCost - soldShares * current.avgCost);
      positions.set(ticker, {
        shares,
        totalCost,
        avgCost: shares > 0 ? totalCost / shares : 0,
      });
      if (hasCashLedger) {
        cashBalance += soldShares * price - fee;
      }
    }
  }

  return { positions, cashBalance, hasCashLedger };
}

export function buildPortfolioHoldings(holdings: Holding[], transactions: PortfolioTransaction[]) {
  const { cashBalance, hasCashLedger } = calculatePositions(transactions);
  const raw = holdings.flatMap((holding) => {
    const shares = number(holding.shares);
    const avgCost = number(holding.avg_cost);
    const latestPrice = number(holding.latest_price);
    const storedValue = number(holding.current_value);
    const totalCost = shares > 0 && avgCost > 0 ? shares * avgCost : storedValue;
    const marketValue = shares > 0 && latestPrice > 0
      ? shares * latestPrice
      : storedValue > 0
        ? storedValue
        : totalCost;

    if (shares <= 0 && marketValue <= 0) {
      return [];
    }

    return [{
      ...holding,
      shares,
      avg_cost: avgCost,
      total_cost: totalCost,
      market_value: marketValue,
      unrealized_gain: totalCost > 0 ? marketValue - totalCost : 0,
      unrealized_gain_pct: totalCost > 0 ? ((marketValue - totalCost) / totalCost) * 100 : null,
      portfolio_weight: 0,
    } satisfies PortfolioHolding];
  });

  const investedValue = raw.reduce((sum, holding) => sum + holding.market_value, 0);
  const portfolioValue = investedValue + (hasCashLedger ? cashBalance : 0);
  const denominator = portfolioValue > 0 ? portfolioValue : investedValue;
  const portfolioHoldings = raw
    .map((holding) => ({
      ...holding,
      portfolio_weight: denominator > 0 ? (holding.market_value / denominator) * 100 : 0,
    }))
    .sort((left, right) => right.market_value - left.market_value);

  return { portfolioHoldings, portfolioValue: denominator, cashBalance, hasCashLedger };
}

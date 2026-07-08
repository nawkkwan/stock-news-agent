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
  const { positions, cashBalance, hasCashLedger } = calculatePositions(transactions);
  const holdingByTicker = new Map(holdings.map((holding) => [holding.ticker.toUpperCase(), holding]));
  const tickers = new Set([...holdingByTicker.keys(), ...positions.keys()]);
  const raw = [...tickers].flatMap((ticker) => {
    const position = positions.get(ticker);
    const metadata = holdingByTicker.get(ticker);

    if (position && position.shares <= 0) {
      return [];
    }

    if (!position) {
      const fallbackValue = number(metadata?.current_value);
      const fallbackShares = number(metadata?.shares);
      const fallbackAvgCost = number(metadata?.avg_cost);
      const fallbackCost = fallbackShares > 0 && fallbackAvgCost > 0 ? fallbackShares * fallbackAvgCost : fallbackValue;
      if (!metadata || fallbackValue <= 0) {
        return [];
      }

      return [
        {
          ...metadata,
          shares: fallbackShares,
          avg_cost: fallbackAvgCost,
          total_cost: fallbackCost,
          market_value: fallbackValue,
          unrealized_gain: fallbackCost > 0 ? fallbackValue - fallbackCost : 0,
          unrealized_gain_pct:
            fallbackCost > 0 ? ((fallbackValue - fallbackCost) / fallbackCost) * 100 : null,
          portfolio_weight: 0,
        } satisfies PortfolioHolding,
      ];
    }

    const latestPrice = number(metadata?.latest_price);
    const fallbackValue = number(metadata?.current_value);
    const marketValue = latestPrice > 0
      ? position.shares * latestPrice
      : fallbackValue > 0
        ? fallbackValue
        : position.totalCost;
    return [
      {
        ...(metadata || {
          id: ticker,
          company_id: null,
          portfolio_id: null,
          ticker,
          latest_price: null,
          current_value: null,
          target_weight: null,
          notes: null,
          created_at: "",
          updated_at: "",
          user_id: null,
        }),
        shares: position.shares,
        avg_cost: position.avgCost,
        total_cost: position.totalCost,
        market_value: marketValue,
        unrealized_gain: marketValue - position.totalCost,
        unrealized_gain_pct:
          position.totalCost > 0 ? ((marketValue - position.totalCost) / position.totalCost) * 100 : null,
        portfolio_weight: 0,
      } satisfies PortfolioHolding,
    ];
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

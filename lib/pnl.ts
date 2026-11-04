import type { TradeRecord } from './trades';

export type PositionPnl = {
  hasHistory: boolean;
  avgCostUsd: number;
  costBasisUsd: number;
  unrealizedUsd: number;
  unrealizedPct: number;
  realizedUsd: number;
};

export function computePositionPnl(
  trades: TradeRecord[],
  heldTokens: number,
  currentValueUsd: number
): PositionPnl {
  let tokens = 0;
  let costUsd = 0;
  let realizedUsd = 0;

  for (const trade of trades) {
    if (trade.side === 'buy') {
      tokens += trade.token_amount;
      costUsd += trade.usd_value;
      continue;
    }
    if (tokens <= 0) continue;
    const sold = Math.min(trade.token_amount, tokens);
    const avgCost = costUsd / tokens;
    const removedCost = avgCost * sold;
    realizedUsd += trade.usd_value - removedCost;
    costUsd -= removedCost;
    tokens -= sold;
  }

  if (tokens <= 0) {
    return { hasHistory: false, avgCostUsd: 0, costBasisUsd: 0, unrealizedUsd: 0, unrealizedPct: 0, realizedUsd };
  }

  const avgCostUsd = costUsd / tokens;
  const costBasisUsd = avgCostUsd * heldTokens;
  const unrealizedUsd = currentValueUsd - costBasisUsd;
  const unrealizedPct = costBasisUsd > 0 ? (unrealizedUsd / costBasisUsd) * 100 : 0;

  return { hasHistory: true, avgCostUsd, costBasisUsd, unrealizedUsd, unrealizedPct, realizedUsd };
}

import type { PublicKey } from '@solana/web3.js';
import { SOL_MINT } from './config';
import { fetchSolanaTokenPairs } from './dexscreener';
import { computePositionPnl, type PositionPnl } from './pnl';
import { fetchUsdPrices } from './jupiter';
import { getAllTokenHoldings, getSolBalance } from './solana';
import { fetchTrades, type TradeRecord } from './trades';

export type HoldingRow = {
  mint: string;
  symbol: string;
  uiAmount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  pnl: PositionPnl;
};

export type PortfolioSnapshot = {
  solBalance: number;
  solUsd: number | null;
  rows: HoldingRow[];
  totalValueUsd: number;
  unrealizedUsd: number;
  realizedUsd: number;
  tokenScanFailed: boolean;
};

export async function loadPortfolio(owner: PublicKey): Promise<PortfolioSnapshot> {
  const wallet = owner.toBase58();
  const [holdingsResult, solBalance, trades] = await Promise.all([
    getAllTokenHoldings(owner).catch(() => null),
    getSolBalance(owner),
    fetchTrades(wallet).catch(() => [] as TradeRecord[]),
  ]);

  const tokenScanFailed = holdingsResult === null;
  const tokenHoldings = (holdingsResult ?? []).filter((h) => h.mint !== SOL_MINT);
  const mints = Array.from(new Set([...tokenHoldings.map((h) => h.mint), ...trades.map((t) => t.mint)]));

  const priceMap: Record<string, number> = await fetchUsdPrices([SOL_MINT, ...mints]).catch(() => ({}));
  const symbolMap: Record<string, string> = {};
  for (const trade of trades) symbolMap[trade.mint] = trade.symbol;

  const missing = mints.filter((mint) => priceMap[mint] === undefined);
  const fallbackPairs = await fetchSolanaTokenPairs(missing).catch(() => []);
  for (const pair of fallbackPairs) {
    const mint = pair.baseToken.address;
    if (pair.priceUsd && priceMap[mint] === undefined) priceMap[mint] = Number(pair.priceUsd);
    if (!symbolMap[mint]) symbolMap[mint] = pair.baseToken.symbol;
  }

  const rows: HoldingRow[] = tokenHoldings.map((holding) => {
    const priceUsd = priceMap[holding.mint] ?? null;
    const valueUsd = priceUsd === null ? null : holding.uiAmount * priceUsd;
    const mintTrades = tradesFor(trades, holding.mint);
    return {
      mint: holding.mint,
      symbol: symbolMap[holding.mint] ?? `${holding.mint.slice(0, 4)}...`,
      uiAmount: holding.uiAmount,
      priceUsd,
      valueUsd,
      pnl: computePositionPnl(mintTrades, holding.uiAmount, valueUsd ?? 0),
    };
  });

  const solUsd = priceMap[SOL_MINT] ?? null;
  const solValueUsd = solUsd === null ? 0 : solBalance * solUsd;
  const totalValueUsd = solValueUsd + rows.reduce((sum, row) => sum + (row.valueUsd ?? 0), 0);
  const unrealizedUsd = rows.reduce(
    (sum, row) => sum + (row.valueUsd !== null && row.pnl.hasHistory ? row.pnl.unrealizedUsd : 0),
    0
  );
  const realizedUsd = Array.from(new Set(trades.map((t) => t.mint))).reduce(
    (sum, mint) => sum + computePositionPnl(tradesFor(trades, mint), 0, 0).realizedUsd,
    0
  );

  return {
    solBalance,
    solUsd,
    rows: rows.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)),
    totalValueUsd,
    unrealizedUsd,
    realizedUsd,
    tokenScanFailed,
  };
}

function tradesFor(trades: TradeRecord[], mint: string): TradeRecord[] {
  return trades.filter((trade) => trade.mint === mint);
}

export type DexPair = {
  chainId: string;
  pairAddress: string;
  priceUsd?: string;
  priceNative?: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  volume?: { h1?: number; h24?: number };
  priceChange?: { h1?: number; h24?: number };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  info?: { imageUrl?: string };
};

const DEX_BASE = 'https://api.dexscreener.com/latest/dex';

async function fetchSolanaPairs(url: string): Promise<DexPair[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`Market data request failed (${res.status})`);
  const data = (await res.json()) as { pairs?: DexPair[] | null };
  if (!Array.isArray(data.pairs)) return [];
  return data.pairs.filter(
    (pair) => pair && pair.chainId === 'solana' && pair.baseToken?.address
  );
}

function bestPairPerToken(pairs: DexPair[], score: (pair: DexPair) => number): DexPair[] {
  const byToken = new Map<string, DexPair>();
  for (const pair of pairs) {
    const current = byToken.get(pair.baseToken.address);
    if (!current || score(pair) > score(current)) {
      byToken.set(pair.baseToken.address, pair);
    }
  }
  return Array.from(byToken.values());
}

const MIN_TRENDING_VOLUME_USD = 5_000;

export async function fetchTrendingSolana(): Promise<DexPair[]> {
  const pairs = await fetchSolanaPairs(`${DEX_BASE}/search/?q=SOL`);
  const realTokens = pairs.filter(
    (p) => p.baseToken.symbol.toUpperCase() !== 'SOL' && (p.volume?.h24 ?? 0) >= MIN_TRENDING_VOLUME_USD
  );
  return bestPairPerToken(realTokens, (p) => p.volume?.h24 ?? 0)
    .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
    .slice(0, 48);
}

export async function fetchSolanaTokenPairs(mints: string[]): Promise<DexPair[]> {
  if (mints.length === 0) return [];
  const pairs = await fetchSolanaPairs(`${DEX_BASE}/tokens/${mints.slice(0, 30).join(',')}`);
  return bestPairPerToken(pairs, (p) => p.liquidity?.usd ?? 0);
}

export async function searchSolanaTokensBySymbol(term: string, limit = 5): Promise<DexPair[]> {
  const needle = term.toLowerCase();
  const pairs = await fetchSolanaPairs(`${DEX_BASE}/search/?q=${encodeURIComponent(term)}`);
  const matches = pairs.filter((p) => p.baseToken.symbol.toLowerCase().includes(needle));
  return bestPairPerToken(matches, (p) => p.liquidity?.usd ?? 0)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .slice(0, limit);
}

export const FALLBACK_TRENDING_TOKENS = [
  { name: 'Bonk', symbol: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { name: 'dogwifhat', symbol: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { name: 'Popcat', symbol: 'POPCAT', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  { name: 'Trump', symbol: 'TRUMP', address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' },
];

export async function fetchTrendingWithFallback(): Promise<DexPair[]> {
  const trending = await fetchTrendingSolana().catch(() => []);
  if (trending.length > 0) return trending;
  const pairs = await fetchSolanaTokenPairs(FALLBACK_TRENDING_TOKENS.map((token) => token.address));
  if (pairs.length === 0) throw new Error('No market data available.');
  return pairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
}

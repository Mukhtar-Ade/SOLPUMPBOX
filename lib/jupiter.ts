const PROXY_BASE = '/api/jupiter';
const PROXY_HEADERS = {
  'Content-Type': 'application/json',
};

export async function fetchUsdPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const res = await fetch(`${PROXY_BASE}/price?ids=${mints.join(',')}`, {
    headers: PROXY_HEADERS,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Price request failed (${res.status})`);
  const data = (await res.json()) as Record<string, { usdPrice?: number } | null | undefined>;
  const prices: Record<string, number> = {};
  for (const mint of mints) {
    const price = data?.[mint]?.usdPrice;
    if (typeof price === 'number') prices[mint] = price;
  }
  return prices;
}

export type JupiterQuote = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  [key: string]: unknown;
};

export async function getJupiterV6Quote(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}): Promise<JupiterQuote> {
  const url = new URL(`${PROXY_BASE}/quote`);
  url.searchParams.set('inputMint', params.inputMint);
  url.searchParams.set('outputMint', params.outputMint);
  url.searchParams.set('amount', params.amount);
  url.searchParams.set('slippageBps', String(params.slippageBps ?? 300));
  const res = await fetch(url.toString(), {
    headers: PROXY_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[Jupiter v6] quote failed via proxy:', res.status, body);
    throw new Error(`Quote failed (${res.status})`);
  }
  return res.json() as Promise<JupiterQuote>;
}

export async function getJupiterV6SwapTransaction(quote: JupiterQuote, userPublicKey: string): Promise<string> {
  const res = await fetch(`${PROXY_BASE}/swap`, {
    method: 'POST',
    headers: PROXY_HEADERS,
    body: JSON.stringify({ quoteResponse: quote, userPublicKey, wrapAndUnwrapSol: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[Jupiter v6] swap request failed via proxy:', res.status, body);
    throw new Error('Jupiter swap request failed');
  }
  const data = (await res.json()) as { swapTransaction?: string; error?: string };
  if (!data.swapTransaction) {
    throw new Error(data.error ?? 'Jupiter swap returned no transaction');
  }
  return data.swapTransaction;
}

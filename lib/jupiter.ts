const PROXY_BASE = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/jupiter' : '/api/jupiter';
const PROXY_HEADERS = {
  'Content-Type': 'application/json',
};

export async function fetchUsdPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const res = await fetch(`${PROXY_BASE}/price?ids=${mints.join(',')}`, {
    headers: PROXY_HEADERS,
    signal: AbortSignal.timeout(10000),
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
  const feeWallet = process.env.NEXT_PUBLIC_FEE_WALLET;
let feeAccount: string | undefined = undefined;
if (feeWallet) {
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    const [ata] = await PublicKey.findProgramAddress(
      [
        new PublicKey(feeWallet).toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        new PublicKey(params.outputMint).toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    feeAccount = ata.toBase58();
  } catch {}
}
const search = new URLSearchParams({
  inputMint: params.inputMint,
  outputMint: params.outputMint,
  amount: String(params.amount),
  slippageBps: String(params.slippageBps ?? 300),
  ...(feeAccount ? { platformFeeBps: "50", feeAccount } : {}),
});
  const res = await fetch(`${PROXY_BASE}/quote?${search.toString()}`, {
    headers: PROXY_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Jupiter v6 quote failed via proxy:', res.status, body);
    throw new Error(`Jupiter v6 quote failed (${res.status})`);
  }
  return res.json() as Promise<JupiterQuote>;
}

export async function getJupiterV6SwapTransaction(quote: JupiterQuote, userPublicKey: string): Promise<string> {
  const res = await fetch(`${PROXY_BASE}/swap`, {
    method: 'POST',
    headers: PROXY_HEADERS,
    body: JSON.stringify({ quoteResponse: quote, userPublicKey, wrapAndUnwrapSol: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Jupiter v6 swap request failed via proxy:', res.status, body);
    throw new Error(`Jupiter v6 swap request failed (${res.status})`);
  }
  const data = (await res.json()) as { swapTransaction?: string; error?: string };
  if (!data.swapTransaction) {
    throw new Error(data.error ?? 'Jupiter swap returned no transaction');
  }
  return data.swapTransaction;
}

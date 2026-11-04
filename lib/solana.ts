import { Connection, PublicKey, type ParsedAccountData } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { RPC_URLS, SOL_DECIMALS } from './config';

const connections = RPC_URLS.map((url) => new Connection(url, 'confirmed'));

const RPC_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RPC request timed out')), RPC_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function withRpc<T>(run: (connection: Connection) => Promise<T>): Promise<T> {
  let lastError: unknown = new Error('No Solana RPC endpoint is configured.');
  for (const connection of connections) {
    try {
      return await withTimeout(run(connection));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export type TokenHolding = {
  mint: string;
  raw: bigint;
  decimals: number;
  uiAmount: number;
};

type ParsedTokenInfo = {
  mint: string;
  tokenAmount: { amount: string; decimals: number; uiAmount: number | null };
};

function parsedInfo(data: unknown): ParsedTokenInfo | null {
  const parsed = data as ParsedAccountData | undefined;
  if (!parsed || typeof parsed !== 'object' || !('parsed' in parsed)) return null;
  return parsed.parsed.info as ParsedTokenInfo;
}

function toHolding(info: ParsedTokenInfo): TokenHolding {
  return {
    mint: info.mint,
    raw: BigInt(info.tokenAmount.amount),
    decimals: info.tokenAmount.decimals,
    uiAmount: info.tokenAmount.uiAmount ?? 0,
  };
}

export async function getTokenHolding(owner: PublicKey, mint: string): Promise<TokenHolding | null> {
  const { value } = await withRpc((connection) =>
    connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(mint) })
  );
  const holdings = value
    .map((entry) => parsedInfo(entry.account.data))
    .filter((info): info is ParsedTokenInfo => info !== null)
    .map(toHolding);
  if (holdings.length === 0) return null;
  const raw = holdings.reduce((sum, h) => sum + h.raw, BigInt(0));
  return { mint, raw, decimals: holdings[0].decimals, uiAmount: Number(raw) / 10 ** holdings[0].decimals };
}

export async function getAllTokenHoldings(owner: PublicKey): Promise<TokenHolding[]> {
  const { value } = await withRpc((connection) =>
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })
  );
  return value
    .map((entry) => parsedInfo(entry.account.data))
    .filter((info): info is ParsedTokenInfo => info !== null)
    .map(toHolding)
    .filter((h) => h.raw > BigInt(0));
}

export async function getMintDecimals(mint: string): Promise<number> {
  const info = await withRpc((connection) => connection.getParsedAccountInfo(new PublicKey(mint)));
  const parsed = info.value?.data as ParsedAccountData | undefined;
  const decimals = (parsed?.parsed?.info as { decimals?: number } | undefined)?.decimals;
  if (typeof decimals !== 'number') throw new Error('Could not read token decimals.');
  return decimals;
}

export async function getSolBalance(owner: PublicKey): Promise<number> {
  const lamports = await withRpc((connection) => connection.getBalance(owner));
  return lamports / 10 ** SOL_DECIMALS;
}

export async function sendRawTransaction(rawTx: Buffer): Promise<string> {
  return withRpc(async (connection) => {
    const signature = await connection.sendRawTransaction(rawTx, { maxRetries: 2 });
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  });
}

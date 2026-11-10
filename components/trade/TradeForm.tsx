'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { VersionedTransaction } from '@solana/web3.js';
import type { DexPair } from '@/lib/dexscreener';
import { SOL_DECIMALS, SOL_MINT } from '@/lib/config';
import { fetchUsdPrices, getJupiterV6Quote, getJupiterV6SwapTransaction, type JupiterQuote } from '@/lib/jupiter';
import {
  getMintDecimals,
  getSolBalance,
  getTokenHolding,
  sendRawTransaction,
  type TokenHolding,
} from '@/lib/solana';
import { readCachedBalance, saveCachedBalance } from '@/lib/cachedBalance';
import { recordTrade } from '@/lib/trades';
import { formatAmount, formatUsd } from '@/lib/format';
import type { TradeSide } from '@/components/trade/TradeModal';

const QUOTE_DEBOUNCE_MS = 450;
const BUY_PRESETS = ['0.1', '0.5', '1'];
const SELL_PRESETS = [25, 50, 100];

type Phase = 'idle' | 'signing' | 'sending' | 'done';

export function TradeForm({ pair, initialSide }: { pair: DexPair; initialSide: TradeSide }) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const takerAddress = publicKey?.toBase58() ?? '';
  const mint = pair.baseToken.address;
  const tokenSymbol = pair.baseToken.symbol;
  const tokenPriceUsd = pair.priceUsd ? Number(pair.priceUsd) : 0;

  const [side, setSide] = useState<TradeSide>(initialSide);
  const [amountInput, setAmountInput] = useState('0.1');
  const [sellPct, setSellPct] = useState(100);
  const [solPriceUsd, setSolPriceUsd] = useState(0);
  const [decimals, setDecimals] = useState<number | null>(null);
  const [holding, setHolding] = useState<TokenHolding | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [estOutAmount, setEstOutAmount] = useState<string | null>(null);
  const [estSource, setEstSource] = useState<'jupiter' | 'dexscreener' | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [txError, setTxError] = useState<string | null>(null);
  const [result, setResult] = useState<{ signature: string; saved: boolean } | null>(null);
  const [balanceVersion, setBalanceVersion] = useState(0);

  const solAmount = Number(amountInput);
  const buyValid = Number.isFinite(solAmount) && solAmount > 0;
  const buyRaw = buyValid ? BigInt(Math.floor(solAmount * 10 ** SOL_DECIMALS)) : BigInt(0);
  const sellRaw = holding ? (holding.raw * BigInt(sellPct)) / BigInt(100) : BigInt(0);
  const inputRaw = side === 'buy' ? buyRaw : sellRaw;
  const inputRawStr = inputRaw > BigInt(0) ? inputRaw.toString() : '';
  const inputMint = side === 'buy' ? SOL_MINT : mint;
  const outputMint = side === 'buy' ? mint : SOL_MINT;
  const outDecimals = side === 'buy' ? decimals : SOL_DECIMALS;
  const outHuman =
    estOutAmount && outDecimals !== null ? Number(estOutAmount) / 10 ** outDecimals : null;
  const outUsd =
    outHuman === null ? null : side === 'buy' ? outHuman * tokenPriceUsd : outHuman * solPriceUsd;
  const payUsd =
    side === 'buy'
      ? solAmount * solPriceUsd
      : decimals !== null && sellRaw > BigInt(0)
        ? (Number(sellRaw) / 10 ** decimals) * tokenPriceUsd
        : null;
  const insufficient =
    side === 'buy'
      ? buyValid && solBalance !== null && solAmount > solBalance
      : false;

  // Fetch SOL price and token decimals on mount / mint change
  useEffect(() => {
    let cancelled = false;
    fetchUsdPrices([SOL_MINT])
      .then((prices) => {
        if (!cancelled && prices[SOL_MINT]) setSolPriceUsd(prices[SOL_MINT]);
      })
      .catch(() => undefined);
    getMintDecimals(mint)
      .then((value) => {
        if (!cancelled) setDecimals(value);
      })
      .catch((error) => {
        console.error('[Trade] getMintDecimals failed:', error);
        if (!cancelled) setTxError('Could not read this token. Trading may be unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  // Fetch wallet balances — show cached immediately, then load live
  useEffect(() => {
    if (!publicKey) {
      setHolding(null);
      setSolBalance(null);
      setBalanceLoading(false);
      return;
    }
    let cancelled = false;
    const owner = publicKey;
    const walletKey = owner.toBase58();

    // Show cached balance immediately so the user doesn't see "Loading..."
    const cached = readCachedBalance(walletKey);
    if (cached) setSolBalance(cached.sol);
    setBalanceLoading(true);

    Promise.all([getTokenHolding(owner, mint), getSolBalance(owner)])
      .then(([tokenHolding, sol]) => {
        if (cancelled) return;
        setHolding(tokenHolding);
        setSolBalance(sol);
        saveCachedBalance(walletKey, sol);
      })
      .catch((error) => {
        console.error('[Trade] balance fetch failed:', error);
        // Keep cached balance if we have it; otherwise show 0 so UI isn't stuck
        if (!cancelled && !cached) setSolBalance(0);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, mint, balanceVersion]);

  // Quote effect — v6 primary, DexScreener price fallback for display
  useEffect(() => {
    setQuote(null);
    setEstOutAmount(null);
    setEstSource(null);
    setQuoteError(null);
    if (!takerAddress || !inputRawStr || insufficient) {
      setQuoting(false);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(() => {
  const isPreviewBuy = side === 'buy';
  let previewAmount = inputRawStr;
  if (isPreviewBuy) {
    const inp = BigInt(inputRawStr);
    previewAmount = (inp - (inp * BigInt(70)) / BigInt(10000)).toString();
  }
  getJupiterV6Quote({ inputMint, outputMint, amount: previewAmount, platformFeeBps: isPreviewBuy ? 0 : 70 })
        .then((q) => {
          if (cancelled) return;
          setQuote(q);
          setEstOutAmount(q.outAmount);
          setEstSource('jupiter');
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error('[Trade] v6 quote failed:', error);
          // Fallback: estimate output from DexScreener price
          const msg = error instanceof Error ? error.message : 'Quote failed';
          if (tokenPriceUsd > 0 && solPriceUsd > 0 && outDecimals !== null) {
            const inputUsd =
              side === 'buy'
                ? solAmount * solPriceUsd
                : decimals !== null
                  ? (Number(inputRawStr) / 10 ** decimals) * tokenPriceUsd
                  : 0;
            const outputUsd = inputUsd * 0.97; // 3% slippage assumption
            const estRaw =
              side === 'buy'
                ? BigInt(Math.floor((outputUsd / tokenPriceUsd) * 10 ** outDecimals))
                : BigInt(Math.floor((outputUsd / solPriceUsd) * 10 ** SOL_DECIMALS));
            setEstOutAmount(estRaw.toString());
            setEstSource('dexscreener');
            setQuoteError(`Jupiter quote unavailable, showing price estimate (${msg})`);
          } else {
            setQuoteError(`Could not get a quote: ${msg}`);
          }
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMint, outputMint, inputRawStr, takerAddress, insufficient, decimals, solPriceUsd, tokenPriceUsd]);

  async function handleConfirm() {
    if (!publicKey || !signTransaction || decimals === null) return;
    setTxError(null);
    setPhase('signing');
    try {
     // 0.7% fee in SOL - BUY: take SOL fee off, swap rest with 0 Jupiter fee. SELL: Jupiter fee 70 in SOL
const isBuy = side === 'buy';
let swapAmount = inputRawStr;
let solFeeLamports = BigInt(0);
if (isBuy) {
  const input = BigInt(inputRawStr);
  solFeeLamports = (input * BigInt(70)) / BigInt(10000);
  swapAmount = (input - solFeeLamports).toString();
}
let swapQuote;
if (!swapQuote) {
  swapQuote = await getJupiterV6Quote({ inputMint, outputMint, amount: swapAmount, platformFeeBps: isBuy ? 0 : 70 })
}
      const swapTx = await getJupiterV6SwapTransaction(swapQuote, publicKey.toBase58());
      const transaction = VersionedTransaction.deserialize(Buffer.from(swapTx, 'base64'));
      const signedTx = await signTransaction(transaction);
      setPhase('sending');
      const signature = await sendRawTransaction(Buffer.from(signedTx.serialize()));
      if (isBuy && solFeeLamports > BigInt(0)) {
  try {
    const { Connection, PublicKey, SystemProgram, Transaction } = await import('@solana/web3.js');
    const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com');
    const feeWallet = new PublicKey(process.env.NEXT_PUBLIC_FEE_WALLET!);
    const feeTx = new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: feeWallet, lamports: solFeeLamports }));
    feeTx.feePayer = publicKey;
    feeTx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    const signedFeeTx = await (signTransaction as any)(feeTx);
    await sendRawTransaction(Buffer.from(signedFeeTx.serialize()));
  } catch (e) { console.error('SOL fee transfer failed', e); }
}

      const solLeg = Number(side === 'buy' ? inputRawStr : swapQuote.outAmount) / 10 ** SOL_DECIMALS;
      const tokenLeg = Number(side === 'buy' ? swapQuote.outAmount : inputRawStr) / 10 ** decimals;
      let saved = true;
      try {
        await recordTrade(publicKey.toBase58(), {
          mint,
          symbol: tokenSymbol,
          side,
          sol_amount: solLeg,
          token_amount: tokenLeg,
          usd_value: solLeg * solPriceUsd,
          signature,
        });
      } catch {
        saved = false;
      }
      setResult({ signature, saved });
      setPhase('done');
      setBalanceVersion((v) => v + 1);
    } catch (error) {
      console.error('[Trade] swap failed:', error);
      setTxError(error instanceof Error ? error.message : 'The swap did not go through.');
      setPhase('idle');
    }
  }

  function resetForm() {
    setResult(null);
    setPhase('idle');
    setTxError(null);
  }

  if (result) {
    return (
      <div className="animate-fade-up flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pump-green/15 text-2xl text-pump-green">
          &#10003;
        </div>
        <h3 className="text-lg font-bold text-white">Trade confirmed</h3>
        <p className="text-sm text-white/60">
          Your {side === 'buy' ? 'buy' : 'sell'} of {tokenSymbol} is on-chain.
        </p>
        {!result.saved && (
          <p className="text-xs text-amber-300">The trade went through but could not be saved to your portfolio history.</p>
        )}
        <a
          href={`https://solscan.io/tx/${result.signature}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-pump-green underline-offset-4 hover:underline"
        >
          View transaction
        </a>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-full border border-white/20 px-5 py-2 text-sm text-white transition hover:border-pump-green hover:text-pump-green"
        >
          Trade again
        </button>
      </div>
    );
  }

  const busy = phase === 'signing' || phase === 'sending';
  let ctaLabel = side === 'buy' ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`;
  if (!connected) ctaLabel = 'Connect wallet to trade';
  else if (phase === 'signing') ctaLabel = 'Confirm in wallet...';
  else if (phase === 'sending') ctaLabel = 'Sending transaction...';
  const canTradeWithEstimate = estSource === 'dexscreener' && estOutAmount !== null;
  const ctaDisabled =
    connected &&
    (busy || decimals === null || !inputRawStr || insufficient || quoting || (!quote && !canTradeWithEstimate));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
        {(['buy', 'sell'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setSide(tab);
              setTxError(null);
            }}
            className={`h-10 rounded-lg text-sm font-bold capitalize transition ${
              side === tab
                ? tab === 'buy'
                  ? 'bg-pump-green text-black'
                  : 'bg-red-500 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {side === 'buy' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Amount (SOL)</span>
            <span>
              Balance:{' '}
              {balanceLoading && solBalance === null
                ? 'Loading...'
                : `${formatAmount(solBalance ?? 0)} SOL`}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black px-4 focus-within:border-pump-green">
            <input
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value.replace(/[^0-9.]/g, ''))}
              className="h-12 w-full bg-transparent text-xl font-semibold text-white outline-none"
              aria-label="Amount in SOL"
            />
            <span className="text-sm font-semibold text-white/60">SOL</span>
          </div>
          <p className="text-xs text-white/40">{formatUsd(payUsd)} at current SOL price</p>
          <div className="grid grid-cols-3 gap-2">
            {BUY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountInput(preset)}
                className="h-9 rounded-lg border border-white/15 text-xs font-semibold text-white/80 transition hover:border-pump-green hover:text-pump-green"
              >
                {preset} SOL
              </button>
            ))}
          </div>
          {insufficient && <p className="text-xs text-red-400">Insufficient SOL</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Sell {tokenSymbol}</span>
            <span>Balance: {holding ? `${formatAmount(holding.uiAmount)} ${tokenSymbol}` : '--'}</span>
          </div>
          <div className="rounded-xl border border-white/15 bg-black px-4 py-3">
            <p className="text-xl font-semibold text-white">
              {holding && decimals !== null ? formatAmount(Number(sellRaw) / 10 ** holding.decimals, 6) : '0'}{' '}
              <span className="text-sm text-white/60">{tokenSymbol}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SELL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={!holding}
                onClick={() => setSellPct(preset)}
                className={`h-9 rounded-lg border text-xs font-semibold transition disabled:opacity-40 ${
                  sellPct === preset
                    ? 'border-pump-green bg-pump-green/10 text-pump-green'
                    : 'border-white/15 text-white/80 hover:border-pump-green hover:text-pump-green'
                }`}
              >
                {preset === 100 ? 'Max' : `${preset}%`}
              </button>
            ))}
          </div>
          {!holding && connected && <p className="text-xs text-white/40">You do not hold this token yet.</p>}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
        <Row label="You pay">
          {side === 'buy'
            ? `${formatAmount(solAmount)} SOL`
            : `${formatAmount(Number(sellRaw) / 10 ** (holding?.decimals ?? 0), 6)} ${tokenSymbol}`}
        </Row>
        <Row label="You get (est.)">
          {quoting ? (
            <span className="text-white/50">Finding best route...</span>
          ) : outHuman !== null ? (
            <>
              {formatAmount(outHuman, 6)} {side === 'buy' ? tokenSymbol : 'SOL'}
              <span className="ml-2 text-xs text-white/40">{formatUsd(outUsd)}</span>
              {estSource === 'dexscreener' && (
                <span className="ml-2 text-xs text-amber-300/70">est.</span>
              )}
            </>
          ) : (
            <span className="text-white/40">--</span>
          )}
        </Row>
        <Row label="Slippage">{estSource === 'dexscreener' ? '~3%' : '1.0%'}</Row>
      </div>

      {(txError || (quoteError && estSource !== 'dexscreener')) && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {txError ?? quoteError}
        </p>
      )}
      {quoteError && estSource === 'dexscreener' && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {quoteError}
        </p>
      )}

      <button
        type="button"
        disabled={connected ? ctaDisabled : false}
        onClick={() => (connected ? handleConfirm() : setVisible(true))}
        className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
          side === 'buy' ? 'bg-pump-green text-black' : 'bg-red-500 text-white'
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="text-right font-medium text-white">{children}</span>
    </div>
  );
}

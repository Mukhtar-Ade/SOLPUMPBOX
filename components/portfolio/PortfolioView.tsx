'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { RefreshCw, Wallet } from 'lucide-react';
import { loadPortfolio, type PortfolioSnapshot } from '@/lib/portfolio';
import { formatAmount, formatPct, formatTokenPrice, formatUsd } from '@/lib/format';
import { SOL_MINT } from '@/lib/config';
import { getSolBalance } from '@/lib/solana';
import { readCachedBalance, saveCachedBalance, type CachedBalance } from '@/lib/cachedBalance';

type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: PortfolioSnapshot };

type BalanceState =
  | { status: 'loading' }
  | { status: 'live'; sol: number }
  | { status: 'cached'; cached: CachedBalance }
  | { status: 'unavailable' };

export function PortfolioView() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [balance, setBalance] = useState<BalanceState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    const wallet = publicKey.toBase58();
    setState({ status: 'loading' });
    setBalance((current) => {
      if (current.status === 'live') return current;
      const cached = readCachedBalance(wallet);
      return cached ? { status: 'cached', cached } : { status: 'loading' };
    });
    getSolBalance(publicKey)
      .then((sol) => {
        saveCachedBalance(wallet, sol);
        setBalance({ status: 'live', sol });
      })
      .catch(() => {
        setBalance((current) => {
          if (current.status === 'live') return current;
          const cached = readCachedBalance(wallet);
          return cached ? { status: 'cached', cached } : { status: 'unavailable' };
        });
      });
    try {
      setState({ status: 'ready', data: await loadPortfolio(publicKey) });
    } catch (error) {
      console.error(error);
      setState({ status: 'error', message: 'RPC busy, refresh' });
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) {
      setState({ status: 'idle' });
      setBalance({ status: 'loading' });
      return;
    }
    refresh();
  }, [publicKey, refresh]);

  if (!connected || !publicKey) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-32 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-pump-purple/50 bg-pump-purple/10">
          <Wallet className="h-7 w-7 text-pump-green" />
        </div>
        <h1 className="text-2xl font-bold text-white">Connect your wallet</h1>
        <p className="text-sm text-white/60">
          Your holdings and profit and loss are read from your Solana wallet. Connect Phantom or Solflare to see them.
        </p>
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="h-11 rounded-full bg-pump-green px-6 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pump-green">Portfolio</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Your holdings</h1>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh portfolio"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-pump-green hover:text-pump-green"
        >
          <RefreshCw className={`h-4 w-4 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <BalanceCard balance={balance} onRetry={refresh} />

      {(state.status === 'idle' || state.status === 'loading') && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/60">
          Loading...
        </div>
      )}

      {state.status === 'error' && (
        <p className="mt-8 text-center text-sm text-white/50">{state.message}</p>
      )}

      {state.status === 'ready' && <PortfolioContent data={state.data} />}
    </div>
  );
}

function BalanceCard({ balance, onRetry }: { balance: BalanceState; onRetry: () => void }) {
  const value =
    balance.status === 'live'
      ? `${balance.sol.toFixed(5)} SOL`
      : balance.status === 'cached'
        ? `${balance.cached.sol.toFixed(5)} SOL`
        : '--';
  const note =
    balance.status === 'live'
      ? 'Live from the Solana network'
      : balance.status === 'cached'
        ? `Last known balance, saved ${new Date(balance.cached.savedAt).toLocaleString()}`
        : balance.status === 'unavailable'
          ? 'Balance unavailable, RPC busy'
          : 'Loading balance...';

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-white/50">SOL balance</p>
        <p className="mt-1 text-xl font-bold text-white">{value}</p>
      </div>
      <div className="flex items-center gap-4">
        <p className="text-right text-xs text-white/50">{note}</p>
        {(balance.status === 'cached' || balance.status === 'unavailable') && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white transition hover:border-pump-green hover:text-pump-green"
          >
            Retry Live Balance
          </button>
        )}
      </div>
    </div>
  );
}

function PortfolioContent({ data }: { data: PortfolioSnapshot }) {
  const pnlTone = (value: number) => (value >= 0 ? 'text-pump-green' : 'text-red-400');

  return (
    <div className="animate-fade-up mt-8 space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total value" value={formatUsd(data.totalValueUsd)} sub={`${formatAmount(data.solBalance)} SOL in wallet`} />
        <SummaryCard
          label="Unrealized P&L"
          value={formatUsd(data.unrealizedUsd)}
          valueClass={pnlTone(data.unrealizedUsd)}
          sub="Open positions vs. average cost"
        />
        <SummaryCard
          label="Realized P&L"
          value={formatUsd(data.realizedUsd)}
          valueClass={pnlTone(data.realizedUsd)}
          sub="Closed trades made in SOLPUMPBOX"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 border-b border-white/10 px-5 py-3 text-[11px] uppercase tracking-wider text-white/40 max-md:hidden">
          <span>Token</span>
          <span className="text-right">Price</span>
          <span className="text-right">Value</span>
          <span className="text-right">P&L</span>
        </div>

        <HoldingLine symbol="SOL" mint={SOL_MINT} amount={data.solBalance} priceUsd={data.solUsd} valueUsd={data.solUsd === null ? null : data.solBalance * data.solUsd} pnlText={null} pnlPct={null} />

        {data.rows.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-white/50">No SPL tokens found</p>
            {data.tokenScanFailed && <p className="mt-1 text-xs text-white/40">Token scan unavailable, RPC busy</p>}
          </div>
        )}

        {data.rows.map((row) => (
          <HoldingLine
            key={row.mint}
            symbol={row.symbol}
            mint={row.mint}
            amount={row.uiAmount}
            priceUsd={row.priceUsd}
            valueUsd={row.valueUsd}
            pnlText={row.valueUsd !== null && row.pnl.hasHistory ? formatUsd(row.pnl.unrealizedUsd) : null}
            pnlPct={row.valueUsd !== null && row.pnl.hasHistory ? row.pnl.unrealizedPct : null}
          />
        ))}
      </div>
      <p className="text-xs text-white/40">
        P&L uses your average buy price from trades made through SOLPUMPBOX. Tokens bought elsewhere show value but no P&L.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, sub, valueClass = 'text-white' }: { label: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black p-5">
      <p className="text-xs uppercase tracking-wider text-white/50">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-white/40">{sub}</p>
    </div>
  );
}

function HoldingLine({
  symbol,
  mint,
  amount,
  priceUsd,
  valueUsd,
  pnlText,
  pnlPct,
}: {
  symbol: string;
  mint: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  pnlText: string | null;
  pnlPct: number | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-white/5 px-5 py-4 last:border-b-0 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-white">{symbol}</p>
        <p className="text-xs text-white/40">
          {formatAmount(amount, 4)} · <span className="font-mono">{mint.slice(0, 4)}...{mint.slice(-4)}</span>
        </p>
      </div>
      <p className="font-mono text-sm text-white md:text-right">{formatTokenPrice(priceUsd)}</p>
      <p className="text-sm font-semibold text-white md:text-right">{formatUsd(valueUsd)}</p>
      <div className="md:text-right">
        {pnlText === null ? (
          <p className="text-sm text-white/40">--</p>
        ) : (
          <>
            <p className={`text-sm font-semibold ${(pnlPct ?? 0) >= 0 ? 'text-pump-green' : 'text-red-400'}`}>{pnlText}</p>
            <p className="text-xs text-white/50">{formatPct(pnlPct)}</p>
          </>
        )}
      </div>
    </div>
  );
}

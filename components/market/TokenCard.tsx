'use client';

import { Coins, TrendingUp } from 'lucide-react';
import type { DexPair } from '@/lib/dexscreener';
import { formatCompactUsd, formatPct, formatTokenPrice } from '@/lib/format';

type TokenCardProps = {
  pair: DexPair;
  onOpen: () => void;
  onBuy: () => void;
};

function ChangeBadge({ label, value }: { label: string; value: number | undefined }) {
  const positive = (value ?? 0) >= 0;
  return (
    <div className="flex flex-1 flex-col rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span>
      <span className={`text-sm font-semibold ${positive ? 'text-pump-green' : 'text-red-400'}`}>
        {formatPct(value)}
      </span>
    </div>
  );
}

export function TokenCard({ pair, onOpen, onBuy }: TokenCardProps) {
  const price = pair.priceUsd ? Number(pair.priceUsd) : null;
  const mcap = pair.marketCap ?? pair.fdv;

  return (
    <article
      onClick={onOpen}
      className="group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black p-5 transition duration-300 hover:-translate-y-1 hover:border-pump-green/50 hover:shadow-[0_12px_40px_-12px_rgba(20,241,149,0.35)]"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-pump-purple/20 blur-3xl transition group-hover:bg-pump-green/20" />

      <div className="flex items-center gap-3">
        {pair.info?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pair.info.imageUrl} alt="" className="h-11 w-11 rounded-full bg-white/5 object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pump-purple/20">
            <Coins className="h-5 w-5 text-pump-green" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-white">{pair.baseToken.symbol}</p>
          <p className="truncate text-xs text-white/50">{pair.baseToken.name}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-white">{formatTokenPrice(price)}</p>
          <p className="text-[11px] text-white/40">USD</p>
        </div>
      </div>

      <div className="flex gap-2">
        <ChangeBadge label="1h" value={pair.priceChange?.h1} />
        <ChangeBadge label="24h" value={pair.priceChange?.h24} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/50">Volume 24h</p>
          <p className="font-semibold text-white">{formatCompactUsd(pair.volume?.h24)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-white/50">MCAP</p>
          <p className="font-semibold text-white">{formatCompactUsd(mcap)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onBuy();
        }}
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-pump-green text-sm font-bold text-black transition hover:brightness-110 active:scale-[0.98]"
      >
        <TrendingUp className="h-4 w-4" />
        Buy {pair.baseToken.symbol}
      </button>
    </article>
  );
}

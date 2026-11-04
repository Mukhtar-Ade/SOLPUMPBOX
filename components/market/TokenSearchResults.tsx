'use client';

import { Coins } from 'lucide-react';
import type { DexPair } from '@/lib/dexscreener';
import { formatCompactUsd, formatTokenPrice } from '@/lib/format';

type TokenSearchResultsProps = {
  results: DexPair[];
  onSelect: (pair: DexPair) => void;
};

export function TokenSearchResults({ results, onSelect }: TokenSearchResultsProps) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <p className="border-b border-white/10 px-5 py-3 text-[11px] uppercase tracking-wider text-white/50">Matching tokens</p>
      <ul>
        {results.map((pair) => (
          <li key={pair.pairAddress} className="border-b border-white/5 last:border-b-0">
            <button
              type="button"
              onClick={() => onSelect(pair)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.04]"
            >
              {pair.info?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pair.info.imageUrl} alt="" className="h-9 w-9 rounded-full bg-white/5 object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pump-purple/20">
                  <Coins className="h-4 w-4 text-pump-green" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{pair.baseToken.symbol}</p>
                <p className="truncate text-xs text-white/50">{pair.baseToken.name}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-white">{formatTokenPrice(pair.priceUsd ? Number(pair.priceUsd) : null)}</p>
                <p className="text-xs text-white/50">Liq {formatCompactUsd(pair.liquidity?.usd)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

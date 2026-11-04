'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DexPair } from '@/lib/dexscreener';
import { formatCompactUsd, formatPct, formatTokenPrice } from '@/lib/format';
import { SafetyPanel } from '@/components/trade/SafetyPanel';
import { TradeForm } from '@/components/trade/TradeForm';

export type TradeSide = 'buy' | 'sell';

type TradeModalProps = {
  pair: DexPair | null;
  initialSide: TradeSide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TradeModal({ pair, initialSide, open, onOpenChange }: TradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-black p-0 text-white sm:max-w-4xl">
        {pair && (
          <>
            <DialogHeader className="border-b border-white/10 px-6 py-5">
              <DialogTitle className="flex items-center gap-3 text-xl">
                {pair.baseToken.symbol}
                <span className="text-sm font-normal text-white/50">{pair.baseToken.name}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/60">
                <span className="font-mono text-white">{formatTokenPrice(pair.priceUsd ? Number(pair.priceUsd) : null)}</span>
                <span className={(pair.priceChange?.h24 ?? 0) >= 0 ? 'text-pump-green' : 'text-red-400'}>
                  24h {formatPct(pair.priceChange?.h24)}
                </span>
                <span>Vol 24h {formatCompactUsd(pair.volume?.h24)}</span>
                <span>MCAP {formatCompactUsd(pair.marketCap ?? pair.fdv)}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <iframe
                  key={pair.pairAddress}
                  title={`${pair.baseToken.symbol} price chart`}
                  src={`https://dexscreener.com/solana/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                  className="h-[320px] w-full rounded-2xl border border-white/10 bg-black md:h-[440px]"
                  loading="lazy"
                />
                <SafetyPanel mint={pair.baseToken.address} />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <TradeForm key={pair.pairAddress} pair={pair} initialSide={initialSide} />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

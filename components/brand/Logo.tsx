import { Box, Coins } from 'lucide-react';

const COINS = [
  { x: '-26px', y: '-34px', delay: '0s' },
  { x: '6px', y: '-44px', delay: '0.8s' },
  { x: '30px', y: '-26px', delay: '1.6s' },
];

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center" style={{ perspective: 300 }}>
        {COINS.map((coin) => (
          <Coins
            key={coin.x}
            aria-hidden
            className="animate-coin-pop absolute h-3.5 w-3.5 text-pump-green"
            style={{ ['--coin-x' as string]: coin.x, ['--coin-y' as string]: coin.y, animationDelay: coin.delay }}
          />
        ))}
        <div className="animate-box-float flex h-9 w-9 items-center justify-center rounded-lg border border-pump-purple/60 bg-gradient-to-br from-pump-purple/30 to-black shadow-[0_0_18px_rgba(153,69,255,0.45)]">
          <Box className="h-5 w-5 text-pump-green" strokeWidth={2.2} />
        </div>
      </div>
      <div className="leading-none">
        <p className="text-base font-extrabold tracking-tight text-white">
          SOLPUMP<span className="text-pump-green">BOX</span>
        </p>
        <p className="mt-1 hidden text-[10px] uppercase tracking-[0.2em] text-white/50 sm:block">
          Unbox The Next Pump
        </p>
      </div>
    </div>
  );
}

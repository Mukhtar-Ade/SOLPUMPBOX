'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { fetchSolanaTokenPairs, fetchTrendingWithFallback, searchSolanaTokensBySymbol, type DexPair } from '@/lib/dexscreener';
import { TokenCard } from '@/components/market/TokenCard';
import { TokenSearchResults } from '@/components/market/TokenSearchResults';
import { TradeModal, type TradeSide } from '@/components/trade/TradeModal';

const REFRESH_MS = 30_000;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SYMBOL_NOT_FOUND = 'Token not found, paste mint address to trade directly';

type LoadState = 'loading' | 'ready' | 'error';

export function MarketView() {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DexPair[] | null>(null);
  const [selected, setSelected] = useState<{ pair: DexPair; side: TradeSide } | null>(null);

  const loadTrending = useCallback(async () => {
    try {
      const trending = await fetchTrendingWithFallback();
      setPairs(trending);
      setLoadState('ready');
    } catch {
      setLoadState((current) => (current === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => {
    loadTrending();
    const timer = setInterval(loadTrending, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadTrending]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    setSearchError(null);
    setSearchResults(null);
    if (term.length === 0) return;
    setSearching(true);
    try {
      if (SOLANA_ADDRESS.test(term)) {
        const [match] = await fetchSolanaTokenPairs([term]);
        if (!match) {
          setSearchError('No Solana trading pair was found for that address.');
          return;
        }
        setSelected({ pair: match, side: 'buy' });
        return;
      }
      const matches = await searchSolanaTokensBySymbol(term);
      if (matches.length === 0) {
        setSearchError(SYMBOL_NOT_FOUND);
        return;
      }
      setSearchResults(matches);
    } catch {
      setSearchError('Token lookup failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-pump-purple/25 via-black to-black px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-pump-purple/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-pump-green/20 blur-3xl" />
        <div className="relative animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pump-green">Solana memecoin terminal</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl">
            Unbox The <span className="text-gradient-brand">Next Pump</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/60">
            Live trending Solana tokens, charts and safety scores in one place. Swaps route through Jupiter and stay in your wallet.
          </p>

          <form onSubmit={handleSearch} className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Token address</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search token by symbol or paste mint address"
                className="h-12 w-full rounded-xl border border-white/15 bg-black/60 pl-11 pr-4 font-mono text-sm text-white placeholder:text-white/35 outline-none transition focus:border-pump-green focus:ring-2 focus:ring-pump-green/30"
              />
            </label>
            <button
              type="submit"
              disabled={searching || query.trim().length === 0}
              className="h-12 rounded-xl bg-pump-purple px-6 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Find token'}
            </button>
          </form>
          {searchError && <p className="mt-3 text-sm text-red-400">{searchError}</p>}
        </div>
      </section>

      {searchResults && (
        <TokenSearchResults results={searchResults} onSelect={(pair) => setSelected({ pair, side: 'buy' })} />
      )}

      <div className="mt-12 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Trending Now</h2>
          <p className="text-sm text-white/50">Ranked by 24h volume. Refreshes every 30 seconds.</p>
        </div>
        <button
          type="button"
          onClick={loadTrending}
          aria-label="Refresh trending tokens"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-pump-green hover:text-pump-green"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loadState === 'loading' && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-64 rounded-2xl border border-white/5" />
          ))}
        </div>
      )}

      {loadState === 'error' && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-10 text-center">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <p className="text-sm text-white/70">We could not load trending tokens right now.</p>
          <button
            type="button"
            onClick={loadTrending}
            className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition hover:border-pump-green hover:text-pump-green"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pairs.map((pair, index) => (
            <div key={pair.pairAddress} className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
              <TokenCard
                pair={pair}
                onOpen={() => setSelected({ pair, side: 'buy' })}
                onBuy={() => setSelected({ pair, side: 'buy' })}
              />
            </div>
          ))}
        </div>
      )}

      <TradeModal
        pair={selected?.pair ?? null}
        initialSide={selected?.side ?? 'buy'}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

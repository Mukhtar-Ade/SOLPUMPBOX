import { supabase } from './supabase';

export type TradeSide = 'buy' | 'sell';

export type TradeRecord = {
  mint: string;
  symbol: string;
  side: TradeSide;
  sol_amount: number;
  token_amount: number;
  usd_value: number;
  signature: string;
};

export async function recordTrade(wallet: string, trade: TradeRecord): Promise<void> {
  const { error } = await supabase.from('trades').insert({ ...trade, wallet });
  if (error) throw new Error(error.message);
}

export async function fetchTrades(wallet: string): Promise<TradeRecord[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('mint, symbol, side, sol_amount, token_amount, usd_value, signature')
    .eq('wallet', wallet)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TradeRecord[];
}

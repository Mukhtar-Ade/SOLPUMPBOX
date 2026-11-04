export const RPC_URLS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const SOL_DECIMALS = 9;

export const FEE_CONFIG = {
  enabled: false,
  referralAccount: '',
  feeBps: 80,
  ownerWallet: '4NQzpJjGGU4UsSJSeNVKCVCLgfTTGdxC8RTVN6mwjeQb',
};

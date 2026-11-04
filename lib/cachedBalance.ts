export type CachedBalance = { sol: number; savedAt: number };

const KEY_PREFIX = 'solpumpbox:sol-balance:';

export function readCachedBalance(wallet: string): CachedBalance | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + wallet);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBalance>;
    return typeof parsed.sol === 'number' && typeof parsed.savedAt === 'number'
      ? { sol: parsed.sol, savedAt: parsed.savedAt }
      : null;
  } catch {
    return null;
  }
}

export function saveCachedBalance(wallet: string, sol: number): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + wallet, JSON.stringify({ sol, savedAt: Date.now() }));
  } catch {
    // Storage can be unavailable (private mode); the live balance still displays.
  }
}

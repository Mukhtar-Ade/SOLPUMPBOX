const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  if (Math.abs(value) < 0.01 && value !== 0) return `$${value.toPrecision(2)}`;
  return usdFormatter.format(value);
}

export function formatCompactUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `$${compactFormatter.format(value)}`;
}

export function formatTokenPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  if (value >= 1) return usdFormatter.format(value);
  return `$${value.toPrecision(4)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatAmount(value: number, maxDigits = 4): string {
  if (!Number.isFinite(value)) return '--';
  if (value === 0) return '0';
  if (Math.abs(value) < 1e-6) return value.toExponential(2);
  return value.toLocaleString('en-US', { maximumFractionDigits: maxDigits });
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

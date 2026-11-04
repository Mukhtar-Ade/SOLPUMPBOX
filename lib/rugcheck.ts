export type RugRisk = {
  name: string;
  description?: string;
  level?: string;
};

export type RugReport = {
  score_normalised?: number;
  risks: RugRisk[];
};

export type SafetyVerdict = 'clean' | 'caution' | 'danger';

export async function fetchRugReport(mint: string): Promise<RugReport> {
  const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
  if (!res.ok) throw new Error(`Safety report unavailable (${res.status})`);
  const data = (await res.json()) as { score_normalised?: number; risks?: RugRisk[] | null };
  return {
    score_normalised: typeof data.score_normalised === 'number' ? data.score_normalised : undefined,
    risks: Array.isArray(data.risks) ? data.risks.filter((r) => r && r.name) : [],
  };
}

export function safetyVerdict(report: RugReport): SafetyVerdict {
  const levels = report.risks.map((r) => r.level?.toLowerCase());
  if (levels.some((level) => level === 'danger' || level === 'critical')) return 'danger';
  if (levels.some((level) => level === 'warn' || level === 'warning')) return 'caution';
  return 'clean';
}

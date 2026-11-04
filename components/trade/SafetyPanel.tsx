'use client';

import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { fetchRugReport, safetyVerdict, type RugReport, type SafetyVerdict } from '@/lib/rugcheck';

type SafetyState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: RugReport; verdict: SafetyVerdict };

const VERDICT_STYLES: Record<SafetyVerdict, { label: string; className: string; Icon: typeof Shield }> = {
  clean: { label: 'No major risks flagged', className: 'border-pump-green/40 bg-pump-green/10 text-pump-green', Icon: ShieldCheck },
  caution: { label: 'Caution: review the flags below', className: 'border-amber-400/40 bg-amber-400/10 text-amber-300', Icon: ShieldAlert },
  danger: { label: 'High risk flagged', className: 'border-red-500/40 bg-red-500/10 text-red-300', Icon: ShieldAlert },
};

export function SafetyPanel({ mint }: { mint: string }) {
  const [state, setState] = useState<SafetyState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchRugReport(mint)
      .then((report) => {
        if (!cancelled) setState({ status: 'ready', report, verdict: safetyVerdict(report) });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof Error ? error.message : 'Safety report unavailable' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Safety check</h3>
        <span className="text-[11px] uppercase tracking-wider text-white/40">RugCheck</span>
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning token...
        </div>
      )}

      {state.status === 'error' && <p className="text-sm text-white/50">{state.message}</p>}

      {state.status === 'ready' && (
        <div className="space-y-3">
          {(() => {
            const style = VERDICT_STYLES[state.verdict];
            const { Icon } = style;
            return (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${style.className}`}>
                <Icon className="h-4 w-4 shrink-0" />
                {style.label}
              </div>
            );
          })()}
          {state.report.risks.length > 0 && (
            <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {state.report.risks.slice(0, 6).map((risk) => (
                <li key={risk.name} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="font-semibold text-white">{risk.name}</span>
                  {risk.description && <span className="block text-white/50">{risk.description}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

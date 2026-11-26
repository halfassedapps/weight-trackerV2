// Ported from V1's WeightChart table view (index.html:6386-6443), daily rows
// only — V2 doesn't have V1's separate "Show as Daily/Weekly/Monthly"
// aggregation toggle, so this always shows the real per-day rows (with
// their real 7-day rolling average), same as V1's 'daily' branch.
import { computeLogbook } from '../../../lib/domain/weightSeries';
import type { WeightEntry } from '../../../lib/gist/types';

interface TableProps {
  entries: WeightEntry[];
  viewStartMs: number;
  viewEndMs: number;
  doseAt: (ms: number) => number | null;
  colorForDose: (dose: number | null) => string;
  hideInjections?: boolean;
}

function fmtDateParts(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return { wd: d.toLocaleDateString('en-US', { weekday: 'short' }), md: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
}

export function Table({ entries, viewStartMs, viewEndMs, doseAt, colorForDose, hideInjections = false }: TableProps) {
  const rows = computeLogbook(entries)
    .map((r) => ({ ...r, ms: new Date(`${r.date}T12:00:00`).getTime() }))
    .filter((r) => r.ms >= viewStartMs && r.ms <= viewEndMs);

  if (!rows.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No weight data yet.</p>;
  }

  const cols = hideInjections ? '1.1fr 1fr 1fr' : '1.1fr 1fr 1fr .9fr';

  return (
    <div className="max-h-80 overflow-y-auto mx-3 rounded-lg border border-black/[.08]">
      <div className="grid px-2.5 py-1.5 bg-slate-100 border-b border-black/10 sticky top-0" style={{ gridTemplateColumns: cols }}>
        {['DATE', 'WEIGHT', '7-DAY AVG', ...(hideInjections ? [] : ['DOSE'])].map((h) => (
          <div key={h} className="text-[10px] font-bold tracking-wide text-slate-400">
            {h}
          </div>
        ))}
      </div>
      {rows.map((r) => {
        const { wd, md } = fmtDateParts(r.date);
        const dose = hideInjections ? null : doseAt(r.ms);
        return (
          <div key={r.date} className="grid px-2.5 py-1.5 text-[11px] border-b border-black/[.06] last:border-b-0" style={{ gridTemplateColumns: cols }}>
            <div className="text-slate-900 font-semibold">
              {wd} {md}
            </div>
            <div className="text-slate-900 font-semibold">{r.lbs.toFixed(1)} lbs</div>
            <div className="text-slate-400">{r.movAvg != null ? `${r.movAvg.toFixed(1)} lbs` : '—'}</div>
            {!hideInjections && (
              <div className="font-semibold" style={{ color: dose != null ? colorForDose(dose) : '#c7c7cc' }}>
                {dose != null ? `${dose} mg/wk` : '—'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

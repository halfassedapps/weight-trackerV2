// Ported from V1's BpChart table view (index.html:2501-2547) — flattens
// each day's readings into one row per reading, newest-first, with
// maintenance-toggle dividers.
import { bpCategory } from '../../../lib/domain/bloodPressure';
import { maintToggleLabel } from '../../../lib/domain/maintenance';
import type { MaintenanceHistoryEntry } from '../../../lib/gist/types';
import type { BpSeries } from './useBpSeries';

function fmtDateParts(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return { wd: d.toLocaleDateString('en-US', { weekday: 'short' }), md: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function Table({ series, maintenanceHistory }: { series: BpSeries; maintenanceHistory: MaintenanceHistoryEntry[] | undefined }) {
  const flatRows = [...series.points]
    .flatMap((day) => day.readings.map((r) => ({ date: day.date, ms: r.ms, systolic: r.systolic, diastolic: r.diastolic })))
    .sort((a, b) => b.ms - a.ms);

  if (!flatRows.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No readings in this range.</p>;
  }

  return (
    <div className="max-h-80 overflow-y-auto mx-3 rounded-lg border border-black/[.08]">
      <div className="grid grid-cols-[1.3fr_1fr_.8fr_.8fr] px-2.5 py-1.5 bg-slate-100 border-b border-black/10 sticky top-0">
        {['DATE', 'TIME', 'SYS', 'DIA'].map((h) => (
          <div key={h} className="text-[10px] font-bold tracking-wide text-slate-400">
            {h}
          </div>
        ))}
      </div>
      {flatRows.map((r, i) => {
        const { wd, md } = fmtDateParts(r.date);
        const cat = bpCategory(r.systolic, r.diastolic);
        const prevMs = i > 0 ? flatRows[i - 1].ms : Infinity;
        const maintHere = (maintenanceHistory ?? [])
          .filter((h) => {
            const ms = new Date(`${h.date}T12:00:00`).getTime();
            return ms <= prevMs && ms > r.ms;
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        return (
          <div key={r.ms}>
            {maintHere.map((h) => (
              <div key={h.date + h.action} className="px-2.5 py-1 text-[10.5px] font-bold text-blue-600 bg-blue-50 border-b border-black/[.06]">
                {maintToggleLabel(h.action)} · {md}
              </div>
            ))}
            <div
              title={cat.label}
              className="grid grid-cols-[1.3fr_1fr_.8fr_.8fr] px-2.5 py-1.5 text-[11px] border-b border-black/[.06] last:border-b-0"
              style={{ background: `${cat.color}1f` }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                <span className="text-slate-900 font-semibold">
                  {wd} {md}
                </span>
              </div>
              <div className="text-slate-400">{fmtTime(r.ms)}</div>
              <div className="font-semibold" style={{ color: '#e05252' }}>
                {Math.round(r.systolic)}
              </div>
              <div className="font-semibold" style={{ color: '#4a90d9' }}>
                {Math.round(r.diastolic)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

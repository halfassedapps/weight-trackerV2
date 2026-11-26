// Ported from V1's RidesChart table view, simplified: one row per day
// (V1 can expand a multi-activity day into its individual rides — not yet
// ported here, not a bug, see the project's known-gaps list).
import type { RidePoint } from './useRidesSeries';

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function dayLabel(p: RidePoint) {
  return p.rides.length > 1 ? `${p.rides.length} activities` : p.rides[0]?.sport && p.rides[0].sport !== 'Ride' ? `${p.rides[0].sport} · ${p.rides[0].name}` : (p.rides[0]?.name ?? 'Activity');
}

export function Table({ points }: { points: RidePoint[] }) {
  if (!points.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No ride data in this range.</p>;
  }

  const rows = [...points].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="max-h-80 overflow-y-auto mx-3 rounded-lg border border-black/[.08]">
      <div className="grid grid-cols-[1fr_1.4fr_.9fr_.8fr_.8fr] px-2.5 py-1.5 bg-slate-100 border-b border-black/10 sticky top-0">
        {['DATE', 'ACTIVITY', 'TIME', 'DIST', 'CAL'].map((h) => (
          <div key={h} className="text-[10px] font-bold tracking-wide text-slate-400">
            {h}
          </div>
        ))}
      </div>
      {rows.map((p, i) => (
        <div
          key={p.date}
          className="grid grid-cols-[1fr_1.4fr_.9fr_.8fr_.8fr] px-2.5 py-1.5 text-[11px] border-b border-black/[.06] last:border-b-0"
          style={i % 2 === 1 ? { background: '#f7f7f9' } : undefined}
        >
          <div className="text-slate-900 font-semibold">{new Date(`${p.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          <div className="text-slate-600 truncate">{dayLabel(p)}</div>
          <div className="text-slate-900 font-semibold">{fmtDur(p.totalDurSecs)}</div>
          <div className="text-slate-600">{(p.totalDistM / 1609.34).toFixed(1)} mi</div>
          <div className="text-slate-600">{Math.round(p.totalCal)}</div>
        </div>
      ))}
    </div>
  );
}

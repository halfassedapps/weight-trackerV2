// Ported from V1's RidesChart table view (index.html:2938-2997) — a
// multi-activity day collapses to one summary row ("4 activities") that
// expands into its individual rides. Simplified from V1: no click-through
// to the activity's intervals.icu page.
import { useState } from 'react';
import type { RideActivity } from '../../../lib/gist/types';
import type { RidePoint } from './useRidesSeries';

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function rideLabel(r: RideActivity) {
  return r.sport && r.sport !== 'Ride' && r.sport !== 'VirtualRide' ? `${r.sport} · ${r.name}` : r.name;
}

function dayGroupLabel(p: RidePoint) {
  return p.rides.length > 1 ? `${p.rides.length} activities` : rideLabel(p.rides[0]);
}

const GRID_COLS = '16px 1fr 1.4fr .9fr .8fr .8fr';

export function Table({ points }: { points: RidePoint[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!points.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No ride data in this range.</p>;
  }

  const rows = [...points].sort((a, b) => b.date.localeCompare(a.date));

  const toggle = (date: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="max-h-80 overflow-y-auto mx-3 rounded-lg border border-black/[.08]">
      <div className="grid px-2.5 py-1.5 bg-slate-100 border-b border-black/10 sticky top-0" style={{ gridTemplateColumns: GRID_COLS }}>
        {['', 'DATE', 'ACTIVITY', 'TIME', 'DIST', 'CAL'].map((h, i) => (
          <div key={i} className="text-[10px] font-bold tracking-wide text-slate-400">
            {h}
          </div>
        ))}
      </div>
      {rows.map((p, i) => {
        const multi = p.rides.length > 1;
        const isOpen = expanded.has(p.date);
        return (
          <div key={p.date}>
            <div
              onClick={multi ? () => toggle(p.date) : undefined}
              className="grid px-2.5 py-1.5 text-[11px] border-b border-black/[.06] last:border-b-0"
              style={{ gridTemplateColumns: GRID_COLS, background: i % 2 === 1 ? '#f7f7f9' : undefined, cursor: multi ? 'pointer' : undefined }}
            >
              <div className={`text-[9px] text-slate-300 ${multi ? 'visible' : 'invisible'}`}>{isOpen ? '▾' : '▸'}</div>
              <div className="text-slate-900 font-semibold">{new Date(`${p.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              <div className="text-slate-600 truncate">{dayGroupLabel(p)}</div>
              <div className="text-slate-900 font-semibold">{fmtDur(p.totalDurSecs)}</div>
              <div className="text-slate-600">{(p.totalDistM / 1609.34).toFixed(1)} mi</div>
              <div className="text-slate-600">{Math.round(p.totalCal)}</div>
            </div>
            {multi &&
              isOpen &&
              p.rides.map((r, ri) => (
                <div
                  key={r.id ?? `${p.date}-${ri}`}
                  className="grid px-2.5 py-1 text-[10.5px] border-b border-black/[.05] last:border-b-0 bg-[#fafafc]"
                  style={{ gridTemplateColumns: GRID_COLS }}
                >
                  <div />
                  <div />
                  <div className="text-slate-600 truncate">{rideLabel(r)}</div>
                  <div className="text-blue-600">{fmtDur(r.durSecs)}</div>
                  <div className="text-orange-500">{(r.distM / 1609.34).toFixed(1)} mi</div>
                  <div className="text-violet-500">{Math.round(r.cal)}</div>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

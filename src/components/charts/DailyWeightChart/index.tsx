import { useMemo, useState } from 'react';
import { useGistData } from '../../../hooks/useGistData';
import { buildDayOfWeekBars, computeDayOfWeekDeltas } from '../../../lib/domain/dayOfWeek';
import { computeLogbook } from '../../../lib/domain/weightSeries';
import { DayOfWeekDetailModal } from './DayOfWeekDetailModal';

const VW = 360;
const VH = 120;
const PAD = { t: 10, r: 14, b: 30, l: 36 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;

/** Avg daily weight-change-vs-prior-day, one bar per weekday — small enough
 * (per the project plan's splitting guidance) to keep data-fetch + render
 * in one file rather than a separate container/presentational pair. */
export function DailyWeightChart() {
  const { data: gist, isLoading, error } = useGistData();
  const [selectedDow, setSelectedDow] = useState<number | null>(null);

  const { dayDeltas, bars } = useMemo(() => {
    if (!gist || gist.entries.length < 2) return { dayDeltas: null, bars: null };
    const logbook = computeLogbook(gist.entries); // newest-first
    const deltas = computeDayOfWeekDeltas(logbook);
    return { dayDeltas: deltas, bars: buildDayOfWeekBars(deltas) };
  }, [gist]);

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!bars || !dayDeltas) return null;

  const hasData = bars.filter((b) => b.avg !== null);
  if (!hasData.length) return null;

  const maxAbs = Math.max(...hasData.map((b) => Math.abs(b.avg!)), 0.1);
  const yScale = maxAbs * 1.4;
  const zeroY = PAD.t + CH / 2;
  const yOf = (v: number) => zeroY - (v / yScale) * (CH / 2);

  const slotW = CW / 7;
  const barW = Math.max(8, slotW * 0.55);
  const xOf = (i: number) => PAD.l + (i + 0.5) * slotW;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="block w-full h-auto">
        <text x={PAD.l - 3} y={PAD.t + 5} textAnchor="end" fontSize={5} fill="#aeaeb2">
          +{maxAbs.toFixed(2)}
        </text>
        <text x={PAD.l - 3} y={zeroY + 2} textAnchor="end" fontSize={5} fill="#aeaeb2">
          0
        </text>
        <text x={PAD.l - 3} y={PAD.t + CH - 1} textAnchor="end" fontSize={5} fill="#aeaeb2">
          -{maxAbs.toFixed(2)}
        </text>

        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="rgba(0,0,0,.08)" strokeWidth={0.5} />
        <line x1={PAD.l} y1={zeroY} x2={PAD.l + CW} y2={zeroY} stroke="rgba(0,0,0,.18)" strokeWidth={0.8} />
        {[-maxAbs * 0.5, maxAbs * 0.5].map((v) => (
          <line key={v} x1={PAD.l} y1={yOf(v)} x2={PAD.l + CW} y2={yOf(v)} stroke="rgba(0,0,0,.05)" strokeWidth={0.5} />
        ))}

        {bars.map((b, i) => {
          if (b.avg === null) {
            return (
              <text key={b.dow} x={xOf(i)} y={PAD.t + CH + 10} textAnchor="middle" fontSize={5} fill="#d1d1d6">
                {b.wd}
              </text>
            );
          }
          const y = yOf(b.avg);
          const h = Math.max(1, Math.abs(zeroY - y));
          const top = b.avg < 0 ? zeroY : y;
          const col = b.avg < 0 ? '#34c759' : '#ff9500';
          const txtCol = b.avg < 0 ? '#1a7f3c' : '#c0392b';
          return (
            <g key={b.dow} onClick={() => setSelectedDow(b.dow)} className="cursor-pointer">
              <rect x={xOf(i) - slotW / 2} y={PAD.t} width={slotW} height={CH + 20} fill="#000" fillOpacity={0} />
              <rect x={xOf(i) - barW / 2} y={top} width={barW} height={h} rx={2} fill={col} opacity={0.82} />
              <text x={xOf(i)} y={b.avg < 0 ? top + h + 6 : top - 2} textAnchor="middle" fontSize={4.5} fontWeight={600} fill={txtCol}>
                {b.avg > 0 ? '+' : ''}
                {b.avg.toFixed(2)}
              </text>
              <text x={xOf(i)} y={PAD.t + CH + 11} textAnchor="middle" fontSize={6} fontWeight={600} fill="#3c3c43">
                {b.wd}
              </text>
              <text x={xOf(i)} y={PAD.t + CH + 20} textAnchor="middle" fontSize={4} fill="#c7c7cc">
                n={b.count}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="px-3.5 pb-2.5 text-center text-[9px] text-slate-400">
        Avg daily weight change vs prior day · green = loss · orange = gain · n = consecutive pairs · tap a day for details
      </div>

      {selectedDow !== null && (
        <DayOfWeekDetailModal dow={selectedDow} entries={dayDeltas[selectedDow]} onClose={() => setSelectedDow(null)} />
      )}
    </div>
  );
}

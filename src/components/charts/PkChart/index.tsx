import { useRef, useState } from 'react';
import { useGistData } from '../../../hooks/useGistData';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { DATA_RANGE_OPTIONS } from '../../../lib/domain/ranges';
import { Chart } from './Chart';
import { usePkSeries } from './usePkSeries';

const SPLIT_MANUAL_KEY = 'weight-tracker-v2:pk:splitManual';

export function PkChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('pk', 30);
  const [splitManual, setSplitManual] = useState(() => localStorage.getItem(SPLIT_MANUAL_KEY) === 'true');
  const series = usePkSeries(gist, range, splitManual);
  const svgRef = useRef<SVGSVGElement>(null);

  const toggleSplit = () => {
    const next = !splitManual;
    setSplitManual(next);
    try {
      localStorage.setItem(SPLIT_MANUAL_KEY, String(next));
    } catch {
      /* see useRangePicker's identical try/catch */
    }
  };

  const { shareChart, isSharing } = useChartPngExport(svgRef, {
    title: 'Tirzepatide · Drug on Board',
    subtitleLines: series
      ? [
          `On board now: ${series.curLevel.toFixed(2)} mg · Weekly dose: ${Math.round(series.weeklyDose * 10) / 10} mg`,
          `Trough: ${series.troughLevel.toFixed(2)} mg · ${new Date(series.nextInjMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        ]
      : [],
    filename: 'tirz-on-board.png',
    width: 360,
    height: 190,
  });

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist || !series) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-2 flex-wrap">
        <select
          value={range.days}
          onChange={(e) => range.setDays(Number(e.target.value))}
          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
        >
          {DATA_RANGE_OPTIONS.map((o) => (
            <option key={o.days} value={o.days}>
              {o.label}
            </option>
          ))}
        </select>
        {!series.scheduleActive && (
          <label className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-slate-600">
            <input type="checkbox" checked={splitManual} onChange={toggleSplit} />
            Split into 2x/week
          </label>
        )}
      </div>

      <Chart svgRef={svgRef} series={series} />

      <div className="flex gap-3 px-3 pt-2 text-xs flex-wrap">
        <Stat label="On board now" value={`${series.curLevel.toFixed(2)} mg`} color="text-blue-600" />
        <Stat
          label="Pre-dose trough"
          value={`${series.troughLevel.toFixed(2)} mg`}
          note={`(${new Date(series.nextInjMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`}
        />
        <Stat label="Half-life" value="5 days" />
      </div>
      <div className="flex gap-3 px-3 pt-1 pb-2 text-xs flex-wrap">
        <Stat label="Avg on board (period)" value={`${series.avgOnBoard.toFixed(2)} mg`} color="text-blue-600" />
        <Stat
          label="Weight change (period)"
          value={series.periodWeightChange != null ? `${series.periodWeightChange <= 0 ? '↓' : '↑'} ${Math.abs(series.periodWeightChange).toFixed(1)} lbs` : '—'}
          color={series.periodWeightChange != null && series.periodWeightChange <= 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {series.maintMarkers.length > 0 && (
        <div className="flex justify-center pb-1">
          <Legend color="#8e8e93" label="Maintenance toggle" dashed />
        </div>
      )}

      <div className="flex justify-center pb-3">
        <button
          type="button"
          onClick={shareChart}
          disabled={isSharing}
          className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600 disabled:opacity-60"
        >
          {isSharing ? 'Sharing…' : 'Share'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, note, color = 'text-slate-900' }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-semibold tabular-nums ${color}`}>{value}</div>
      {note && <div className="text-[9px] text-slate-400">{note}</div>}
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
      <svg width={12} height={8}>
        <line x1={0} y1={4} x2={12} y2={4} stroke={color} strokeWidth={1.5} strokeDasharray={dashed ? '2,2' : undefined} />
      </svg>
      {label}
    </span>
  );
}

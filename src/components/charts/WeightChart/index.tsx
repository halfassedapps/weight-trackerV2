import { useRef } from 'react';
import { useGistData } from '../../../hooks/useGistData';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { DATA_RANGE_OPTIONS } from '../../../lib/domain/ranges';
import { Chart } from './Chart';
import { useWeightSeries } from './useWeightSeries';

export function WeightChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('weight', 0);
  const series = useWeightSeries(gist, range);
  const svgRef = useRef<SVGSVGElement>(null);
  const { shareChart, isSharing } = useChartPngExport(svgRef, {
    title: 'My Weight Trend',
    subtitleLines: series.stats
      ? [
          `Starting: ${series.stats.startLbs.toFixed(1)} lbs · Current: ${series.stats.currentLbs.toFixed(1)} lbs`,
          `↓ ${series.stats.totalLost.toFixed(1)} lbs lost (${series.stats.pctBodyLost.toFixed(1)}%) · ${series.stats.pctToGoal.toFixed(1)}% to goal`,
        ]
      : [],
    filename: 'weight-trend.png',
    width: 360,
    height: 200,
  });

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-2">
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
      </div>

      {series.stats && (
        <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs">
          <Stat label="Current" value={`${series.stats.currentLbs.toFixed(1)} lbs`} />
          <Stat label="Lost" value={`${series.stats.totalLost.toFixed(1)} lbs`} color="text-green-600" />
          <Stat label="% to goal" value={`${series.stats.pctToGoal.toFixed(1)}%`} color="text-green-600" />
          <Stat label="% body wt" value={`${series.stats.pctBodyLost.toFixed(1)}%`} color="text-green-600" />
        </div>
      )}

      <Chart svgRef={svgRef} series={series} goalLbs={gist.goalLbs} maintenanceDriftLbs={gist.maintenanceDriftLbs} />

      <div className="flex items-center justify-center gap-3 px-3 py-2 text-[10px] text-slate-500">
        <Legend color="#4a90d9" label="Weight" />
        <Legend color="#34c759" label="Goal" dashed />
        {series.maintMarkers.length > 0 && <Legend color="#8e8e93" label="Maintenance toggle" dashed />}
      </div>

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

function Stat({ label, value, color = 'text-slate-900' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width={12} height={8}>
        <line x1={0} y1={4} x2={12} y2={4} stroke={color} strokeWidth={1.5} strokeDasharray={dashed ? '2,2' : undefined} />
      </svg>
      {label}
    </span>
  );
}

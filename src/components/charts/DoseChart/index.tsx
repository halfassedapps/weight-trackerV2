import { useRef, useState } from 'react';
import { useGistData } from '../../../hooks/useGistData';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { DATA_RANGE_OPTIONS } from '../../../lib/domain/ranges';
import { Chart } from './Chart';
import { useDoseSeries } from './useDoseSeries';

const SHOW_WEIGHT_KEY = 'weight-tracker-v2:dose:showWeight';

export function DoseChart() {
  const { data: gist, isLoading, error } = useGistData();
  const range = useRangePicker('dose', 0);
  const series = useDoseSeries(gist, range);
  const svgRef = useRef<SVGSVGElement>(null);
  const [showWeight, setShowWeight] = useState(() => localStorage.getItem(SHOW_WEIGHT_KEY) !== 'false');

  const toggleShowWeight = (v: boolean) => {
    setShowWeight(v);
    try {
      localStorage.setItem(SHOW_WEIGHT_KEY, String(v));
    } catch {
      /* see useRangePicker's identical try/catch */
    }
  };

  const { shareChart, isSharing } = useChartPngExport(svgRef, {
    title: 'Weekly Dose',
    subtitleLines: series ? [`Current: ${series.currentDoseMg != null ? Math.round(series.currentDoseMg * 10) / 10 : '—'} mg/wk`] : [],
    filename: 'dose-chart.png',
    width: 360,
    height: 200,
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
        <label className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-slate-600">
          <input type="checkbox" checked={showWeight} onChange={(e) => toggleShowWeight(e.target.checked)} />
          Show weight
        </label>
      </div>

      <Chart svgRef={svgRef} series={series} showWeight={showWeight} />

      <div className="flex items-center justify-center gap-3 px-3 py-2 text-[10px] text-slate-500 flex-wrap">
        <Legend color="#4a90d9" label="Weekly dose" />
        {showWeight && <Legend color="#34c759" label="Weight" />}
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

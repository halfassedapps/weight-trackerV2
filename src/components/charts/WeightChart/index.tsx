import { useRef, useState } from 'react';
import { Card } from '../../Card';
import { ChartLegendSwatch } from '../shared/ChartLegendSwatch';
import { ChartShareButton } from '../shared/ChartShareButton';
import { RangePickerSelect } from '../shared/RangePickerSelect';
import { Stat } from '../shared/Stat';
import { useAuth } from '../../../hooks/useAuth';
import { useGistData } from '../../../hooks/useGistData';
import { useGistWrite } from '../../../hooks/useGistWrite';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { Chart } from './Chart';
import { useWeightSeries } from './useWeightSeries';

interface WeightChartProps {
  /** Share view only — forces view-only (no admin editing) and hides
   * per-dose line coloring, regardless of the viewer's own auth state. */
  forceViewOnly?: boolean;
}

export function WeightChart({ forceViewOnly = false }: WeightChartProps = {}) {
  const { data: gist, isLoading, error } = useGistData();
  const { isAdmin: realIsAdmin } = useAuth();
  const isAdmin = forceViewOnly ? false : realIsAdmin;
  const gistWrite = useGistWrite();
  const range = useRangePicker('weight', 0);
  const series = useWeightSeries(gist, range);
  const svgRef = useRef<SVGSVGElement>(null);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [editingDrift, setEditingDrift] = useState(false);
  const [driftDraft, setDriftDraft] = useState('');
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

  // Admin-only inline edits for goalLbs/maintenanceDriftLbs — commits only on
  // a real, valid change (ported from V1's commitGoal/commitDrift), via the
  // one shared writeGist path every admin mutation in this app goes through.
  const commitGoal = () => {
    const n = parseFloat(goalDraft);
    setEditingGoal(false);
    if (!Number.isFinite(n) || n <= 0 || n === gist.goalLbs) return;
    gistWrite.mutate((current) => ({ ...current, goalLbs: n }));
  };

  const commitDrift = () => {
    const n = parseFloat(driftDraft);
    setEditingDrift(false);
    if (!Number.isFinite(n) || n <= 0) return;
    // Enforce the 0.5 lb increment server-side too — the input's own
    // step="0.5" only guides the browser's spinner.
    const snapped = Math.round(n * 2) / 2;
    if (snapped === gist.maintenanceDriftLbs) return;
    gistWrite.mutate((current) => ({ ...current, maintenanceDriftLbs: snapped }));
  };

  return (
    <Card>
      <div className="flex items-center gap-2 px-3 pt-2">
        <RangePickerSelect days={range.days} onChange={range.setDays} />
      </div>

      {series.stats && (
        <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs">
          <Stat label="Current" value={`${series.stats.currentLbs.toFixed(1)} lbs`} />
          <Stat label="Lost" value={`${series.stats.totalLost.toFixed(1)} lbs`} color="#16a34a" />
          <Stat label="% to goal" value={`${series.stats.pctToGoal.toFixed(1)}%`} color="#16a34a" />
          <Stat label="% body wt" value={`${series.stats.pctBodyLost.toFixed(1)}%`} color="#16a34a" />
        </div>
      )}

      {isAdmin && (
        <div className="flex items-center justify-center gap-2 px-3 pb-1 text-xs">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Goal</span>
          {editingGoal ? (
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                step={0.5}
                min={1}
                autoFocus
                defaultValue={gist.goalLbs}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitGoal();
                  if (e.key === 'Escape') setEditingGoal(false);
                }}
                className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center text-xs font-semibold tabular-nums"
              />
              <button type="button" onClick={commitGoal} aria-label="Save goal" className="text-green-600">
                ✓
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setGoalDraft(String(gist.goalLbs));
                setEditingGoal(true);
              }}
              className="font-semibold tabular-nums text-slate-900 underline decoration-dotted decoration-slate-300 underline-offset-2"
            >
              {gist.goalLbs} lbs
            </button>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex items-center justify-center gap-1 px-3 pb-2 text-[10.5px] text-slate-400">
          <span>Maintenance range: ±</span>
          {editingDrift ? (
            <span className="flex items-center gap-1">
              <input
                type="number"
                step={0.5}
                min={0.5}
                autoFocus
                defaultValue={gist.maintenanceDriftLbs}
                onChange={(e) => setDriftDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDrift();
                  if (e.key === 'Escape') setEditingDrift(false);
                }}
                className="w-10 rounded border border-slate-300 px-1 py-0.5 text-center text-[10.5px] font-semibold tabular-nums"
              />
              <button type="button" onClick={commitDrift} aria-label="Save maintenance range" className="text-green-600">
                ✓
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDriftDraft(String(gist.maintenanceDriftLbs));
                setEditingDrift(true);
              }}
              className="font-semibold tabular-nums text-slate-600 underline decoration-dotted decoration-slate-300 underline-offset-2"
            >
              {gist.maintenanceDriftLbs}
            </button>
          )}
          <span>lbs</span>
        </div>
      )}

      <Chart svgRef={svgRef} series={series} goalLbs={gist.goalLbs} maintenanceDriftLbs={gist.maintenanceDriftLbs} hideInjections={forceViewOnly} />

      <div className="flex items-center justify-center gap-3 px-3 py-2 text-[10px] text-slate-500">
        <ChartLegendSwatch color="#4a90d9" label="Weight" />
        <ChartLegendSwatch color="#34c759" label="Goal" dashed />
        {series.maintMarkers.length > 0 && <ChartLegendSwatch color="#8e8e93" label="Maintenance toggle" dashed />}
      </div>

      <ChartShareButton onClick={shareChart} isSharing={isSharing} />
    </Card>
  );
}

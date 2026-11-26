import { useRef, useState } from 'react';
import { Card } from '../../Card';
import { CopyLinkButton } from '../../CopyLinkButton';
import { InfoDot } from '../../InfoDot';
import { ChartLegendSwatch } from '../shared/ChartLegendSwatch';
import { ChartShareButton } from '../shared/ChartShareButton';
import { GraphTableToggle } from '../shared/GraphTableToggle';
import { RangePickerSelect } from '../shared/RangePickerSelect';
import { Stat } from '../shared/Stat';
import { useAuth } from '../../../hooks/useAuth';
import { useGistData } from '../../../hooks/useGistData';
import { useGistWrite } from '../../../hooks/useGistWrite';
import { useRangePicker } from '../../../hooks/useRangePicker';
import { useChartPngExport } from '../../../hooks/useChartPngExport';
import { useViewMode } from '../../../hooks/useViewMode';
import { BMI_RANGES, bmiCategory, lbsAtBmi } from '../../../lib/domain/format';
import { TREND_PERIOD_OPTIONS, type AggregateId } from '../../../lib/domain/trendLine';
import { safeSetItem } from '../../../lib/storage';
import { Chart } from './Chart';
import { Table } from './Table';
import { TrendLinesMenu } from './TrendLinesMenu';
import { useWeightSeries } from './useWeightSeries';

const LS_AGGREGATE_KEY = 'weight-tracker-v2:weight:aggregate';
const LS_TREND_DAYS_KEY = 'weight-tracker-v2:weight:trendDays';
const LS_TREND_MODES_KEY = 'weight-tracker-v2:weight:trendModes';
const LS_SHOW_INJECTIONS_KEY = 'weight-tracker-v2:weight:showInjections';

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
  const { mode, setMode } = useViewMode('weight');
  const [aggregate, setAggregateState] = useState<AggregateId>(() => (localStorage.getItem(LS_AGGREGATE_KEY) as AggregateId) || 'daily');
  const [trendDays, setTrendDaysState] = useState(() => parseInt(localStorage.getItem(LS_TREND_DAYS_KEY) || '', 10) || 21);
  const [trendModes, setTrendModesState] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_TREND_MODES_KEY) || '["current"]');
    } catch {
      return ['current'];
    }
  });
  const [showInjections, setShowInjectionsState] = useState(() => localStorage.getItem(LS_SHOW_INJECTIONS_KEY) !== 'false');
  const setAggregate = (v: AggregateId) => {
    setAggregateState(v);
    safeSetItem(LS_AGGREGATE_KEY, v);
  };
  const setTrendDays = (v: number) => {
    setTrendDaysState(v);
    safeSetItem(LS_TREND_DAYS_KEY, String(v));
  };
  const setTrendModes = (v: string[]) => {
    setTrendModesState(v);
    safeSetItem(LS_TREND_MODES_KEY, JSON.stringify(v));
  };
  const setShowInjections = (v: boolean) => {
    setShowInjectionsState(v);
    safeSetItem(LS_SHOW_INJECTIONS_KEY, String(v));
  };
  const series = useWeightSeries(gist, range, { aggregate, trendDays, trendModes });
  const svgRef = useRef<SVGSVGElement>(null);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [editingDrift, setEditingDrift] = useState(false);
  const [driftDraft, setDriftDraft] = useState('');
  const [editingHeight, setEditingHeight] = useState(false);
  const [heightDraft, setHeightDraft] = useState('');
  const { shareChart, downloadChart, isSharing, isDownloading } = useChartPngExport(svgRef, {
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

  const commitHeight = () => {
    const n = parseFloat(heightDraft);
    setEditingHeight(false);
    if (!Number.isFinite(n) || n <= 0 || n === gist.heightIn) return;
    gistWrite.mutate((current) => ({ ...current, heightIn: n }));
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <RangePickerSelect days={range.days} onChange={range.setDays} />
        <GraphTableToggle mode={mode} onChange={setMode} />
      </div>

      {series.stats &&
        (() => {
          const { periodLoss, periodLabel } = series.stats;
          const bmi = (703 * series.stats.currentLbs) / (gist.heightIn * gist.heightIn);
          const bmiCat = bmiCategory(bmi);
          return (
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:flex sm:gap-1 px-3 py-2.5 text-center">
              <div className="sm:flex-1 min-w-0">
                <Stat label="Starting" value={`${series.stats.startLbs.toFixed(1)} lbs`} />
              </div>
              <div className="sm:flex-1 min-w-0">
                <Stat label="Current" value={`${series.stats.currentLbs.toFixed(1)} lbs`} />
              </div>
              {periodLoss != null && (
                <div className="sm:flex-1 min-w-0">
                  <Stat
                    label="Weight loss"
                    value={`${periodLoss >= 0 ? '↓' : '↑'}${Math.abs(periodLoss).toFixed(1)} lbs`}
                    note={periodLabel}
                    color={periodLoss >= 0 ? '#16a34a' : '#dc2626'}
                  />
                </div>
              )}
              <div className="sm:flex-1 min-w-0">
                <Stat label="Goal" value={`${gist.goalLbs} lbs`} />
              </div>
              <div className="sm:flex-1 min-w-0">
                <Stat label="% to goal" value={`${series.stats.pctToGoal.toFixed(1)}%`} color="#16a34a" />
              </div>
              <div className="sm:flex-1 min-w-0">
                <Stat label="Lost" value={`${series.stats.totalLost.toFixed(1)} lbs`} color="#16a34a" />
              </div>
              <div className="sm:flex-1 min-w-0">
                <Stat label="% body wt" value={`${series.stats.pctBodyLost.toFixed(1)}%`} color="#16a34a" />
              </div>
              <div className="sm:flex-1 min-w-0">
                <div className="text-[clamp(9px,0.9vw,12px)] uppercase tracking-wide text-slate-400 flex items-center justify-center">
                  BMI
                  <InfoDot>
                    <div className="font-bold mb-1.5">BMI categories</div>
                    {BMI_RANGES.map((r) => {
                      // Weight bounds at this user's own height — the -0.1 only
                      // applies to a genuinely two-sided row (r.min > 0), so the
                      // two columns describe the same cutoff r.range already uses.
                      const lbsLo = Math.round(lbsAtBmi(r.min, gist.heightIn));
                      const lbsHi = !Number.isFinite(r.max) ? null : Math.round(lbsAtBmi(r.min > 0 ? r.max - 0.1 : r.max, gist.heightIn));
                      const lbsRange = r.min <= 0 ? `Below ${lbsHi} lbs` : lbsHi == null ? `${lbsLo}+ lbs` : `${lbsLo} – ${lbsHi} lbs`;
                      return (
                        <div key={r.label} className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                          <span className="flex-1">{r.label}</span>
                          <span className="text-right">
                            <div className="text-slate-400">{r.range}</div>
                            <div className="text-[10px] text-slate-500 mt-px">{lbsRange}</div>
                          </span>
                        </div>
                      );
                    })}
                    {isAdmin && (
                      <div className="mt-2 pt-2 border-t border-white/15 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-slate-400">Height (in)</span>
                        {editingHeight ? (
                          <>
                            <input
                              type="number"
                              step={0.5}
                              min={1}
                              autoFocus
                              value={heightDraft}
                              onChange={(e) => setHeightDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitHeight();
                                if (e.key === 'Escape') setEditingHeight(false);
                              }}
                              className="w-11 text-[11px] text-center rounded border border-slate-500 px-0.5 py-px bg-[#1c1c1e] text-white"
                            />
                            <button type="button" onClick={commitHeight} aria-label="Save height" className="text-green-500">
                              ✓
                            </button>
                          </>
                        ) : (
                          <span
                            onClick={() => {
                              setHeightDraft(String(gist.heightIn));
                              setEditingHeight(true);
                            }}
                            className="font-bold cursor-pointer underline decoration-dotted decoration-slate-400"
                          >
                            {gist.heightIn}
                          </span>
                        )}
                      </div>
                    )}
                  </InfoDot>
                </div>
                <div className="font-semibold tabular-nums text-[clamp(0.875rem,1.7vw,1.5rem)]" style={{ color: bmiCat.color }}>
                  {bmi.toFixed(1)}
                </div>
                <div className="text-[clamp(9px,0.9vw,12px)] text-slate-400">{bmiCat.label}</div>
              </div>
            </div>
          );
        })()}

      <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-3 pb-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-500">Show as</span>
          <select
            value={aggregate}
            onChange={(e) => setAggregate(e.target.value as AggregateId)}
            className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-700"
          >
            {series.availableAggregates.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-500">Trend period</span>
          <select
            value={trendDays}
            onChange={(e) => setTrendDays(Number(e.target.value))}
            className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-700"
          >
            {TREND_PERIOD_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
        <TrendLinesMenu checked={trendModes} onChange={setTrendModes} />
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer">
          <input type="checkbox" checked={showInjections} onChange={(e) => setShowInjections(e.target.checked)} className="accent-blue-600" />
          Show injection data
        </label>
      </div>

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

      {mode === 'table' ? (
        <Table
          entries={gist.entries}
          viewStartMs={series.viewStartMs}
          viewEndMs={series.viewEndMs}
          doseAt={series.doseAt}
          colorForDose={series.colorForDose}
          hideInjections={forceViewOnly || !showInjections}
        />
      ) : (
        <Chart
          svgRef={svgRef}
          series={series}
          goalLbs={gist.goalLbs}
          maintenanceDriftLbs={gist.maintenanceDriftLbs}
          hideInjections={forceViewOnly || !showInjections}
        />
      )}

      <div className="flex items-center justify-center gap-3 px-3 py-2 text-[10px] text-slate-500 flex-wrap">
        <ChartLegendSwatch color="#4a90d9" label="Weight" />
        <ChartLegendSwatch color="#34c759" label="Goal" dashed />
        {series.maintMarkers.length > 0 && <ChartLegendSwatch color="#8e8e93" label="Maintenance toggle" dashed />}
        {mode === 'graph' && series.trendLines.map((t) => <ChartLegendSwatch key={t.id} color={t.color} label={t.label} dashed />)}
      </div>

      <div className="flex items-start justify-center gap-2">
        <ChartShareButton onShare={shareChart} onDownload={downloadChart} isSharing={isSharing} isDownloading={isDownloading} />
        {/* Matches ChartShareButton's own wrapper (flex justify-center pb-3)
            exactly, rather than relying on the row's cross-axis centering to
            line the two buttons up — ChartShareButton's wrapper carries a
            bottom-padding other callers need (it's reused standalone, not
            just here), and centering two differently-padded boxes against
            each other is what left them visibly offset before. */}
        {!forceViewOnly && isAdmin && (
          <div className="flex justify-center pb-3">
            <CopyLinkButton />
          </div>
        )}
      </div>
    </Card>
  );
}

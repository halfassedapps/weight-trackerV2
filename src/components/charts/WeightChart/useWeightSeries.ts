// Derived-data layer for WeightChart — kept separate from rendering so it's
// unit-testable without mounting React, same principle the project plan
// calls out for this component specifically (V1's 1,834-line WeightChart
// mixed this with SVG rendering throughout).
//
// Deliberately smaller than V1's WeightChart for this first pass: no
// annotations (vacation/sick pills) and no horizontal-scroll mode for
// multi-year/goal-projected ranges (the chart stays fit-to-container-width
// regardless of how far a projection pushes the x-domain out). Trend-line
// regression/projection (Trend period + Trend Lines) and the Show-as
// aggregation are ported — see trendLine.ts.
import { useMemo } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs } from '../../../lib/domain/ranges';
import { buildWeeklyDoseCycles, doseActiveAt, getDoseSchedule } from '../../../lib/domain/dosing';
import { deriveMaintenanceState, visibleMaintMarkers, type MaintenanceMarker } from '../../../lib/domain/maintenance';
import { DOSE_PALETTE } from '../../../lib/theme';
import { AGGREGATE_OPTIONS, binPtsByUnit, buildTrendLines, fitTrendLine, type AggregateId, type TrendLineSeries } from '../../../lib/domain/trendLine';
import { computeLogbook, toLbs } from '../../../lib/domain/weightSeries';
import type { GistPayload } from '../../../lib/gist/types';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

export interface WeightPoint {
  ms: number;
  lbs: number;
  date: string;
}

export interface DisplayPoint {
  ms: number;
  lbs: number;
  /** >1 for an aggregated (weekly/monthly) bucket — number of raw readings it averages. */
  n: number;
}

export interface WeightSeriesStats {
  startLbs: number;
  currentLbs: number;
  totalLost: number;
  pctBodyLost: number;
  pctToGoal: number;
  /** Change over the selected Trend period window (negative = loss), for the "Weight loss" stat. */
  periodLoss: number | null;
  periodLabel: string;
}

export interface WeightChartControls {
  aggregate: AggregateId;
  trendDays: number;
  trendModes: string[];
}

export interface DoseChange {
  ms: number;
  doseMg: number;
}

export interface WeightSeries {
  /** oldest-first, filtered to the selected Data range — always the real
   * daily readings, regardless of `aggregate` (use `displayPts` for what's drawn). */
  points: WeightPoint[];
  /** One entry per weekly-dose change (not every injection) — feeds the
   * floating dose-callout pills above the line. */
  doseChanges: DoseChange[];
  /** What the chart line/table actually plots — raw `points` when aggregate
   * is 'daily', or weekly/monthly bucket averages otherwise. */
  displayPts: DisplayPoint[];
  trendLines: TrendLineSeries[];
  /** Weekly/Monthly only appear once the Data range is long enough for them to mean anything. */
  availableAggregates: typeof AGGREGATE_OPTIONS;
  /** which weekly dose (mg) was active at a given ms, or null before any logged dose */
  doseAt: (ms: number) => number | null;
  /** true if `ms` falls inside a maintenance period (current or historical) */
  modeAtMs: (ms: number) => 'maintenance' | 'weightloss';
  maintMarkers: MaintenanceMarker[];
  stats: WeightSeriesStats | null;
  viewStartMs: number;
  viewEndMs: number;
  /** One color per distinct weekly dose, assigned in first-seen order — shared
   * by the graph (per-dose line segments) and the table (DOSE column). */
  colorForDose: (dose: number | null) => string;
}

const TREND_PERIOD_PHRASE: Record<number, string> = {
  14: 'last 2 weeks',
  21: 'last 3 weeks',
  30: 'last month',
  42: 'last 6 weeks',
  90: 'last 3 months',
  0: 'all time',
};

function lbsAtMs(pts: { ms: number; lbs: number }[], ms: number): number {
  if (ms <= pts[0].ms) return pts[0].lbs;
  if (ms >= pts[pts.length - 1].ms) return pts[pts.length - 1].lbs;
  for (let i = 0; i < pts.length - 1; i++) {
    if (ms >= pts[i].ms && ms <= pts[i + 1].ms) {
      const f = (ms - pts[i].ms) / (pts[i + 1].ms - pts[i].ms);
      return pts[i].lbs + (pts[i + 1].lbs - pts[i].lbs) * f;
    }
  }
  return pts[pts.length - 1].lbs;
}

export function useWeightSeries(gist: GistPayload | undefined, range: UseRangePickerResult, controls: WeightChartControls): WeightSeries {
  return useMemo(() => {
    const todayMs = new Date().setHours(12, 0, 0, 0);

    if (!gist || gist.entries.length < 2) {
      return {
        points: [],
        doseChanges: [],
        displayPts: [],
        trendLines: [],
        availableAggregates: AGGREGATE_OPTIONS,
        doseAt: () => null,
        modeAtMs: () => 'weightloss',
        maintMarkers: [],
        stats: null,
        viewStartMs: todayMs,
        viewEndMs: todayMs,
        colorForDose: () => '#4a90d9',
      };
    }

    const logbook = computeLogbook(gist.entries); // newest-first
    const allPoints: WeightPoint[] = [...logbook].reverse().map((r) => ({
      ms: new Date(`${r.date}T12:00:00`).getTime(),
      lbs: r.lbs,
      date: r.date,
    }));
    // Lifetime first point — the regression's origin and the Starting-weight
    // stat both anchor here regardless of the Data range selector, same as
    // V1: zooming the view never changes what "Starting" or the trend line
    // mean, only how much of the chart is currently drawn.
    const startMs = allPoints[0].ms;

    const customRange = range.days === CUSTOM_RANGE_DAYS ? customDateRangeMs(range.customStart, range.customEnd) : null;
    const rangeCutoffMs = customRange ? customRange.start : range.days > 0 ? todayMs - range.days * 86400000 : 0;
    const rangeUpperMs = customRange ? customRange.end : Infinity;
    const filtered = range.days > 0 || customRange ? allPoints.filter((p) => p.ms >= rangeCutoffMs && p.ms <= rangeUpperMs) : allPoints;
    const points = filtered.length ? filtered : allPoints.slice(-1);

    const rawViewStartMs = points[0].ms;
    const rawViewEndMs = Math.min(todayMs, points[points.length - 1].ms);

    // Show-as aggregation gating: Weekly/Monthly only once the selected
    // range is long enough to make them meaningful (a 2-week Monthly view
    // would average almost everything into one point).
    const effectiveRangeDays = customRange ? Math.round((customRange.end - customRange.start) / 86400000) : range.days;
    const availableAggregates = AGGREGATE_OPTIONS.filter((o) => effectiveRangeDays === 0 || effectiveRangeDays >= o.minDays);
    const aggregate = availableAggregates.some((o) => o.id === controls.aggregate) ? controls.aggregate : 'daily';
    const displayPts: DisplayPoint[] =
      aggregate === 'daily' ? points.map((p) => ({ ms: p.ms, lbs: p.lbs, n: 1 })) : binPtsByUnit(points, aggregate === 'weekly' ? 'week' : 'month', rawViewStartMs);

    // Trend period + Trend Lines — regression fit over the full lifetime
    // series (never just the Data-range-filtered view), per V1.
    const fit = fitTrendLine(allPoints, startMs, controls.trendDays, todayMs);
    const trendLines = buildTrendLines(controls.trendModes, fit, startMs, todayMs, gist.goalLbs);
    const latestGoalMs = trendLines.map((l) => l.goalMs).filter((g): g is number => g != null);
    const maxFutureMs = Math.max(todayMs - startMs, 90 * 86400000);
    const projectedEndMs = latestGoalMs.length ? Math.min(Math.max(...latestGoalMs) + 14 * 86400000, todayMs + maxFutureMs) : null;
    const viewStartMs = rawViewStartMs;
    const viewEndMs = customRange ? rawViewEndMs : Math.max(rawViewEndMs, projectedEndMs ?? 0);

    const ds = getDoseSchedule(gist.injections, gist.injSchedule, false);
    const doseCycles = buildWeeklyDoseCycles(gist.injections, ds);
    const doseAt = (ms: number) => doseActiveAt(doseCycles, ms);
    const doseChanges: DoseChange[] = doseCycles.map((c) => ({ ms: c.startMs, doseMg: c.doseMg }));

    const { maintenancePeriods } = deriveMaintenanceState(gist.maintenanceHistory, todayMs);
    const chartPeriods = maintenancePeriods.map((p) => (p.ongoing ? { ...p, endMs: viewEndMs } : p));
    const modeAtMs = (ms: number): 'maintenance' | 'weightloss' =>
      chartPeriods.some((p) => ms >= p.startMs && ms <= p.endMs) ? 'maintenance' : 'weightloss';

    const maintMarkers = visibleMaintMarkers(gist.maintenanceHistory, viewStartMs, viewEndMs);

    const doseColorMap = new Map<number, string>();
    for (const p of points) {
      const dose = doseAt(p.ms);
      if (dose != null && !doseColorMap.has(dose)) doseColorMap.set(dose, DOSE_PALETTE[doseColorMap.size % DOSE_PALETTE.length]);
    }
    const colorForDose = (dose: number | null) => (dose == null ? '#8e8e93' : (doseColorMap.get(dose) ?? '#4a90d9'));

    // Stats are lifetime-based (allPoints), not scoped by the Data range
    // selector — "Starting" always means when tracking began, not the start
    // of whatever window happens to be visible.
    const startLbs = allPoints[0].lbs;
    const currentLbs = allPoints[allPoints.length - 1].lbs;
    const totalLost = startLbs - currentLbs;
    const pctBodyLost = (totalLost / startLbs) * 100;
    const pctToGoal = Math.min((totalLost / (startLbs - gist.goalLbs)) * 100, 100);
    const periodCutoffMs = controls.trendDays > 0 ? todayMs - controls.trendDays * 86400000 : 0;
    const periodLoss = lbsAtMs(allPoints, periodCutoffMs) - currentLbs;

    return {
      points,
      doseChanges,
      displayPts,
      trendLines,
      availableAggregates,
      doseAt,
      modeAtMs,
      maintMarkers,
      stats: {
        startLbs,
        currentLbs,
        totalLost,
        pctBodyLost,
        pctToGoal,
        periodLoss,
        periodLabel: TREND_PERIOD_PHRASE[controls.trendDays] ?? '',
      },
      viewStartMs,
      viewEndMs,
      colorForDose,
    };
  }, [gist, range.days, range.customStart, range.customEnd, controls.aggregate, controls.trendDays, controls.trendModes]);
}

export { toLbs };

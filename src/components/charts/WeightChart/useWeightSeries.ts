// Derived-data layer for WeightChart — kept separate from rendering so it's
// unit-testable without mounting React, same principle the project plan
// calls out for this component specifically (V1's 1,834-line WeightChart
// mixed this with SVG rendering throughout).
//
// Deliberately smaller than V1's WeightChart for this first pass: no
// trend-line regression/projection menu, no annotations (vacation/sick
// pills), no horizontal-scroll mode for multi-year ranges. Those are V1
// features not yet ported, not bugs — see the project plan's phasing.
import { useMemo } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs } from '../../../lib/domain/ranges';
import { buildWeeklyDoseCycles, doseActiveAt, getDoseSchedule } from '../../../lib/domain/dosing';
import { deriveMaintenanceState, visibleMaintMarkers, type MaintenanceMarker } from '../../../lib/domain/maintenance';
import { computeLogbook, toLbs } from '../../../lib/domain/weightSeries';
import type { GistPayload } from '../../../lib/gist/types';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

export interface WeightPoint {
  ms: number;
  lbs: number;
  date: string;
}

export interface WeightSeriesStats {
  startLbs: number;
  currentLbs: number;
  totalLost: number;
  pctBodyLost: number;
  pctToGoal: number;
}

export interface WeightSeries {
  /** oldest-first, filtered to the selected range */
  points: WeightPoint[];
  /** which weekly dose (mg) was active at a given ms, or null before any logged dose */
  doseAt: (ms: number) => number | null;
  /** true if `ms` falls inside a maintenance period (current or historical) */
  modeAtMs: (ms: number) => 'maintenance' | 'weightloss';
  maintMarkers: MaintenanceMarker[];
  stats: WeightSeriesStats | null;
  viewStartMs: number;
  viewEndMs: number;
}

const DOSE_PALETTE = ['#4a90d9', '#34c759', '#ff9500', '#ff3b30', '#b06dff', '#00c7be', '#ff2d55', '#5856d6', '#ffcc00', '#8e8e93'];

export function colorForDose(doseMg: number | null, doseColorMap: Map<number, string>): string {
  if (doseMg == null) return '#c7c7cc';
  return doseColorMap.get(doseMg) ?? '#4a90d9';
}

export function useWeightSeries(gist: GistPayload | undefined, range: UseRangePickerResult): WeightSeries {
  return useMemo(() => {
    const todayMs = new Date().setHours(12, 0, 0, 0);

    if (!gist || gist.entries.length < 2) {
      return {
        points: [],
        doseAt: () => null,
        modeAtMs: () => 'weightloss',
        maintMarkers: [],
        stats: null,
        viewStartMs: todayMs,
        viewEndMs: todayMs,
      };
    }

    const logbook = computeLogbook(gist.entries); // newest-first
    const allPoints: WeightPoint[] = [...logbook].reverse().map((r) => ({
      ms: new Date(`${r.date}T12:00:00`).getTime(),
      lbs: r.lbs,
      date: r.date,
    }));

    const customRange = range.days === CUSTOM_RANGE_DAYS ? customDateRangeMs(range.customStart, range.customEnd) : null;
    const rangeCutoffMs = customRange ? customRange.start : range.days > 0 ? todayMs - range.days * 86400000 : 0;
    const rangeUpperMs = customRange ? customRange.end : Infinity;
    const filtered = range.days > 0 || customRange ? allPoints.filter((p) => p.ms >= rangeCutoffMs && p.ms <= rangeUpperMs) : allPoints;
    const points = filtered.length ? filtered : allPoints.slice(-1);

    const viewStartMs = points[0].ms;
    const viewEndMs = Math.min(todayMs, points[points.length - 1].ms);

    const ds = getDoseSchedule(gist.injections, gist.injSchedule, false);
    const doseCycles = buildWeeklyDoseCycles(gist.injections, ds);
    const doseAt = (ms: number) => doseActiveAt(doseCycles, ms);

    const { maintenancePeriods } = deriveMaintenanceState(gist.maintenanceHistory, todayMs);
    const chartPeriods = maintenancePeriods.map((p) => (p.ongoing ? { ...p, endMs: viewEndMs } : p));
    const modeAtMs = (ms: number): 'maintenance' | 'weightloss' =>
      chartPeriods.some((p) => ms >= p.startMs && ms <= p.endMs) ? 'maintenance' : 'weightloss';

    const maintMarkers = visibleMaintMarkers(gist.maintenanceHistory, viewStartMs, viewEndMs);

    const startLbs = points[0].lbs;
    const currentLbs = points[points.length - 1].lbs;
    const totalLost = startLbs - currentLbs;
    const pctBodyLost = (totalLost / startLbs) * 100;
    const pctToGoal = Math.min((totalLost / (startLbs - gist.goalLbs)) * 100, 100);

    return {
      points,
      doseAt,
      modeAtMs,
      maintMarkers,
      stats: { startLbs, currentLbs, totalLost, pctBodyLost, pctToGoal },
      viewStartMs,
      viewEndMs,
    };
  }, [gist, range.days, range.customStart, range.customEnd]);
}

export { DOSE_PALETTE, toLbs };

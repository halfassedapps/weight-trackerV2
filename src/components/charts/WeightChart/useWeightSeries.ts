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
import { DOSE_PALETTE } from '../../../lib/theme';
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
  /** One color per distinct weekly dose, assigned in first-seen order — shared
   * by the graph (per-dose line segments) and the table (DOSE column). */
  colorForDose: (dose: number | null) => string;
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
        colorForDose: () => '#4a90d9',
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

    const doseColorMap = new Map<number, string>();
    for (const p of points) {
      const dose = doseAt(p.ms);
      if (dose != null && !doseColorMap.has(dose)) doseColorMap.set(dose, DOSE_PALETTE[doseColorMap.size % DOSE_PALETTE.length]);
    }
    const colorForDose = (dose: number | null) => (dose == null ? '#8e8e93' : (doseColorMap.get(dose) ?? '#4a90d9'));

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
      colorForDose,
    };
  }, [gist, range.days, range.customStart, range.customEnd]);
}

export { toLbs };

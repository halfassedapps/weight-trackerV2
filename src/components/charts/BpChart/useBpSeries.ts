import { useMemo } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs } from '../../../lib/domain/ranges';
import { computeDailyBp, type DailyBp } from '../../../lib/domain/bloodPressure';
import { visibleMaintMarkers, type MaintenanceMarker } from '../../../lib/domain/maintenance';
import { avg } from '../../../lib/domain/math';
import type { GistPayload } from '../../../lib/gist/types';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

export interface BpSeries {
  points: DailyBp[];
  avgSys: number | null;
  avgDia: number | null;
  maintMarkers: MaintenanceMarker[];
  viewStartMs: number;
  viewEndMs: number;
}

export function useBpSeries(gist: GistPayload | undefined, range: UseRangePickerResult): BpSeries {
  return useMemo(() => {
    const todayMs = new Date().setHours(12, 0, 0, 0);
    const empty: BpSeries = { points: [], avgSys: null, avgDia: null, maintMarkers: [], viewStartMs: todayMs, viewEndMs: todayMs };
    if (!gist || gist.bloodPressure.length === 0) return empty;

    const daily = computeDailyBp(gist.bloodPressure);

    const customRange = range.days === CUSTOM_RANGE_DAYS ? customDateRangeMs(range.customStart, range.customEnd) : null;
    const rangeCutoffMs = customRange ? customRange.start : range.days > 0 ? todayMs - range.days * 86400000 : 0;
    const rangeUpperMs = customRange ? customRange.end : Infinity;
    const filtered = range.days > 0 || customRange ? daily.filter((p) => p.ms >= rangeCutoffMs && p.ms <= rangeUpperMs) : daily;
    const points = filtered.length ? filtered : daily.slice(-1);

    const viewStartMs = points[0].ms;
    const viewEndMs = Math.min(todayMs, points[points.length - 1].ms);
    const maintMarkers = visibleMaintMarkers(gist.maintenanceHistory, viewStartMs, viewEndMs);

    // Note-only days (no systolic/diastolic) don't count toward the period average.
    const withBp = points.filter((p): p is DailyBp & { systolic: number; diastolic: number } => p.systolic != null && p.diastolic != null);

    return {
      points,
      avgSys: withBp.length ? avg(withBp.map((p) => p.systolic)) : null,
      avgDia: withBp.length ? avg(withBp.map((p) => p.diastolic)) : null,
      maintMarkers,
      viewStartMs,
      viewEndMs,
    };
  }, [gist, range.days, range.customStart, range.customEnd]);
}

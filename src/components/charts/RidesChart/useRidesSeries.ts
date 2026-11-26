// Derived-data layer for RidesChart. Deliberately smaller than V1's
// RidesChart: graph view only, no table/graph toggle and no expandable
// multi-ride-per-day rows — those are V1 features not yet ported, not bugs.
import { useMemo } from 'react';
import { visibleMaintMarkers, type MaintenanceMarker } from '../../../lib/domain/maintenance';
import type { GistPayload, RideDay } from '../../../lib/gist/types';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

export interface RidePoint extends RideDay {
  ms: number;
}

export interface RidesSeries {
  points: RidePoint[];
  totalDurSecs: number;
  totalDistMi: number;
  totalCal: number;
  maintMarkers: MaintenanceMarker[];
  viewStartMs: number;
  viewEndMs: number;
}

export function useRidesSeries(gist: GistPayload | undefined, range: UseRangePickerResult): RidesSeries {
  return useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const ridesMap = gist?.intervalsActivities?.ridesMap ?? {};
    const sorted = Object.values(ridesMap)
      .filter((d) => d.totalDurSecs > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!sorted.length) {
      return { points: [], totalDurSecs: 0, totalDistMi: 0, totalCal: 0, maintMarkers: [], viewStartMs: todayMs, viewEndMs: todayMs };
    }

    const startMs = new Date(`${sorted[0].date}T00:00:00`).getTime();
    const refEnd = todayMs + 86400000;
    const viewStartMs = range.customRange ? range.customRange.start : range.days > 0 ? refEnd - range.days * 86400000 : startMs;
    const viewEndMs = range.customRange ? range.customRange.end : refEnd;

    const periodData = sorted.filter((d) => {
      const ms = new Date(`${d.date}T00:00:00`).getTime();
      return ms >= viewStartMs && ms < viewEndMs;
    });
    const points = periodData.map((d) => ({ ...d, ms: new Date(`${d.date}T00:00:00`).getTime() }));

    const totalDurSecs = periodData.reduce((s, d) => s + d.totalDurSecs, 0);
    const totalDistMi = periodData.reduce((s, d) => s + d.totalDistM, 0) / 1609.34;
    const totalCal = periodData.reduce((s, d) => s + d.totalCal, 0);
    const maintMarkers = visibleMaintMarkers(gist?.maintenanceHistory, viewStartMs, viewEndMs);

    return { points, totalDurSecs, totalDistMi, totalCal, maintMarkers, viewStartMs, viewEndMs };
  }, [gist, range.days, range.customRange]);
}

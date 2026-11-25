// Derived-data layer for DoseChart — ported from V1 (index.html:7562-7909),
// split from rendering per the project plan. Entirely read-only: unlike
// WeightChart, this chart never needs isAdmin.
import { useMemo } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs } from '../../../lib/domain/ranges';
import { buildWeeklyDoseCycles, doseActiveAt, getDoseSchedule, type WeeklyDoseCycle } from '../../../lib/domain/dosing';
import { visibleMaintMarkers, type MaintenanceMarker } from '../../../lib/domain/maintenance';
import { computeLogbook } from '../../../lib/domain/weightSeries';
import type { GistPayload } from '../../../lib/gist/types';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

export interface DosePeriod {
  startMs: number;
  endMs: number;
  doseMg: number;
}

export interface WeightPoint {
  ms: number;
  lbs: number;
}

export interface DoseSeries {
  /** Visible weekly-dose step periods, clipped to the selected range. */
  periods: DosePeriod[];
  /** Weight overlay points, clipped to the same range. */
  weightPts: WeightPoint[];
  doseAtMs: (ms: number) => number | null;
  weightAtMs: (ms: number) => WeightPoint | null;
  maintMarkers: MaintenanceMarker[];
  /** Lifetime start (first dose cycle) — anchors the week-number x-ticks. */
  lifetimeStartMs: number;
  viewStartMs: number;
  viewEndMs: number;
  currentDoseMg: number | null;
}

export function useDoseSeries(gist: GistPayload | undefined, range: UseRangePickerResult): DoseSeries | null {
  return useMemo(() => {
    if (!gist) return null;
    const ds = getDoseSchedule(gist.injections, gist.injSchedule, false);
    // Weekly totals, not per-injection amounts — and the in-progress current
    // week is already projected to a full week's dose (see
    // buildWeeklyDoseCycles) even when only one injection day of it has
    // happened so far, so the chart never under-reports a just-started week.
    const cycles: WeeklyDoseCycle[] = buildWeeklyDoseCycles(gist.injections, ds);
    if (!cycles.length) return null;

    const STEP = 86400000;
    const todayMs = new Date().setHours(12, 0, 0, 0);
    const lifetimeStartMs = cycles[0].startMs;

    const customRange = range.days === CUSTOM_RANGE_DAYS ? customDateRangeMs(range.customStart, range.customEnd) : null;
    const viewEndMs = customRange ? Math.min(customRange.end, todayMs) : todayMs;
    const rangeCutoffMs = customRange ? customRange.start : range.days > 0 ? todayMs - range.days * STEP : lifetimeStartMs;
    const viewStartMs = Math.max(rangeCutoffMs, lifetimeStartMs);

    // Step periods — each cycle holds until the next one starts; the ongoing
    // (most recent) cycle holds through today since there's no next change yet.
    const allPeriods: DosePeriod[] = cycles.map((c, i) => ({
      startMs: c.startMs,
      endMs: i < cycles.length - 1 ? cycles[i + 1].startMs : todayMs + STEP,
      doseMg: c.doseMg,
    }));
    const periods = allPeriods
      .filter((p) => p.endMs > viewStartMs && p.startMs < viewEndMs)
      .map((p) => ({ ...p, startMs: Math.max(p.startMs, viewStartMs), endMs: Math.min(p.endMs, viewEndMs) }))
      .filter((p) => p.endMs > p.startMs);
    if (!periods.length) return null;

    // Weight overlay — same rows the Weight tab's own line plots, clipped to
    // this chart's visible window.
    const logbook = computeLogbook(gist.entries); // newest-first
    const weightPts: WeightPoint[] = [...logbook]
      .reverse()
      .map((r) => ({ ms: new Date(`${r.date}T12:00:00`).getTime(), lbs: r.lbs }))
      .filter((p) => p.ms >= viewStartMs && p.ms <= viewEndMs);

    const doseAtMs = (ms: number): number | null => {
      const p = periods.find((p) => ms >= p.startMs && ms <= p.endMs);
      return p ? p.doseMg : null;
    };
    const weightAtMs = (ms: number): WeightPoint | null => {
      if (!weightPts.length) return null;
      let best = weightPts[0];
      let bestDist = Infinity;
      for (const p of weightPts) {
        const d = Math.abs(p.ms - ms);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return best;
    };

    const maintMarkers = visibleMaintMarkers(gist.maintenanceHistory, viewStartMs, viewEndMs);
    const currentDoseMg = ds ? doseActiveAt(cycles, todayMs) : null;

    return { periods, weightPts, doseAtMs, weightAtMs, maintMarkers, lifetimeStartMs, viewStartMs, viewEndMs, currentDoseMg };
  }, [gist, range.days, range.customStart, range.customEnd]);
}

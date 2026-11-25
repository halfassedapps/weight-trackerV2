// Derived-data layer for PkChart — ported from V1 (index.html:3195-3840),
// split from rendering per the project plan. Deliberately smaller than V1's
// version for this first pass, matching the simplifications already made
// elsewhere in V2 (see WeightChart's useWeightSeries.ts):
//   - V1's string-mode range picker ('7d'/'14d'/'30d'/'all'/'custom'/'dates')
//     is replaced by the same day-count DATA_RANGE_OPTIONS + useRangePicker
//     every other V2 chart uses — "All time" (days: 0) plays the role of
//     V1's 'all' mode (less-crowded: injection markers/interval bars hidden).
//   - V1's "windowOffset" (scroll back/forward through history by
//     window-lengths, via ← Earlier / Later → buttons) is dropped. Not a
//     bug — a V1 feature not yet ported, like WeightChart's scroll mode.
//   - V1's weekly-bucketing of the PK line in 'all' mode (a visual-clutter/
//     perf hack, not a correctness requirement) is dropped in favor of
//     always showing the full 6-hour-resolution curve — cheap enough at
//     any realistic data lifetime.
import { useMemo } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs } from '../../../lib/domain/ranges';
import { buildWeeklyDoseCycles, getDoseSchedule, nextScheduledMs, pkTotal, type PkInjection } from '../../../lib/domain/dosing';
import { visibleMaintMarkers, type MaintenanceMarker } from '../../../lib/domain/maintenance';
import { computeLogbook } from '../../../lib/domain/weightSeries';
import type { GistPayload, Injection } from '../../../lib/gist/types';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

const STEP = 6 * 3600000; // 6h resolution, same as V1

export interface PkPoint {
  ms: number;
  v: number;
}

export interface IntervalAvg {
  startMs: number;
  endMs: number;
  mean: number;
  isLast: boolean;
}

export interface WeightPoint {
  ms: number;
  lbs: number;
}

export interface PkSeries {
  sortedInj: Injection[];
  lifetimeStartMs: number;
  viewStartMs: number;
  viewEndMs: number;
  todayMs: number;
  /** Full-resolution PK curve, clipped to the visible window. */
  points: PkPoint[];
  /** Future projection (today → viewEndMs), assuming scheduled doses at the current dose. */
  projPoints: PkPoint[];
  intervalAvgs: IntervalAvg[];
  futureIntervalAvgs: { startMs: number; endMs: number; mean: number }[];
  weightPts: WeightPoint[];
  interpWeight: (ms: number) => number | null;
  upcomingInjMs: number[];
  scheduleActive: boolean;
  curLevel: number;
  troughLevel: number;
  nextInjMs: number;
  weeklyDose: number;
  avgOnBoard: number;
  periodWeightChange: number | null;
  maxV: number;
  maintMarkers: MaintenanceMarker[];
  showClutter: boolean; // false in "All time" — hides injection markers/interval bars
}

export function usePkSeries(
  gist: GistPayload | undefined,
  range: UseRangePickerResult,
  splitManual: boolean,
): PkSeries | null {
  return useMemo(() => {
    if (!gist || gist.injections.length === 0) return null;

    const sortedInj = [...gist.injections].sort((a, b) => a.date.localeCompare(b.date));
    const lifetimeStartMs = new Date(`${sortedInj[0].date}T12:00:00`).getTime();
    const todayMs = new Date().setHours(12, 0, 0, 0);
    const lifetimeEndMs = todayMs + 21 * 86400000; // always project 3 weeks out

    const customRange = range.days === CUSTOM_RANGE_DAYS ? customDateRangeMs(range.customStart, range.customEnd) : null;
    const showClutter = range.days !== 0; // "All time" declutters, matching V1's 'all' mode

    const viewStartMs = customRange
      ? customRange.start
      : range.days > 0
        ? todayMs - range.days * 86400000
        : (() => {
            // "All time": snap to the 1st of the month so month labels land cleanly.
            const d = new Date(lifetimeStartMs);
            d.setDate(1);
            d.setHours(12, 0, 0, 0);
            return d.getTime();
          })();
    const viewEndMs = customRange ? customRange.end : todayMs + 7 * 86400000;

    const allPts: PkPoint[] = [];
    for (let ms = lifetimeStartMs; ms <= lifetimeEndMs; ms += STEP) {
      allPts.push({ ms, v: pkTotal(sortedInj, ms) });
    }
    const points = allPts.filter((p) => p.ms >= viewStartMs && p.ms <= viewEndMs);

    const ds = getDoseSchedule(gist.injections, gist.injSchedule, splitManual);
    if (!ds) return null;
    const { lastInjMs, scheduleActive, weeklyDose } = ds;
    const nextInjMs = ds.nextInjMs;

    const upcomingInjMs: number[] = (() => {
      if (scheduleActive) {
        const out: number[] = [];
        let after = lastInjMs;
        for (let i = 0; i < 10; i++) {
          const ms = nextScheduledMs(after, gist.injSchedule, lastInjMs);
          if (!ms || ms > viewEndMs) break;
          out.push(ms);
          after = ms;
        }
        return out;
      }
      return nextInjMs <= viewEndMs ? [nextInjMs] : [];
    })();

    const troughLevel = pkTotal(sortedInj, nextInjMs - 3600000);
    const lastDoseMg = ds.lastDose;

    const projInjs: PkInjection[] = scheduleActive
      ? [...sortedInj, ...upcomingInjMs.map((ms): PkInjection => ({ date: '', doseMg: lastDoseMg, _ms: ms }))]
      : sortedInj;
    const projPoints: PkPoint[] =
      scheduleActive && upcomingInjMs.length > 0
        ? (() => {
            const ps: PkPoint[] = [];
            for (let ms = todayMs; ms <= viewEndMs; ms += STEP) ps.push({ ms, v: pkTotal(projInjs, ms) });
            return ps;
          })()
        : [];
    const futureIntervalAvgs =
      scheduleActive && projPoints.length > 0
        ? upcomingInjMs
            .map((ms, i) => {
              const iEnd = upcomingInjMs[i + 1] ?? viewEndMs;
              const iPts = projPoints.filter((p) => p.ms >= ms && p.ms < iEnd);
              const mean = iPts.length ? iPts.reduce((s, p) => s + p.v, 0) / iPts.length : 0;
              return { startMs: ms, endMs: iEnd, mean };
            })
            .filter((s) => s.mean > 0)
        : [];

    const intervalAvgs: IntervalAvg[] = sortedInj
      .map((inj, i): IntervalAvg => {
        const iStart = new Date(`${inj.date}T12:00:00`).getTime();
        const iEnd = i < sortedInj.length - 1 ? new Date(`${sortedInj[i + 1].date}T12:00:00`).getTime() : nextInjMs;
        const iPts = allPts.filter((p) => p.ms >= iStart && p.ms <= iEnd);
        const mean = iPts.length ? iPts.reduce((s, p) => s + p.v, 0) / iPts.length : 0;
        return { startMs: iStart, endMs: iEnd, mean, isLast: i === sortedInj.length - 1 };
      })
      .filter((s) => s.mean > 0);

    const logbook = computeLogbook(gist.entries); // newest-first
    const wAllPts: WeightPoint[] = [...logbook]
      .reverse()
      .map((r) => ({ ms: new Date(`${r.date}T12:00:00`).getTime(), lbs: r.lbs }))
      .filter((p) => p.ms >= lifetimeStartMs && p.ms <= todayMs);
    const weightPts = wAllPts.filter((p) => p.ms >= viewStartMs && p.ms <= Math.min(todayMs, viewEndMs));

    const interpWeight = (ms: number): number | null => {
      if (!wAllPts.length) return null;
      let lo: WeightPoint | null = null;
      let hi: WeightPoint | null = null;
      for (const p of wAllPts) {
        if (p.ms <= ms) lo = p;
        else if (!hi) hi = p;
      }
      if (!lo && !hi) return null;
      if (!lo) return hi!.lbs;
      if (!hi) return lo.lbs;
      return lo.lbs + ((ms - lo.ms) / (hi.ms - lo.ms)) * (hi.lbs - lo.lbs);
    };

    const periodPts = allPts.filter((p) => p.ms >= viewStartMs && p.ms <= viewEndMs);
    const avgOnBoard = periodPts.length ? periodPts.reduce((s, p) => s + p.v, 0) / periodPts.length : 0;

    const periodStartW = interpWeight(Math.max(viewStartMs, lifetimeStartMs));
    const periodEndW = interpWeight(Math.min(viewEndMs, todayMs));
    const periodWeightChange = periodStartW != null && periodEndW != null ? periodEndW - periodStartW : null;

    const curLevel = pkTotal(sortedInj, todayMs);
    const maxV = Math.max(...points.map((p) => p.v), ...points.map((p) => p.v), 0.01);

    const maintMarkers = showClutter ? visibleMaintMarkers(gist.maintenanceHistory, viewStartMs, viewEndMs) : [];

    // Weekly dose cycles aren't otherwise needed here, but confirm there's at
    // least one — a schedule with zero cycles shouldn't reach this far.
    buildWeeklyDoseCycles(gist.injections, ds);

    return {
      sortedInj,
      lifetimeStartMs,
      viewStartMs,
      viewEndMs,
      todayMs,
      points,
      projPoints,
      intervalAvgs,
      futureIntervalAvgs,
      weightPts,
      interpWeight,
      upcomingInjMs,
      scheduleActive,
      curLevel,
      troughLevel,
      nextInjMs,
      weeklyDose,
      avgOnBoard,
      periodWeightChange,
      maxV,
      maintMarkers,
      showClutter,
    };
  }, [gist, range.days, range.customStart, range.customEnd, splitManual]);
}

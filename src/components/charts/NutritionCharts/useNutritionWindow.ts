// Shared derived window for all three nutrition cards (TdeeChart,
// CaloriesVsTargetChart, ProteinChart) — ported from V1's
// CaloriesActivitySection (index.html:1551-1679), which owns one range
// picker and passes the same visible window to all three charts so they
// stay in sync. V2 standardizes on the day-count DATA_RANGE_OPTIONS +
// useRangePicker (see PkChart/DoseChart's identical simplification) instead
// of V1's string-mode range + windowOffset scroll-through-history.
import { useMemo } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs } from '../../../lib/domain/ranges';
import type { CalorieRow, GistPayload } from '../../../lib/gist/types';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

export interface CalorieDayPoint extends CalorieRow {
  ms: number;
}

export interface NutritionWindow {
  periodDaily: CalorieDayPoint[];
  visStartMs: number;
  visEndMs: number;
  todayMs: number;
}

export function useNutritionWindow(gist: GistPayload | undefined, range: UseRangePickerResult): NutritionWindow | null {
  return useMemo(() => {
    if (!gist || gist.calories.length < 2) return null;

    const STEP = 86400000;
    const sorted = [...gist.calories].sort((a, b) => a.date.localeCompare(b.date));
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const startMs = new Date(`${sorted[0].date}T00:00:00`).getTime();

    const customRange = range.days === CUSTOM_RANGE_DAYS ? customDateRangeMs(range.customStart, range.customEnd) : null;
    const visStartMs = customRange ? customRange.start : range.days > 0 ? todayMs + STEP - range.days * STEP : startMs;
    const visEndMs = customRange ? customRange.end : todayMs + STEP;

    const periodDaily: CalorieDayPoint[] = sorted
      .filter((d) => {
        const ms = new Date(`${d.date}T00:00:00`).getTime();
        return ms >= visStartMs && ms < visEndMs;
      })
      .map((d) => ({ ...d, ms: new Date(`${d.date}T00:00:00`).getTime() }));

    if (!periodDaily.length) return null;
    return { periodDaily, visStartMs, visEndMs, todayMs };
  }, [gist, range.days, range.customStart, range.customEnd]);
}

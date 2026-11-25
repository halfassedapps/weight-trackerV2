// Ported from V1 (index.html:1033-1058). `computeLogbook` works over array
// index offsets (data[i+7] = "7 entries back"), not calendar-day arithmetic
// — if logging has gaps, "7-day" windows are really "last 7 *logged*
// entries," same behavior as V1. Faithful port, not a fix.
import type { WeightEntry } from '../gist/types';
import { avg } from './math';

export const toLbs = (kg: number): number => kg * 2.20462;

export interface LogbookRow {
  date: string;
  wKg: number;
  lbs: number;
  movAvg: number;
  rate: number | null;
  tenHigh: number;
  twoWeekLoss: number | null;
}

/** `entries` must already be deduped and sorted newest-first. */
export function computeLogbook(entries: WeightEntry[]): LogbookRow[] {
  const n = entries.length;
  return entries.map((entry, i) => {
    const maSlice = entries.slice(i, i + 7).map((d) => d.wKg);
    const movAvgKg = avg(maSlice);

    let weeklyRateKg: number | null = null;
    if (i + 7 < n) {
      const prev = entries.slice(i + 7, i + 14).map((d) => d.wKg);
      if (prev.length) weeklyRateKg = movAvgKg - avg(prev);
    }

    const hiSlice = entries.slice(i, i + 10).map((d) => d.wKg);
    const tenHiKg = Math.max(...hiSlice);

    const prev2wSlice = entries.slice(i + 14, i + 21).map((d) => d.wKg);
    const twoWeekLossKg = prev2wSlice.length >= 3 ? avg(prev2wSlice) - movAvgKg : null;

    return {
      date: entry.date,
      wKg: entry.wKg,
      lbs: toLbs(entry.wKg),
      movAvg: toLbs(movAvgKg),
      rate: weeklyRateKg != null ? toLbs(weeklyRateKg) : null,
      tenHigh: toLbs(tenHiKg),
      twoWeekLoss: twoWeekLossKg != null ? toLbs(twoWeekLossKg) : null,
    };
  });
}

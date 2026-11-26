// Ported from V1 (index.html:1033-1058). `computeLogbook` works over array
// index offsets (data[i+7] = "7 entries back"), not calendar-day arithmetic
// — if logging has gaps, "7-day" windows are really "last 7 *logged*
// entries," same behavior as V1. Faithful port, not a fix.
import type { Injection, WeightEntry } from '../gist/types';
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

export interface WeighInPoint {
  ms: number;
  lbs: number;
}

/** Linear interpolation between the nearest logged weigh-ins on either side
 * of `ms`, clamped to the first/last point outside the logged range. `points`
 * must be sorted ascending by `ms`. Shared by DoseWeightLossChart and the
 * maintenance-history table — both need "weight at an arbitrary date that
 * rarely lands exactly on a weigh-in." */
export function lbsAtMs(points: WeighInPoint[], ms: number): number | null {
  if (!points.length) return null;
  if (ms <= points[0].ms) return points[0].lbs;
  if (ms >= points[points.length - 1].ms) return points[points.length - 1].lbs;
  for (let i = 0; i < points.length - 1; i++) {
    if (ms >= points[i].ms && ms <= points[i + 1].ms) {
      const f = (ms - points[i].ms) / (points[i + 1].ms - points[i].ms);
      return points[i].lbs + (points[i + 1].lbs - points[i].lbs) * f;
    }
  }
  return points[points.length - 1].lbs;
}

export type LogbookItem = ({ type: 'row'; isInjDay: boolean; isLast: boolean } & LogbookRow) | ({ type: 'injection' } & Injection);

/** Ported from V1 (index.html:1423-1438) — merges the weight logbook with
 * injection markers so the log table can show "inj" rows interleaved at
 * the right spot. `rows` and `injections` must both be newest-first. */
export function buildItems(rows: LogbookRow[], injections: Injection[]): LogbookItem[] {
  const injDesc = [...injections].sort((a, b) => b.date.localeCompare(a.date));
  const injSet = new Set(injections.map((i) => i.date));
  const items: LogbookItem[] = [];
  let injIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    while (injIdx < injDesc.length && injDesc[injIdx].date >= row.date) {
      items.push({ type: 'injection', ...injDesc[injIdx] });
      injIdx++;
    }
    items.push({ type: 'row', ...row, isInjDay: injSet.has(row.date), isLast: i === rows.length - 1 });
  }
  while (injIdx < injDesc.length) items.push({ type: 'injection', ...injDesc[injIdx++] });
  return items;
}

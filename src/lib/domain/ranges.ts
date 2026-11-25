// Ported from V1's WeightChart (index.html:5460ish) and windowDaysForRange/
// customDateRangeMs (index.html:1479-1500). V1 had two parallel range-picker
// shapes (WeightChart's day-count model vs. BP/Rides/Pk's string-mode
// model) — V2 standardizes on the day-count model everywhere, since it's a
// strict superset (a 7-day preset is just `{ days: 7 }`) and lets every
// chart share one `DATA_RANGE_OPTIONS` + one `useRangePicker` hook.

/** Sentinel for "Date range…" (explicit start/end), distinct from 0 ("All time"). */
export const CUSTOM_RANGE_DAYS = -1;

export interface RangeOption {
  days: number;
  label: string;
}

export const DATA_RANGE_OPTIONS: RangeOption[] = [
  { days: 14, label: 'Last 2 weeks' },
  { days: 30, label: 'Last month' },
  { days: 90, label: 'Last 3 months' },
  { days: 180, label: 'Last 6 months' },
  { days: 365, label: 'Last year' },
  { days: 0, label: 'All time' },
  { days: CUSTOM_RANGE_DAYS, label: 'Date range…' },
];

export interface MsRange {
  start: number;
  end: number;
}

/**
 * Resolves an explicit [start, end] YYYY-MM-DD pair into inclusive ms
 * bounds, or null if either date is missing or the pair is nonsensical
 * (end < start) — callers fall back to their normal range-mode math in that
 * case, so an incomplete pick just behaves like no custom range was chosen
 * yet rather than erroring or rendering an empty chart.
 */
export function customDateRangeMs(startDate: string, endDate: string): MsRange | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T23:59:59`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= end ? { start, end } : null;
}

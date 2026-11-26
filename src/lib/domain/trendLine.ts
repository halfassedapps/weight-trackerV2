// Ported from V1's WeightChart (index.html:5340-5668) — the "Show as"
// aggregation, the "Trend period" regression window, and the "Trend Lines"
// menu (the current-trend regression plus four hypothetical fixed-rate
// projections). Simplified from V1: no scroll-mode (long ranges still fit
// to the container width instead of scrolling horizontally), no goal-date
// drift-vs-7-days-ago indicator, and rate lines always fan from "today"
// (V1's "Rates from today" toggle isn't exposed — it's always on).
import { avg } from './math';

export type AggregateId = 'daily' | 'weekly' | 'monthly';

export interface AggregateOption {
  id: AggregateId;
  label: string;
  minDays: number;
}

export const AGGREGATE_OPTIONS: AggregateOption[] = [
  { id: 'daily', label: 'Daily', minDays: 0 },
  { id: 'weekly', label: 'Weekly', minDays: 7 },
  { id: 'monthly', label: 'Monthly', minDays: 30 },
];

export interface BinnedPoint {
  ms: number;
  lbs: number;
  n: number;
}

/** Group raw points into weekly (Sunday-anchored) or monthly (1st-anchored)
 * buckets. A bucket boundary that falls before `minMs` (the visible
 * window's own start) is clamped into it, so the earliest partial bucket
 * doesn't plot off the left edge of the chart. */
export function binPtsByUnit(points: { ms: number; lbs: number }[], unit: 'week' | 'month', minMs?: number): BinnedPoint[] {
  const bins = new Map<number, number[]>();
  for (const p of points) {
    const d = new Date(p.ms);
    let keyMs: number;
    if (unit === 'week') {
      const wd = new Date(p.ms);
      wd.setHours(0, 0, 0, 0);
      wd.setDate(wd.getDate() - wd.getDay());
      keyMs = wd.getTime();
    } else {
      keyMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    }
    if (minMs != null && keyMs < minMs) keyMs = minMs;
    if (!bins.has(keyMs)) bins.set(keyMs, []);
    bins.get(keyMs)!.push(p.lbs);
  }
  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, arr]) => ({ ms, lbs: avg(arr), n: arr.length }));
}

export const TREND_PERIOD_OPTIONS = [
  { days: 14, label: 'Last 2 weeks' },
  { days: 21, label: 'Last 3 weeks' },
  { days: 30, label: 'Last month' },
  { days: 42, label: 'Last 6 weeks' },
  { days: 90, label: 'Last 3 months' },
  { days: 0, label: 'All time' },
];

export interface TrendRateOption {
  id: string;
  label: string;
  /** null for the regression-fit "current" line. */
  ratePerWeek: number | null;
  color: string;
}

export const TREND_OPTIONS: TrendRateOption[] = [
  { id: 'current', label: 'Current', ratePerWeek: null, color: '#1c1c1e' },
  { id: 'r1', label: '1 lb/wk', ratePerWeek: 1, color: '#5ac8fa' },
  { id: 'r2', label: '2 lb/wk', ratePerWeek: 2, color: '#a2845e' },
  { id: 'r3', label: '3 lb/wk', ratePerWeek: 3, color: '#bf5af2' },
  { id: 'r4', label: '4 lb/wk', ratePerWeek: 4, color: '#1d4e89' },
];

export interface LinearFit {
  slope: number;
  intercept: number;
  /** Fitted value (lbs) at an arbitrary ms, anchored at the regression's own origin. */
  at: (ms: number) => number;
}

/** Ordinary least-squares fit of lbs against days-since-`originMs`. Falls
 * back to the full lifetime point set if the requested window has fewer
 * than 4 points (too little data for `trendDays` to mean anything). */
export function fitTrendLine(pts: { ms: number; lbs: number }[], originMs: number, trendDays: number, todayMs: number): LinearFit {
  const cutoffMs = trendDays > 0 ? todayMs - trendDays * 86400000 : 0;
  const windowed = trendDays > 0 ? pts.filter((p) => p.ms >= cutoffMs) : pts;
  const regPts = windowed.length >= 4 ? windowed : pts;

  const n = regPts.length;
  const xs = regPts.map((p) => (p.ms - originMs) / 86400000);
  const ys = regPts.map((p) => p.lbs);
  const mX = xs.reduce((s, v) => s + v, 0) / n;
  const mY = ys.reduce((s, v) => s + v, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - mX) ** 2, 0);
  const slope = denom !== 0 ? xs.reduce((s, x, i) => s + (x - mX) * (ys[i] - mY), 0) / denom : 0;
  const intercept = mY - slope * mX;

  return { slope, intercept, at: (ms: number) => intercept + (slope * (ms - originMs)) / 86400000 };
}

export interface TrendLineSeries {
  id: string;
  label: string;
  color: string;
  /** Two points: [anchor, goal-or-horizon]. */
  points: [{ ms: number; lbs: number }, { ms: number; lbs: number }];
  goalMs: number | null;
}

/** Builds the checked trend lines' drawable segments: the "current"
 * regression line runs from the lifetime start to its projected goal date
 * (or a 180-day fallback horizon if the trend isn't heading toward goal);
 * each hypothetical rate line fans from today's regression-fitted value
 * toward goal at that fixed weekly rate (or its own 180-day fallback). The
 * caller is expected to extend the chart's visible x-domain to cover
 * whichever returned `goalMs` lands furthest out — these endpoints are
 * deliberately not pre-clipped to any particular chart width. */
export function buildTrendLines(checkedIds: string[], fit: LinearFit, startMs: number, todayMs: number, goalLbs: number): TrendLineSeries[] {
  const anchorLbs = fit.at(todayMs);
  const fallbackMs = startMs + 180 * 86400000;
  const lines: TrendLineSeries[] = [];

  if (checkedIds.includes('current')) {
    const goalDays = fit.slope < 0 ? (goalLbs - fit.intercept) / fit.slope : null;
    const goalMs = goalDays != null ? startMs + goalDays * 86400000 : null;
    const endMs = goalMs ?? Math.max(fallbackMs, todayMs + 14 * 86400000);
    lines.push({
      id: 'current',
      label: 'Current',
      color: '#1c1c1e',
      points: [
        { ms: startMs, lbs: fit.at(startMs) },
        { ms: endMs, lbs: fit.at(endMs) },
      ],
      goalMs,
    });
  }

  for (const opt of TREND_OPTIONS) {
    if (opt.id === 'current' || !checkedIds.includes(opt.id) || opt.ratePerWeek == null) continue;
    const slopePerDay = -opt.ratePerWeek / 7;
    const goalDays = anchorLbs > goalLbs ? (goalLbs - anchorLbs) / slopePerDay : null;
    const goalMs = goalDays != null ? todayMs + goalDays * 86400000 : null;
    const endMs = goalMs ?? Math.max(fallbackMs, todayMs + 14 * 86400000);
    const endLbs = anchorLbs + slopePerDay * ((endMs - todayMs) / 86400000);
    lines.push({
      id: opt.id,
      label: opt.label,
      color: opt.color,
      points: [
        { ms: todayMs, lbs: anchorLbs },
        { ms: endMs, lbs: endLbs },
      ],
      goalMs,
    });
  }

  return lines;
}

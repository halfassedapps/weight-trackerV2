// Ported from V1's DoseWeightLossChart (index.html:7414-7552), split into
// pure data (this file) vs. rendering (pie geometry, color assignment) per
// the project plan.
import { buildWeeklyDoseCycles, getDoseSchedule } from './dosing';
import type { Injection, InjSchedule } from '../gist/types';

export interface DoseWeightLossPeriod {
  doseMg: number;
  /** lbs lost during this weekly-dose period; negative means weight was gained */
  lostLbs: number;
}

export interface WeightLikeRow {
  date: string;
  lbs: number;
}

/**
 * One entry per weekly-dose period (same cycles WeightChart's dose-coloring
 * uses), each with lbs lost while that dose was active — interpolated
 * linearly between the nearest logged weigh-ins on either side of a period
 * boundary, since a dose change rarely lands exactly on a weigh-in day.
 * Returns null when there isn't enough data for this to mean anything (same
 * guard V1 used): fewer than 2 weigh-ins, fewer than 2 injections, or fewer
 * than 2 distinct weekly-dose periods.
 */
export function computeDoseWeightLossPeriods(
  rows: WeightLikeRow[], // newest-first
  injections: Injection[] | undefined,
  injSchedule: InjSchedule,
  todayMs: number,
): DoseWeightLossPeriod[] | null {
  if (rows.length < 2 || !injections || injections.length < 2) return null;

  const pts = [...rows].reverse().map((r) => ({ ms: new Date(`${r.date}T12:00:00`).getTime(), lbs: r.lbs }));
  const lbsAt = (ms: number): number | null => {
    if (!pts.length) return null;
    if (ms <= pts[0].ms) return pts[0].lbs;
    if (ms >= pts[pts.length - 1].ms) return pts[pts.length - 1].lbs;
    for (let i = 0; i < pts.length - 1; i++) {
      if (ms >= pts[i].ms && ms <= pts[i + 1].ms) {
        const f = (ms - pts[i].ms) / (pts[i + 1].ms - pts[i].ms);
        return pts[i].lbs + (pts[i + 1].lbs - pts[i].lbs) * f;
      }
    }
    return pts[pts.length - 1].lbs;
  };

  const ds = getDoseSchedule(injections, injSchedule, false);
  const doseChanges = buildWeeklyDoseCycles(injections, ds).map((p) => ({ ms: p.startMs, doseMg: p.doseMg }));
  if (doseChanges.length < 2) return null;

  return doseChanges.map((dc, i): DoseWeightLossPeriod => {
    const endMs = i < doseChanges.length - 1 ? doseChanges[i + 1].ms : todayMs;
    const startW = lbsAt(dc.ms);
    const endW = lbsAt(endMs);
    // Allow negative (weight gained during a period) — clipping to 0 would
    // inflate the total vs. the actual net weight change.
    const lostLbs = startW != null && endW != null ? startW - endW : 0;
    return { doseMg: dc.doseMg, lostLbs };
  });
}

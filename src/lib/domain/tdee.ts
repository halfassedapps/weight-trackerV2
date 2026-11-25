// Ported from V1 (index.html:300-583). Scope note: only the subset of V1's
// TDEE/calorie pure functions the three nutrition charts themselves need.
// appetiteSuppressionSignal/giToleranceSignal/subjectiveAppetiteCrossCheck/
// mifflinStJeorBmr feed V1's dose-recommendation logic and TDEE-calculator
// popover (DosePanel/TdeeCalculatorModal) — deferred until those are ported.
import type { CalorieRow, DatedTarget } from '../gist/types';

// How far off-target a day's *intake* was (consumed − target). TDEE cancels
// out of this on purpose: your net-calorie goal for a day is (target − TDEE),
// so actual-net-vs-goal-net simplifies to just consumed-vs-target regardless
// of how much you burned that day.
//
// Deliberately asymmetric: undereating relative to plan is treated as "bad"
// much sooner than overeating is — a big unplanned deficit risks muscle
// loss/metabolic adaptation and usually means a logging gap, while
// overshooting the target by the same amount is just a normal high-appetite
// day.
const NET_GOOD_BAND = 150; // within ±150 cal of target = good, either direction
const NET_UNDEREAT_BAD = 400; // more than 400 cal *under* target = bad
const NET_OVEREAT_BAD = 600; // more than 600 cal *over* target = bad (more leeway)

export const NET_TIER_COLOR = { good: '#0ca30c', ok: '#fab219', bad: '#d03b3b' } as const;
export type NetTier = keyof typeof NET_TIER_COLOR;

export function netTier(deviation: number): NetTier {
  if (Math.abs(deviation) <= NET_GOOD_BAND) return 'good';
  return deviation < 0 ? (deviation < -NET_UNDEREAT_BAD ? 'bad' : 'ok') : deviation > NET_OVEREAT_BAD ? 'bad' : 'ok';
}

/** Most recent target with date <= dateStr. `targets` must be sorted ascending by date. */
export function targetActiveAt(targets: DatedTarget[], dateStr: string): number | null {
  let t: number | null = null;
  for (const entry of targets) {
    if (entry.date <= dateStr) t = entry.target;
    else break;
  }
  return t;
}

/**
 * Exercise calories to credit back for a given day — real intervals.icu ride
 * calories when available, HealthKit ActiveEnergy on a HasWorkout day
 * otherwise, 0 if neither. Clamped to that day's total ActiveEnergy.
 */
export function exerciseCreditFor(d: CalorieRow, intervalsCalories: Record<string, number> | undefined): number {
  const rideCal = intervalsCalories ? intervalsCalories[d.date] : null;
  const exercise = rideCal != null ? rideCal : d.HasWorkout ? d.ActiveEnergy || 0 : 0;
  return Math.min(exercise, d.ActiveEnergy || 0);
}

export interface CalorieDeviation {
  baseTarget: number | null;
  exercise: number;
  target: number | null;
  deviation: number | null;
}

/**
 * Per-day deviation from calorie target, crediting exercise back into the
 * budget (MFP-style Goal + Exercise − Food).
 */
export function calorieDeviationFor(
  d: CalorieRow,
  calorieTargets: DatedTarget[],
  intervalsCalories: Record<string, number> | undefined,
): CalorieDeviation {
  const baseTarget = targetActiveAt(calorieTargets, d.date);
  const exercise = exerciseCreditFor(d, intervalsCalories);
  const target = baseTarget != null ? baseTarget + exercise : null;
  const deviation = target != null ? (d.Calories || 0) - target : null;
  return { baseTarget, exercise, target, deviation };
}

// Protein is a floor, not a target with headroom — hitting or clearing it is
// simply "good," full stop, with no separate reward for going further over.
// Undershooting is asymmetric on purpose: a single day 85-99% of the floor
// isn't a problem if the weekly average still clears it, but a meaningful
// shortfall (<85%) is where muscle-preservation risk actually shows up.
const PROTEIN_SHORTFALL_RATIO = 0.85; // below this fraction of target = red

export function proteinTier(value: number, target: number | null): NetTier | null {
  if (target == null) return null;
  if (value >= target) return 'good';
  return value >= target * PROTEIN_SHORTFALL_RATIO ? 'ok' : 'bad';
}

// Ported from V1 (index.html:300-583). Scope note: mifflinStJeorBmr (the
// TDEE-calculator popover's own formula) is still deferred — that modal
// isn't ported yet — but appetiteSuppressionSignal/giToleranceSignal/
// subjectiveAppetiteCrossCheck now are, feeding DosePanel's dose
// recommendation (lib/domain/dosing.ts's doseGuidance/getRecommendation).
import { msToLocalDate } from './csv';
import { avg } from './math';
import type { CalorieRow, DatedTarget, Injection } from '../gist/types';

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

/**
 * Replaces (or adds) the dated-target entry for `dateStr`, keeping the array
 * sorted ascending by date — the write-side counterpart to targetActiveAt
 * below, and the one place "set today's calorie/protein target" is defined
 * (was duplicated identically in NutritionPage and DoseRecommendationCard).
 */
export function upsertDatedTarget(targets: DatedTarget[], dateStr: string, target: number): DatedTarget[] {
  return [...targets.filter((t) => t.date !== dateStr), { date: dateStr, target }].sort((a, b) => a.date.localeCompare(b.date));
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

export interface AppetiteSuppressionSignal {
  avgDeviation: number;
  days: number;
}

/**
 * Trailing-window average calorie-target deviation — a secondary signal for
 * the dosing recommendation. A deep, sustained deficit (especially with
 * exercise credited back in) suggests appetite is already well-suppressed at
 * the current dose, which argues for caution before increasing further.
 * Returns null when there's too little data to say anything meaningful.
 */
export function appetiteSuppressionSignal(
  calories: CalorieRow[] | undefined,
  calorieTargets: DatedTarget[],
  intervalsCalories: Record<string, number> | undefined,
  todayMs: number,
  windowDays = 14,
): AppetiteSuppressionSignal | null {
  // Ends at the last *complete* day, not today — a calories row is a
  // HealthKit running total, so today's is always still accumulating and
  // would drag the average down by whatever fraction of the day has synced.
  const lastCompleteStr = msToLocalDate(todayMs - 86400000);
  const cutoff = msToLocalDate(todayMs - (windowDays + 1) * 86400000);
  const deviations = (calories || [])
    .filter((d) => d.date >= cutoff && d.date <= lastCompleteStr)
    .map((d) => calorieDeviationFor(d, calorieTargets, intervalsCalories).deviation)
    .filter((v): v is number => v != null);
  if (deviations.length < 7) return null;
  return { avgDeviation: avg(deviations), days: deviations.length };
}

// Trailing-window average nausea across injections with a nausea score
// logged — a safety-relevant signal that takes priority over the appetite-
// suppression override above. windowDays is picked at the upper end of
// "2-4 weeks" so a typical weekly/biweekly injection cadence still reliably
// captures 2+ readings.
export const GI_TOLERANCE_WINDOW_DAYS = 28;
export const GI_NAUSEA_BAD = 7;
export const GI_SEVERE_TODAY_BAD = 9;

export interface GiToleranceSignal {
  avgNausea: number;
  latestNausea: number | null;
  count: number;
  persistent: boolean;
  persistentDoseMg: number | null;
}

export function giToleranceSignal(
  sortedInj: Injection[] | undefined,
  todayMs: number,
  windowDays = GI_TOLERANCE_WINDOW_DAYS,
): GiToleranceSignal | null {
  const cutoff = msToLocalDate(todayMs - windowDays * 86400000);
  const withNausea = (sortedInj || []).filter((inj) => inj.nausea != null);
  const inWindow = withNausea.filter((inj) => inj.date >= cutoff);
  if (!inWindow.length) return null;
  const avgNausea = avg(inWindow.map((inj) => inj.nausea!));
  // Most recent surveyed reading, independent of the window average — a
  // single severe day (>= GI_SEVERE_TODAY_BAD) can hold the dose even when
  // the trailing average is otherwise fine.
  const latestNausea = withNausea[withNausea.length - 1].nausea!;
  // Persistent-intolerance flag: the last two SURVEYED injections (not
  // necessarily the last two calendar injections) at the same dose both
  // individually >= 7 — informational only, never changes the mechanical
  // recommendation on its own.
  let persistent = false;
  let persistentDoseMg: number | null = null;
  if (withNausea.length >= 2) {
    const [prev, last] = withNausea.slice(-2);
    if (prev.doseMg === last.doseMg && prev.nausea! >= GI_NAUSEA_BAD && last.nausea! >= GI_NAUSEA_BAD) {
      persistent = true;
      persistentDoseMg = last.doseMg;
    }
  }
  return { avgNausea, latestNausea, count: inWindow.length, persistent, persistentDoseMg };
}

export interface AppetiteCrossCheck {
  type: 'corroborated' | 'contradicted';
  note: string;
}

/**
 * Cross-checks the appetite-suppression override against reported
 * hunger/food-noise: corroborates it when both are low, flags a possible
 * alternate explanation when either is still high despite the deep calorie
 * deficit. Only meaningful — and only called — when
 * appetiteSuppressionSignal already fired.
 */
export function subjectiveAppetiteCrossCheck(
  sortedInj: Injection[] | undefined,
  todayMs: number,
  giSignal: GiToleranceSignal | null,
  windowDays = GI_TOLERANCE_WINDOW_DAYS,
): AppetiteCrossCheck | null {
  const cutoff = msToLocalDate(todayMs - windowDays * 86400000);
  const inWindow = (sortedInj || []).filter((inj) => inj.date >= cutoff);
  const hungerVals = inWindow.map((i) => i.hunger).filter((v): v is number => v != null);
  const noiseVals = inWindow.map((i) => i.foodNoise).filter((v): v is number => v != null);
  if (!hungerVals.length && !noiseVals.length) return null;
  const avgHunger = hungerVals.length ? avg(hungerVals) : null;
  const avgNoise = noiseVals.length ? avg(noiseVals) : null;
  const stillHungry = (avgHunger != null && avgHunger >= 6) || (avgNoise != null && avgNoise >= 6);
  if (!stillHungry) {
    return avgHunger != null && avgNoise != null && avgHunger <= 3 && avgNoise <= 3
      ? { type: 'corroborated', note: 'consistent with reported low hunger/food noise' }
      : null;
  }
  const note =
    giSignal && giSignal.avgNausea >= GI_NAUSEA_BAD
      ? 'still hungry despite the deficit — may reflect GI symptoms rather than true appetite suppression'
      : 'still hungry despite the deficit — the deficit may not reflect true appetite suppression';
  return { type: 'contradicted', note };
}

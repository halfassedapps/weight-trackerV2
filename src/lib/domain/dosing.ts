// Ported from V1 (index.html:1192-1420). One deliberate change:
// `getDoseSchedule` takes `splitManual` as a parameter instead of reading
// `localStorage` directly — V1's version was an otherwise-pure function with
// one hidden side-channel input, which made it untestable without a DOM.
// The caller (a hook, not this module) owns reading the actual preference.
import type { CalorieRow, DatedTarget, Injection, InjSchedule } from '../gist/types';
import { isIntervalSchedule, isWeekdaySchedule } from '../gist/guards';
import { msToLocalDate } from './csv';
import type { LogbookRow } from './weightSeries';
import {
  GI_NAUSEA_BAD,
  GI_TOLERANCE_WINDOW_DAYS,
  appetiteSuppressionSignal,
  giToleranceSignal,
  subjectiveAppetiteCrossCheck,
  type AppetiteCrossCheck,
  type AppetiteSuppressionSignal,
  type GiToleranceSignal,
} from './tdee';

// ─── Pharmacokinetics — one-compartment first-order absorption (Bateman
// equation), t½ elim = 5 days (120h), Ka gives Tmax ≈ 36h. ──────────────────
const T_HALF = 5;
const KE_H = Math.LN2 / (T_HALF * 24);
const KA_H = 0.078125;
const KA_SCALE = KA_H / (KA_H - KE_H);

export function pkContrib(doseMg: number, dtDays: number): number {
  if (dtDays < 0) return 0;
  const t = dtDays * 24;
  return doseMg * KA_SCALE * (Math.exp(-KE_H * t) - Math.exp(-KA_H * t));
}

export interface PkInjection extends Injection {
  /** Synthetic future injections use their exact scheduled timestamp instead of `date`. */
  _ms?: number;
}

export function pkTotal(injections: PkInjection[], evalMs: number): number {
  return injections.reduce((sum, inj) => {
    const injMs = inj._ms ?? new Date(`${inj.date}T12:00:00`).getTime();
    return sum + pkContrib(inj.doseMg, (evalMs - injMs) / 86400000);
  }, 0);
}

/** Given a ms timestamp, the next scheduled injection ms per the config.
 * `lastInjMs` anchors interval-mode schedules (next dose = last logged
 * injection + N days) and is unused for weekday-mode schedules. */
export function nextScheduledMs(afterMs: number, schedule: InjSchedule, lastInjMs: number | null): number | null {
  if (isIntervalSchedule(schedule)) {
    if (lastInjMs == null) return null;
    const stepMs = schedule.everyNDays * 86400000;
    const n = Math.max(1, Math.ceil((afterMs - lastInjMs) / stepMs));
    let cand = new Date(lastInjMs + n * stepMs);
    cand.setHours(schedule.ampm === 'am' ? 8 : 20, 0, 0, 0);
    if (cand.getTime() <= afterMs) {
      cand = new Date(lastInjMs + (n + 1) * stepMs);
      cand.setHours(schedule.ampm === 'am' ? 8 : 20, 0, 0, 0);
    }
    return cand.getTime();
  }
  if (!schedule || schedule.length === 0) return null;
  const base = new Date(afterMs);
  for (let d = 1; d <= 7; d++) {
    const cand = new Date(base);
    cand.setDate(cand.getDate() + d);
    const slot = schedule.find((s) => s.day === cand.getDay());
    if (slot) {
      cand.setHours(slot.ampm === 'am' ? 8 : 20, 0, 0, 0);
      return cand.getTime();
    }
  }
  return null;
}

export interface DoseSchedule {
  sortedInj: Injection[];
  lastInj: Injection;
  lastInjMs: number;
  lastDose: number;
  injInterval: number;
  scheduleActive: boolean;
  weekdayActive: boolean;
  intervalActive: boolean;
  injPerWeek: number;
  weeklyDose: number;
  nextInjMs: number;
}

/** Unifies schedule/cadence math: current per-injection dose, doses/week
 * (continuous, not just 1 or 2), and the resulting true weekly total. */
export function getDoseSchedule(
  injections: Injection[] | undefined,
  injSchedule: InjSchedule,
  splitManual: boolean,
): DoseSchedule | null {
  if (!injections || injections.length === 0) return null;
  const sortedInj = [...injections].sort((a, b) => a.date.localeCompare(b.date));
  const lastInj = sortedInj[sortedInj.length - 1];
  const lastInjMs = new Date(`${lastInj.date}T12:00:00`).getTime();
  const lastDose = lastInj.doseMg;

  let injInterval = 7;
  if (sortedInj.length >= 2) {
    const prevMs = new Date(`${sortedInj[sortedInj.length - 2].date}T12:00:00`).getTime();
    injInterval = (lastInjMs - prevMs) / 86400000;
  }

  const weekdayActive = isWeekdaySchedule(injSchedule);
  const intervalActive = isIntervalSchedule(injSchedule);
  const scheduleActive = weekdayActive || intervalActive;

  const injPerWeek = weekdayActive
    ? injSchedule.length
    : intervalActive
      ? 7 / injSchedule.everyNDays
      : splitManual || injInterval < 5
        ? 2
        : 1;

  const weeklyDose = lastDose * injPerWeek;

  const nextInjMs = scheduleActive
    ? (nextScheduledMs(lastInjMs, injSchedule, lastInjMs) ?? lastInjMs + injInterval * 86400000)
    : lastInjMs + injInterval * 86400000;

  return {
    sortedInj,
    lastInj,
    lastInjMs,
    lastDose,
    injInterval,
    scheduleActive,
    weekdayActive,
    intervalActive,
    injPerWeek,
    weeklyDose,
    nextInjMs,
  };
}

export interface WeeklyDoseCycle {
  startMs: number;
  doseMg: number;
  count: number;
}

/** Dedup consecutive cycles that land on the same weekly total. */
export function dedupCycles(cycles: WeeklyDoseCycle[]): WeeklyDoseCycle[] {
  const deduped: WeeklyDoseCycle[] = [];
  let prevDose: number | null = null;
  for (const c of cycles) {
    if (c.doseMg !== prevDose) {
      deduped.push(c);
      prevDose = c.doseMg;
    }
  }
  return deduped;
}

/**
 * A "weekly dose" timeline for charting — two strategies depending on
 * schedule mode: weekday mode sums whatever actually landed in each
 * Sun-Sat week (exact, including uneven splits mid-titration); interval
 * mode (or no schedule) uses the continuous perInjectionDose × injPerWeek
 * estimate instead, since doses/week is often fractional there and literal
 * calendar weeks don't align with the cycle.
 */
export function buildWeeklyDoseCycles(injections: Injection[] | undefined, ds: DoseSchedule | null): WeeklyDoseCycle[] {
  const sortedInj = [...(injections || [])].sort((a, b) => a.date.localeCompare(b.date));
  const injPerWeek = ds ? ds.injPerWeek : 1;

  if (ds && ds.weekdayActive) {
    const weekStartMs = (ms: number) => {
      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      return d.getTime();
    };
    const weekGroups = new Map<number, { doseMg: number; firstMs: number; count: number }>();
    for (const inj of sortedInj) {
      const ms = new Date(`${inj.date}T12:00:00`).getTime();
      const wk = weekStartMs(ms);
      const g = weekGroups.get(wk) ?? { doseMg: 0, firstMs: ms, count: 0 };
      g.doseMg += inj.doseMg;
      g.firstMs = Math.min(g.firstMs, ms);
      g.count++;
      weekGroups.set(wk, g);
    }
    const currentWkMs = weekStartMs(Date.now());
    const groups = [...weekGroups.values()].sort((a, b) => a.firstMs - b.firstMs);
    const cycles = groups.map((g, i): WeeklyDoseCycle => {
      const doseMg = Math.round(g.doseMg * 1000) / 1000;
      const isLast = i === groups.length - 1;
      const effectiveDose =
        isLast && weekStartMs(g.firstMs) === currentWkMs && g.count < injPerWeek
          ? Math.round((doseMg / g.count) * injPerWeek * 1000) / 1000
          : doseMg;
      return { startMs: g.firstMs, doseMg: effectiveDose, count: g.count };
    });
    return dedupCycles(cycles);
  }

  const periods: { rawDose: number; startMs: number; count: number }[] = [];
  for (const inj of sortedInj) {
    const ms = new Date(`${inj.date}T12:00:00`).getTime();
    const last = periods[periods.length - 1];
    if (last && last.rawDose === inj.doseMg) {
      last.count++;
    } else {
      periods.push({ rawDose: inj.doseMg, startMs: ms, count: 1 });
    }
  }
  const cycles = periods.map(
    (p): WeeklyDoseCycle => ({
      startMs: p.startMs,
      doseMg: Math.round(p.rawDose * injPerWeek * 1000) / 1000,
      count: p.count,
    }),
  );
  return dedupCycles(cycles);
}

/** Which weekly dose was active as of `ms` (most recent cycle at-or-before ms). */
export function doseActiveAt(cycles: WeeklyDoseCycle[], ms: number): number | null {
  let d: number | null = null;
  for (const c of cycles) {
    if (c.startMs <= ms) d = c.doseMg;
    else break;
  }
  return d;
}

// ─── Dose recommendation (ported from V1, index.html:1060-1168, 4486-4630) ──
// The most safety-sensitive logic in this app — every threshold/band below
// is copied verbatim from V1, not re-derived, and covered by direct unit
// tests mirroring V1's own documented reasoning for each one.

export const MAX_DOSE_MG = 15;
export const DOSE_STEP_MG = 0.5;
// How long a dose increase holds off the next one being recommended —
// titration guidance generally calls for at least this long before
// reassessing (see the justIncreased note in doseGuidance below).
export const DOSE_INCREASE_HOLD_DAYS = 21;
// How long a user-declared "stay at my dose" override keeps silencing an
// "increase" recommendation before it auto-expires.
export const DOSE_HOLD_EXPIRE_DAYS = 21;
// Daily weight fluctuates — require this many days of trend before guidance
// acts on it, same role as GOAL_AVG_WINDOW_DAYS elsewhere in V1.
export const MAINTENANCE_START_HOLD_DAYS = 14;
// Own constant, not DOSE_INCREASE_HOLD_DAYS — that one's comments are
// specifically about post-*increase* titration in the loss phase.
// Maintenance dose changes go either direction, and twoWeekLoss lags any of
// them the same way.
export const DOSE_MAINTENANCE_HOLD_DAYS = 21;
// Lowest dose this app will suggest stepping down to. Below this, guidance
// stops suggesting a number and defers to the prescriber instead.
export const MIN_MAINTENANCE_DOSE_MG = 2.5;
// Deliberately finer than the loss-phase DOSE_STEP_MG (0.5) — maintenance is
// about finding the *minimum* effective dose, so overshooting a step costs
// more here than during active titration.
export const MAINTENANCE_DOSE_STEP_MG = 0.25;

export type DoseAction = 'contact' | 'monitor' | 'stay' | 'increase';

export interface DoseGuidance {
  action: DoseAction;
  label: string;
  note: string;
  color: string;
  bg: string;
  giOverride?: boolean;
  overridden?: boolean;
  recentlyIncreased?: boolean;
  crossCheckBypassed?: boolean;
}

/**
 * Trend-based increase/stay/monitor/contact guidance. appetiteSignal may
 * only ever soften an 'increase' into a 'stay' — it must never touch
 * 'stay'/'monitor'/'contact', which exist to catch weight loss that's too
 * *fast*, a safety concern orthogonal to appetite mechanism.
 */
export function doseGuidance(
  twoWeekLbs: number | null,
  appetiteSignal: AppetiteSuppressionSignal | null,
  giSignal: GiToleranceSignal | null,
  appetiteCrossCheck: AppetiteCrossCheck | null,
  justIncreased: boolean,
): DoseGuidance | null {
  if (twoWeekLbs == null) return null;
  // giSignal never changes the action for the three safety bands below — it
  // can only append context to the message.
  const giAvgBad = !!giSignal && giSignal.avgNausea >= GI_NAUSEA_BAD;
  const giTodayBad = !!giSignal && giSignal.latestNausea != null && giSignal.latestNausea >= 9;
  const giNote = giAvgBad || giTodayBad ? ` — also reporting significant GI symptoms (avg nausea ${giSignal!.avgNausea.toFixed(1)}/10)` : '';

  if (twoWeekLbs > 8) return { action: 'contact', label: 'Contact prescriber', note: `>8 lbs/2wk${giNote}`, color: '#ff3b30', bg: '#fff1f0' };
  if (twoWeekLbs >= 5) return { action: 'monitor', label: 'Stay — monitor', note: `5–8 lbs/2wk${giNote}`, color: '#ff9500', bg: '#fff8ee' };
  if (twoWeekLbs >= 3) return { action: 'stay', label: 'Stay at dose', note: `3–5 lbs/2wk${giNote}`, color: '#34c759', bg: '#f0fdf4' };

  // Would otherwise be "consider increasing" — GI tolerance is checked
  // first (safety-relevant, takes priority), then the calorie-deficit
  // appetite override only if GI didn't already downgrade the rec.
  if (giAvgBad || giTodayBad) {
    return {
      action: 'stay',
      giOverride: true,
      label: 'Stay — GI tolerability limiting',
      note: giAvgBad
        ? `avg nausea ${giSignal!.avgNausea.toFixed(1)}/10 over the last ${GI_TOLERANCE_WINDOW_DAYS} days`
        : `today's nausea (${giSignal!.latestNausea}/10) is severe enough to hold this week`,
      color: '#34c759',
      bg: '#f0fdf4',
    };
  }

  // A deep, sustained calorie deficit suggests appetite is already well
  // suppressed at the current dose, so hold instead. Restricted to actual
  // (if slow) weight *loss* — twoWeekLbs < 0 means gaining weight despite a
  // supposedly deep deficit, a contradictory signal that needs a look.
  //
  // But: if the hunger/food-noise cross-check *contradicts* this story
  // (still hungry despite the deficit), don't hold on an explanation the
  // subjective data doesn't support — let the trend-based increase stand
  // instead; crossCheckBypassed flags this specific case.
  const deficitQualifies = twoWeekLbs >= 0 && !!appetiteSignal && appetiteSignal.avgDeviation <= -400;
  const contradicted = appetiteCrossCheck?.type === 'contradicted';
  if (deficitQualifies && !contradicted) {
    return {
      action: 'stay',
      overridden: true,
      label: 'Stay — appetite well suppressed',
      note: `${Math.round(Math.abs(appetiteSignal!.avgDeviation))} cal/day under target`,
      color: '#34c759',
      bg: '#f0fdf4',
    };
  }

  // twoWeekLoss is a lagging signal, so it can't possibly reflect a dose
  // change made today or a couple days ago yet. Without this check, the
  // exact same stale reading that justified bumping the dose would
  // immediately recommend bumping it again the moment that injection got
  // logged. Hold instead, for DOSE_INCREASE_HOLD_DAYS from the last actual
  // increase.
  if (justIncreased) {
    return {
      action: 'stay',
      recentlyIncreased: true,
      label: 'Stay — dose recently increased',
      note: `Reassessing ${DOSE_INCREASE_HOLD_DAYS} days after your last increase, once the trend reflects the new dose`,
      color: '#34c759',
      bg: '#f0fdf4',
    };
  }

  return {
    action: 'increase',
    label: 'Consider ↑ dose',
    note: `<3 lbs/2wk${giNote}`,
    color: '#ff9500',
    bg: '#fff8ee',
    crossCheckBypassed: deficitQualifies && contradicted,
  };
}

export interface RecommendedDose {
  dose: number | null;
  g: DoseGuidance;
}

export function recommendedDose(
  currentDoseMg: number,
  twoWeekLbs: number | null,
  appetiteSignal: AppetiteSuppressionSignal | null,
  giSignal: GiToleranceSignal | null,
  appetiteCrossCheck: AppetiteCrossCheck | null,
  justIncreased: boolean,
): RecommendedDose | null {
  const g = doseGuidance(twoWeekLbs, appetiteSignal, giSignal, appetiteCrossCheck, justIncreased);
  if (!g) return null;
  if (g.action === 'increase') {
    const next = Math.round((currentDoseMg + DOSE_STEP_MG) * 10) / 10;
    const dose = next <= MAX_DOSE_MG ? next : null; // null = already at max
    return { dose, g };
  }
  return { dose: currentDoseMg, g };
}

export interface PendingSurvey {
  date: string;
  nausea?: number;
  hunger?: number;
  foodNoise?: number;
}

export interface DoseRecommendation {
  g: DoseGuidance;
  dose: number | null;
  recWeekly: number;
  perInjMg: number;
  appetite: AppetiteSuppressionSignal | null;
  gi: GiToleranceSignal | null;
  crossCheck: AppetiteCrossCheck | null;
  lastIncreaseMs: number | null;
}

/**
 * Trend-based increase/stay/monitor/contact guidance, expressed at the
 * schedule's current cadence (perInjMg = the true partial per-injection
 * amount, not the weekly total).
 */
export function getRecommendation(
  rows: LogbookRow[],
  ds: DoseSchedule | null,
  calories: CalorieRow[] | undefined,
  calorieTargets: DatedTarget[],
  intervalsCalories: Record<string, number> | undefined,
  todayMs: number,
  pendingSurvey: PendingSurvey | null,
): DoseRecommendation | null {
  if (!ds) return null;
  const recent = rows.find((r) => r.twoWeekLoss != null);
  if (!recent) return null;

  const appetite = appetiteSuppressionSignal(calories, calorieTargets, intervalsCalories, todayMs);
  // Fold in today's saved-but-not-yet-logged survey (if any) as a synthetic
  // entry at the current dose — otherwise the whole point of asking before
  // you draw up today's dose is defeated. Only applies when today isn't
  // already logged for real.
  const todayStr = msToLocalDate(todayMs);
  const alreadyLoggedToday = ds.sortedInj.some((i) => i.date === todayStr);
  const sortedInjForSignals =
    pendingSurvey && pendingSurvey.date === todayStr && !alreadyLoggedToday
      ? [...ds.sortedInj, { doseMg: ds.lastDose, ...pendingSurvey, date: todayStr }]
      : ds.sortedInj;
  const gi = giToleranceSignal(sortedInjForSignals, todayMs);
  const crossCheck = subjectiveAppetiteCrossCheck(sortedInjForSignals, todayMs, gi);

  // When was the dose last actually increased (not just re-logged at the
  // same dose)? Based on real logged injections only. Scans backward from
  // the most recent injection so a later re-logged same-dose shot (or even
  // a decrease) doesn't make an increase look further in the past than it is.
  const realSorted = ds.sortedInj;
  let lastIncreaseMs: number | null = null;
  for (let i = realSorted.length - 1; i > 0; i--) {
    if (realSorted[i].doseMg > realSorted[i - 1].doseMg) {
      lastIncreaseMs = new Date(`${realSorted[i].date}T12:00:00`).getTime();
      break;
    }
  }
  const justIncreased = lastIncreaseMs != null && todayMs - lastIncreaseMs < DOSE_INCREASE_HOLD_DAYS * 86400000;

  const rec = recommendedDose(ds.weeklyDose, recent.twoWeekLoss, appetite, gi, crossCheck, justIncreased);
  if (!rec) return null;
  // recWeekly (the step-based weekly target) is the authoritative number.
  // perInjMg is just that number split across the week, shown at 2-decimal
  // precision rather than rounded independently — 3.5 mg/wk / 2 = 1.75
  // mg/injection exactly, and rounding 1.75 to 1 decimal would bump it to
  // 1.8, which no longer multiplies back to 3.5.
  const recWeekly = rec.dose != null ? rec.dose : ds.weeklyDose;
  const perInjMg = recWeekly / ds.injPerWeek;
  return { g: rec.g, dose: rec.dose, recWeekly, perInjMg, appetite, gi, crossCheck, lastIncreaseMs };
}

/**
 * Scans sorted-by-date injections for the most recent dose *change* (any
 * direction) and returns how many days ago it was — null if there's no
 * change to find.
 */
export function daysSinceLastDoseChange(injections: Injection[] | undefined, todayMs: number): number | null {
  const sorted = [...(injections || [])].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = sorted.length - 1; i > 0; i--) {
    if (sorted[i].doseMg !== sorted[i - 1].doseMg) {
      const changeMs = new Date(`${sorted[i].date}T12:00:00`).getTime();
      return Math.floor((todayMs - changeMs) / 86400000);
    }
  }
  return null;
}

export type MaintenanceDoseAction = 'settling-in' | 'hold-reassess' | 'insufficient-data' | 'contact' | 'monitor' | 'stay' | 'floor' | 'decrease' | 'ceiling' | 'increase';

export interface MaintenanceDoseGuidance {
  action: MaintenanceDoseAction;
  color: string;
  bg: string;
  label: string;
  note: string;
  suggestedDoseMg?: number;
}

/**
 * Maintenance-mode's own dose guidance — parallel to doseGuidance, not an
 * extension of it (no appetite/GI override logic needed, since maintenance
 * isn't chasing a loss target). Fully symmetric: regain gets the same
 * treatment as continued loss, both in 0.25mg steps, bounded only by
 * MIN_MAINTENANCE_DOSE_MG / MAX_DOSE_MG.
 */
export function maintenanceDoseGuidance(
  twoWeekLbs: number | null,
  currentDoseMg: number,
  doseChangeHold: boolean,
  daysSinceChange: number | null,
  daysSinceMaintenanceStart: number | null,
  driftLbs: number,
): MaintenanceDoseGuidance {
  // Checked before doseChangeHold — the instant Maintenance Mode starts, the
  // 2-week trend is still measuring the tail end of active loss.
  if (daysSinceMaintenanceStart != null && daysSinceMaintenanceStart < MAINTENANCE_START_HOLD_DAYS) {
    const daysLeft = MAINTENANCE_START_HOLD_DAYS - daysSinceMaintenanceStart;
    return {
      action: 'settling-in',
      color: '#34c759',
      bg: '#f0fdf4',
      label: 'Settling in',
      note: `Maintenance Mode started ${daysSinceMaintenanceStart} day${daysSinceMaintenanceStart === 1 ? '' : 's'} ago — the 2-week trend still reflects active loss, so guidance holds for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}.`,
    };
  }
  if (doseChangeHold) {
    return {
      action: 'hold-reassess',
      color: '#34c759',
      bg: '#f0fdf4',
      label: 'Holding — reassessing soon',
      note: `Dose changed ${daysSinceChange} day${daysSinceChange === 1 ? '' : 's'} ago — trend guidance resumes once the 2-week average reflects it.`,
    };
  }
  if (twoWeekLbs == null) {
    return {
      action: 'insufficient-data',
      color: '#34c759',
      bg: '#f0fdf4',
      label: 'Holding at your dose',
      note: `Trend guidance kicks in once there's ~3 weeks of history.`,
    };
  }
  if (twoWeekLbs <= -8) return { action: 'contact', color: '#ff3b30', bg: '#fff1f0', label: 'Contact prescriber', note: `Gaining >8 lbs/2wk` };
  if (twoWeekLbs <= -5) return { action: 'monitor', color: '#ff9500', bg: '#fff8ee', label: 'Hold — monitor closely', note: `Gaining 5–8 lbs/2wk` };
  if (Math.abs(twoWeekLbs) < driftLbs) return { action: 'stay', color: '#34c759', bg: '#f0fdf4', label: 'Stay at your dose', note: `Holding steady` };

  if (twoWeekLbs >= driftLbs) {
    if (currentDoseMg <= MIN_MAINTENANCE_DOSE_MG) {
      return {
        action: 'floor',
        color: '#34c759',
        bg: '#f0fdf4',
        label: `Stay at ${MIN_MAINTENANCE_DOSE_MG} mg`,
        note: `Already at the lowest dose this app will suggest — further loss is a conversation for your prescriber.`,
      };
    }
    return {
      action: 'decrease',
      color: '#4a90d9',
      bg: '#eef6ff',
      suggestedDoseMg: Math.max(MIN_MAINTENANCE_DOSE_MG, currentDoseMg - MAINTENANCE_DOSE_STEP_MG),
      label: 'Consider ↓ dose',
      note: `Still trending down ${twoWeekLbs.toFixed(1)} lbs/2wk`,
    };
  }
  // twoWeekLbs <= -driftLbs (milder than the -5 monitor band above): gaining.
  if (currentDoseMg >= MAX_DOSE_MG) {
    return { action: 'ceiling', color: '#ff9500', bg: '#fff8ee', label: `Already at ${MAX_DOSE_MG} mg`, note: `Max dose reached — talk to your prescriber` };
  }
  return {
    action: 'increase',
    color: '#4a90d9',
    bg: '#eef6ff',
    suggestedDoseMg: Math.min(MAX_DOSE_MG, currentDoseMg + MAINTENANCE_DOSE_STEP_MG),
    label: 'Consider ↑ dose',
    note: `Trending back up ${Math.abs(twoWeekLbs).toFixed(1)} lbs/2wk`,
  };
}

/**
 * The calorie-adjustment half of Maintenance Mode's two co-equal levers — a
 * flat suggested daily calorie target, not a step like dose. Subtracts the
 * day's actual exercise credit from measured TDEE on every day in the
 * window (not just "workout-flagged" days — see V1's comment for why that
 * flag-only filtering undercounts real exercise).
 */
export function maintenanceCalorieSuggestion(
  calories: CalorieRow[] | undefined,
  intervalsCalories: Record<string, number> | undefined,
  todayMs: number,
  windowDays = 14,
): number | null {
  const lastCompleteStr = msToLocalDate(todayMs - 86400000);
  const cutoff = msToLocalDate(todayMs - (windowDays + 1) * 86400000);
  const baseDays = (calories || [])
    .filter((d) => d.date >= cutoff && d.date <= lastCompleteStr && (d.BasalEnergy || d.ActiveEnergy))
    .map((d) => {
      const rideCal = intervalsCalories ? intervalsCalories[d.date] : null;
      const exercise = Math.min(rideCal != null ? rideCal : d.HasWorkout ? d.ActiveEnergy || 0 : 0, d.ActiveEnergy || 0);
      return (d.BasalEnergy || 0) + (d.ActiveEnergy || 0) - exercise;
    });
  if (!baseDays.length) return null;
  return Math.round(baseDays.reduce((s, v) => s + v, 0) / baseDays.length);
}

/**
 * Deadband on top of maintenanceCalorieSuggestion's raw average, so the
 * *displayed* measured-TDEE only changes when it has genuinely moved, not
 * every time the 14-day window slides by a day. Insufficient data
 * (rawValue == null) keeps showing whatever was last displayed.
 */
export function stickyMeasuredTdee(rawValue: number | null, lastSticky: number | null, threshold = 75): number | null {
  if (rawValue == null) return lastSticky;
  if (lastSticky == null || Math.abs(rawValue - lastSticky) >= threshold) return rawValue;
  return lastSticky;
}

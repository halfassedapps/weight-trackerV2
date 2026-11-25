// Ported from V1 (index.html:1192-1420). One deliberate change:
// `getDoseSchedule` takes `splitManual` as a parameter instead of reading
// `localStorage` directly — V1's version was an otherwise-pure function with
// one hidden side-channel input, which made it untestable without a DOM.
// The caller (a hook, not this module) owns reading the actual preference.
import type { Injection, InjSchedule } from '../gist/types';
import { isIntervalSchedule, isWeekdaySchedule } from '../gist/guards';

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

import { describe, expect, it } from 'vitest';
import {
  buildWeeklyDoseCycles,
  daysSinceLastDoseChange,
  dedupCycles,
  doseActiveAt,
  doseGuidance,
  getDoseSchedule,
  getRecommendation,
  maintenanceCalorieSuggestion,
  maintenanceDoseGuidance,
  nextScheduledMs,
  pkContrib,
  pkTotal,
  recommendedDose,
  stickyMeasuredTdee,
} from '../../../../src/lib/domain/dosing';
import { msToLocalDate } from '../../../../src/lib/domain/csv';
import type { AppetiteSuppressionSignal, GiToleranceSignal } from '../../../../src/lib/domain/tdee';
import type { LogbookRow } from '../../../../src/lib/domain/weightSeries';
import type { CalorieRow, Injection } from '../../../../src/lib/gist/types';

describe('pkContrib / pkTotal', () => {
  it('is zero for a future injection relative to the eval time', () => {
    expect(pkContrib(5, -1)).toBe(0);
  });

  it('is positive and decays as time since the dose grows', () => {
    const soon = pkContrib(5, 1);
    const later = pkContrib(5, 10);
    expect(soon).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThan(soon);
  });

  it('sums contributions from multiple injections', () => {
    const injections = [
      { date: '2026-01-01', doseMg: 5 },
      { date: '2026-01-08', doseMg: 5 },
    ];
    const evalMs = new Date('2026-01-09T12:00:00').getTime();
    const total = pkTotal(injections, evalMs);
    const single = pkContrib(5, 1);
    expect(total).toBeGreaterThan(single); // both doses still contributing
  });
});

describe('nextScheduledMs', () => {
  it('finds the next weekday slot', () => {
    // 2026-01-01 is a Thursday; schedule = Sunday only.
    const afterMs = new Date('2026-01-01T12:00:00').getTime();
    const next = nextScheduledMs(afterMs, [{ day: 0, ampm: 'am' }], null);
    expect(new Date(next!).getDay()).toBe(0);
    expect(next!).toBeGreaterThan(afterMs);
  });

  it('computes the next interval-mode dose from lastInjMs', () => {
    const lastInjMs = new Date('2026-01-01T08:00:00').getTime();
    const next = nextScheduledMs(lastInjMs, { mode: 'interval', everyNDays: 3, ampm: 'am' }, lastInjMs);
    expect(next! - lastInjMs).toBe(3 * 86400000);
  });

  it('returns null for an empty weekday schedule', () => {
    expect(nextScheduledMs(Date.now(), [], null)).toBeNull();
  });
});

describe('getDoseSchedule', () => {
  const injections: Injection[] = [
    { date: '2026-01-01', doseMg: 2.5 },
    { date: '2026-01-05', doseMg: 2.5 },
  ];

  it('returns null with no injections', () => {
    expect(getDoseSchedule([], [], false)).toBeNull();
  });

  it('infers twice-weekly from a short interval when no schedule is set and not split-manual', () => {
    const ds = getDoseSchedule(injections, [], false);
    expect(ds?.injInterval).toBe(4);
    expect(ds?.injPerWeek).toBe(2); // injInterval (4) < 5
    expect(ds?.weeklyDose).toBe(5);
  });

  it('uses the weekday schedule length for injPerWeek when one is set', () => {
    const ds = getDoseSchedule(injections, [{ day: 0, ampm: 'am' }, { day: 4, ampm: 'am' }], false);
    expect(ds?.weekdayActive).toBe(true);
    expect(ds?.injPerWeek).toBe(2);
  });

  it('uses 7/everyNDays for an interval schedule', () => {
    const ds = getDoseSchedule(injections, { mode: 'interval', everyNDays: 2, ampm: 'am' }, false);
    expect(ds?.intervalActive).toBe(true);
    expect(ds?.injPerWeek).toBe(3.5);
  });
});

describe('dedupCycles / doseActiveAt', () => {
  it('collapses consecutive cycles with the same weekly dose', () => {
    const cycles = dedupCycles([
      { startMs: 1, doseMg: 5, count: 1 },
      { startMs: 2, doseMg: 5, count: 1 },
      { startMs: 3, doseMg: 7.5, count: 1 },
    ]);
    expect(cycles).toEqual([
      { startMs: 1, doseMg: 5, count: 1 },
      { startMs: 3, doseMg: 7.5, count: 1 },
    ]);
  });

  it('finds the most recent cycle at-or-before a given ms', () => {
    const cycles = [
      { startMs: 10, doseMg: 5, count: 1 },
      { startMs: 20, doseMg: 7.5, count: 1 },
    ];
    expect(doseActiveAt(cycles, 15)).toBe(5);
    expect(doseActiveAt(cycles, 20)).toBe(7.5);
    expect(doseActiveAt(cycles, 5)).toBeNull();
  });
});

describe('buildWeeklyDoseCycles', () => {
  it('projects a partial current week to the full weekly dose (weekday mode)', () => {
    // Schedule: Sun + Thu, 2.5mg each = 5mg/wk. Only Sunday logged so far
    // this week — the in-progress week should still project to 5mg, not 2.5.
    const sunday = new Date();
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const injections: Injection[] = [{ date: sunday.toISOString().slice(0, 10), doseMg: 2.5 }];
    const ds = getDoseSchedule(injections, [{ day: 0, ampm: 'am' }, { day: 4, ampm: 'am' }], false);
    const cycles = buildWeeklyDoseCycles(injections, ds);
    expect(cycles.at(-1)?.doseMg).toBe(5);
  });
});

describe('doseGuidance', () => {
  it('returns null with no trend data', () => {
    expect(doseGuidance(null, null, null, null, false)).toBeNull();
  });

  it('escalates to contact prescriber above 8 lbs/2wk', () => {
    expect(doseGuidance(8.1, null, null, null, false)?.action).toBe('contact');
  });

  it('is monitor between 5 and 8 lbs/2wk', () => {
    expect(doseGuidance(5, null, null, null, false)?.action).toBe('monitor');
    expect(doseGuidance(8, null, null, null, false)?.action).toBe('monitor');
  });

  it('is stay between 3 and 5 lbs/2wk', () => {
    expect(doseGuidance(3, null, null, null, false)?.action).toBe('stay');
    expect(doseGuidance(4.9, null, null, null, false)?.action).toBe('stay');
  });

  it('recommends increase below 3 lbs/2wk with no overrides', () => {
    const g = doseGuidance(2, null, null, null, false);
    expect(g?.action).toBe('increase');
    expect(g?.crossCheckBypassed).toBe(false);
  });

  it('GI override: holds at stay when avg nausea is bad, even below 3 lbs/2wk', () => {
    const gi: GiToleranceSignal = { avgNausea: 7.5, latestNausea: 6, count: 2, persistent: false, persistentDoseMg: null };
    const g = doseGuidance(1, null, gi, null, false);
    expect(g?.action).toBe('stay');
    expect(g?.giOverride).toBe(true);
  });

  it('GI override: a single severe-today reading holds even with a mild average', () => {
    const gi: GiToleranceSignal = { avgNausea: 3, latestNausea: 9, count: 3, persistent: false, persistentDoseMg: null };
    const g = doseGuidance(1, null, gi, null, false);
    expect(g?.action).toBe('stay');
    expect(g?.giOverride).toBe(true);
  });

  it('GI safety bands are never softened by GI — contact/monitor/stay-3-5 stand regardless', () => {
    const gi: GiToleranceSignal = { avgNausea: 9, latestNausea: 9, count: 3, persistent: false, persistentDoseMg: null };
    expect(doseGuidance(9, null, gi, null, false)?.action).toBe('contact');
    expect(doseGuidance(6, null, gi, null, false)?.action).toBe('monitor');
  });

  it('appetite-suppression override: holds on a deep sustained deficit while actually losing', () => {
    const appetite: AppetiteSuppressionSignal = { avgDeviation: -450, days: 14 };
    const g = doseGuidance(1, appetite, null, null, false);
    expect(g?.action).toBe('stay');
    expect(g?.overridden).toBe(true);
  });

  it('appetite-suppression override does not apply when actually gaining (twoWeekLbs < 0)', () => {
    const appetite: AppetiteSuppressionSignal = { avgDeviation: -450, days: 14 };
    const g = doseGuidance(-1, appetite, null, null, false);
    expect(g?.action).toBe('increase');
  });

  it('a contradicted cross-check bypasses the appetite override, recommending increase instead', () => {
    const appetite: AppetiteSuppressionSignal = { avgDeviation: -450, days: 14 };
    const g = doseGuidance(1, appetite, null, { type: 'contradicted', note: 'still hungry' }, false);
    expect(g?.action).toBe('increase');
    expect(g?.crossCheckBypassed).toBe(true);
  });

  it('holds when justIncreased, even with a trend that would otherwise recommend increase', () => {
    const g = doseGuidance(1, null, null, null, true);
    expect(g?.action).toBe('stay');
    expect(g?.recentlyIncreased).toBe(true);
  });
});

describe('recommendedDose', () => {
  it('steps up by DOSE_STEP_MG on an increase recommendation', () => {
    const r = recommendedDose(2.5, 1, null, null, null, false);
    expect(r?.dose).toBe(3);
    expect(r?.g.action).toBe('increase');
  });

  it('returns null dose (not a number) once stepping up would exceed MAX_DOSE_MG', () => {
    const r = recommendedDose(15, 1, null, null, null, false);
    expect(r?.dose).toBeNull();
  });

  it('holds at the current dose on a stay/monitor/contact recommendation', () => {
    expect(recommendedDose(5, 4, null, null, null, false)?.dose).toBe(5);
  });
});

describe('daysSinceLastDoseChange', () => {
  it('finds the most recent dose change and returns days-ago', () => {
    const todayMs = new Date('2026-02-01T12:00:00').getTime();
    const injections: Injection[] = [
      { date: '2026-01-01', doseMg: 2.5 },
      { date: '2026-01-08', doseMg: 2.5 },
      { date: '2026-01-15', doseMg: 3 },
      { date: '2026-01-22', doseMg: 3 },
    ];
    expect(daysSinceLastDoseChange(injections, todayMs)).toBe(17);
  });

  it('returns null when every injection is the same dose', () => {
    const injections: Injection[] = [
      { date: '2026-01-01', doseMg: 2.5 },
      { date: '2026-01-08', doseMg: 2.5 },
    ];
    expect(daysSinceLastDoseChange(injections, Date.now())).toBeNull();
  });
});

describe('maintenanceDoseGuidance', () => {
  it('is settling-in for the first MAINTENANCE_START_HOLD_DAYS days', () => {
    const g = maintenanceDoseGuidance(1, 5, false, null, 5, 2);
    expect(g.action).toBe('settling-in');
  });

  it('holds and reassesses soon after a recent dose change', () => {
    const g = maintenanceDoseGuidance(1, 5, true, 5, 20, 2);
    expect(g.action).toBe('hold-reassess');
  });

  it('is insufficient-data with no trend yet (but past the settling-in window)', () => {
    expect(maintenanceDoseGuidance(null, 5, false, null, 20, 2).action).toBe('insufficient-data');
  });

  it('escalates to contact when gaining more than 8 lbs/2wk', () => {
    expect(maintenanceDoseGuidance(-8.1, 5, false, null, 20, 2).action).toBe('contact');
  });

  it('is stay within the drift band', () => {
    expect(maintenanceDoseGuidance(1, 5, false, null, 20, 2).action).toBe('stay');
  });

  it('suggests a 0.25mg decrease when trending down past the drift band', () => {
    const g = maintenanceDoseGuidance(3, 5, false, null, 20, 2);
    expect(g.action).toBe('decrease');
    expect(g.suggestedDoseMg).toBe(4.75);
  });

  it('floors at MIN_MAINTENANCE_DOSE_MG instead of suggesting lower', () => {
    const g = maintenanceDoseGuidance(3, 2.5, false, null, 20, 2);
    expect(g.action).toBe('floor');
  });

  it('suggests a 0.25mg increase when trending up (regain) past the drift band', () => {
    const g = maintenanceDoseGuidance(-3, 5, false, null, 20, 2);
    expect(g.action).toBe('increase');
    expect(g.suggestedDoseMg).toBe(5.25);
  });

  it('ceilings at MAX_DOSE_MG instead of suggesting higher', () => {
    const g = maintenanceDoseGuidance(-3, 15, false, null, 20, 2);
    expect(g.action).toBe('ceiling');
  });
});

describe('maintenanceCalorieSuggestion', () => {
  it('averages basal+active minus exercise credit over the trailing complete days', () => {
    const todayMs = new Date('2026-01-20T12:00:00').getTime();
    const calories: CalorieRow[] = [
      { date: '2026-01-18', BasalEnergy: 1600, ActiveEnergy: 400, HasWorkout: true },
      { date: '2026-01-19', BasalEnergy: 1600, ActiveEnergy: 300 },
    ];
    // Day 1: exercise credited (real ride cal 400) -> 1600+400-400 = 1600
    // Day 2: no workout flagged, no intervals data -> exercise=0 -> 1600+300-0=1900
    const result = maintenanceCalorieSuggestion(calories, { '2026-01-18': 400 }, todayMs, 2);
    expect(result).toBe(Math.round((1600 + 1900) / 2));
  });

  it('returns null with no usable days', () => {
    expect(maintenanceCalorieSuggestion([], undefined, Date.now())).toBeNull();
  });
});

describe('stickyMeasuredTdee', () => {
  it('keeps the last sticky value when there is no new data', () => {
    expect(stickyMeasuredTdee(null, 1800)).toBe(1800);
  });
  it('adopts the raw value when there was no prior sticky value', () => {
    expect(stickyMeasuredTdee(1800, null)).toBe(1800);
  });
  it('ignores a small move under the threshold', () => {
    expect(stickyMeasuredTdee(1850, 1800, 75)).toBe(1800);
  });
  it('adopts a move at or past the threshold', () => {
    expect(stickyMeasuredTdee(1876, 1800, 75)).toBe(1876);
  });
});

describe('getRecommendation', () => {
  const rows: LogbookRow[] = [{ date: '2026-01-29', wKg: 80, lbs: 176, movAvg: 176, rate: -1, tenHigh: 178, twoWeekLoss: 2 }];

  it('returns null with no dose schedule', () => {
    expect(getRecommendation(rows, null, [], [], undefined, Date.now(), null)).toBeNull();
  });

  it('returns null when no row has a twoWeekLoss yet', () => {
    const injections: Injection[] = [{ date: '2026-01-01', doseMg: 2.5 }, { date: '2026-01-08', doseMg: 2.5 }];
    const ds = getDoseSchedule(injections, [], false);
    const noTrendRows: LogbookRow[] = [{ date: '2026-01-29', wKg: 80, lbs: 176, movAvg: 176, rate: null, tenHigh: 178, twoWeekLoss: null }];
    expect(getRecommendation(noTrendRows, ds, [], [], undefined, Date.now(), null)).toBeNull();
  });

  it('produces an increase recommendation from a slow trend with no signals, at the schedule cadence', () => {
    const injections: Injection[] = [{ date: '2026-01-01', doseMg: 2.5 }, { date: '2026-01-08', doseMg: 2.5 }];
    const ds = getDoseSchedule(injections, [], false); // injInterval=7 -> injPerWeek=1
    const todayMs = new Date('2026-01-29T12:00:00').getTime();
    const result = getRecommendation(rows, ds, [], [], undefined, todayMs, null);
    expect(result?.g.action).toBe('increase');
    expect(result?.recWeekly).toBe(3); // 2.5 + DOSE_STEP_MG
    expect(result?.perInjMg).toBe(3); // injPerWeek 1 -> same as weekly
  });

  it('folds in a same-day pendingSurvey as a synthetic entry when today is not yet logged for real', () => {
    const injections: Injection[] = [{ date: '2026-01-01', doseMg: 2.5 }, { date: '2026-01-08', doseMg: 2.5 }];
    const ds = getDoseSchedule(injections, [], false);
    const todayMs = new Date('2026-01-29T12:00:00').getTime();
    const todayStr = msToLocalDate(todayMs);
    // Severe nausea logged via the pending (not-yet-saved) survey should
    // still hold the recommendation to 'stay', proving it was folded in.
    const result = getRecommendation(rows, ds, [], [], undefined, todayMs, { date: todayStr, nausea: 9 });
    expect(result?.g.action).toBe('stay');
    expect(result?.g.giOverride).toBe(true);
  });
});

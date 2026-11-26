import { describe, expect, it } from 'vitest';
import {
  appetiteSuppressionSignal,
  calorieDeviationFor,
  exerciseCreditFor,
  giToleranceSignal,
  netTier,
  proteinTier,
  subjectiveAppetiteCrossCheck,
  targetActiveAt,
  upsertDatedTarget,
} from '../../../../src/lib/domain/tdee';
import type { CalorieRow, DatedTarget, Injection } from '../../../../src/lib/gist/types';

describe('netTier', () => {
  it('is good within +-150', () => {
    expect(netTier(0)).toBe('good');
    expect(netTier(150)).toBe('good');
    expect(netTier(-150)).toBe('good');
  });
  it('is ok between the good band and the bad threshold', () => {
    expect(netTier(300)).toBe('ok');
    expect(netTier(-300)).toBe('ok');
  });
  it('is bad past 400 under or 600 over (asymmetric)', () => {
    expect(netTier(-401)).toBe('bad');
    expect(netTier(601)).toBe('bad');
    expect(netTier(-399)).toBe('ok');
    expect(netTier(599)).toBe('ok');
  });
});

describe('targetActiveAt', () => {
  const targets: DatedTarget[] = [
    { date: '2026-01-01', target: 1700 },
    { date: '2026-02-01', target: 1500 },
  ];
  it('returns the most recent target at or before the date', () => {
    expect(targetActiveAt(targets, '2026-01-15')).toBe(1700);
    expect(targetActiveAt(targets, '2026-02-01')).toBe(1500);
    expect(targetActiveAt(targets, '2026-03-01')).toBe(1500);
  });
  it('returns null before the first target', () => {
    expect(targetActiveAt(targets, '2025-12-31')).toBeNull();
  });
});

describe('upsertDatedTarget', () => {
  it('appends a new dated entry, keeping ascending order', () => {
    const targets: DatedTarget[] = [{ date: '2026-01-01', target: 1700 }];
    const result = upsertDatedTarget(targets, '2026-02-01', 1500);
    expect(result).toEqual([
      { date: '2026-01-01', target: 1700 },
      { date: '2026-02-01', target: 1500 },
    ]);
  });

  it('replaces an existing entry for the same date rather than duplicating it', () => {
    const targets: DatedTarget[] = [
      { date: '2026-01-01', target: 1700 },
      { date: '2026-02-01', target: 1500 },
    ];
    const result = upsertDatedTarget(targets, '2026-02-01', 1600);
    expect(result).toEqual([
      { date: '2026-01-01', target: 1700 },
      { date: '2026-02-01', target: 1600 },
    ]);
  });
});

describe('exerciseCreditFor', () => {
  it('prefers real intervals.icu calories when available', () => {
    const d: CalorieRow = { date: '2026-01-01', ActiveEnergy: 500 };
    expect(exerciseCreditFor(d, { '2026-01-01': 300 })).toBe(300);
  });
  it('falls back to ActiveEnergy on a HasWorkout day with no intervals data', () => {
    const d: CalorieRow = { date: '2026-01-01', ActiveEnergy: 400, HasWorkout: true };
    expect(exerciseCreditFor(d, undefined)).toBe(400);
  });
  it('credits nothing on a non-workout day', () => {
    const d: CalorieRow = { date: '2026-01-01', ActiveEnergy: 400 };
    expect(exerciseCreditFor(d, undefined)).toBe(0);
  });
  it('clamps to ActiveEnergy even when intervals.icu reports more', () => {
    const d: CalorieRow = { date: '2026-01-01', ActiveEnergy: 200 };
    expect(exerciseCreditFor(d, { '2026-01-01': 500 })).toBe(200);
  });
});

describe('calorieDeviationFor', () => {
  const targets: DatedTarget[] = [{ date: '2026-01-01', target: 1700 }];
  it('bumps the target up by exercise credit and computes deviation vs. consumed', () => {
    const d: CalorieRow = { date: '2026-01-05', Calories: 2000, ActiveEnergy: 300, HasWorkout: true };
    const result = calorieDeviationFor(d, targets, undefined);
    expect(result.baseTarget).toBe(1700);
    expect(result.exercise).toBe(300);
    expect(result.target).toBe(2000);
    expect(result.deviation).toBe(0);
  });
  it('returns nulls when there is no active target yet', () => {
    const d: CalorieRow = { date: '2025-12-01', Calories: 1800 };
    const result = calorieDeviationFor(d, targets, undefined);
    expect(result.target).toBeNull();
    expect(result.deviation).toBeNull();
  });
});

describe('proteinTier', () => {
  it('returns null with no target', () => {
    expect(proteinTier(150, null)).toBeNull();
  });
  it('is good at or above the floor', () => {
    expect(proteinTier(171, 171)).toBe('good');
    expect(proteinTier(200, 171)).toBe('good');
  });
  it('is ok between 85% and the floor', () => {
    expect(proteinTier(150, 171)).toBe('ok'); // ~87.7%
  });
  it('is bad below 85% of the floor', () => {
    expect(proteinTier(100, 171)).toBe('bad'); // ~58.5%
  });
});

describe('appetiteSuppressionSignal', () => {
  const targets: DatedTarget[] = [{ date: '2026-01-01', target: 1700 }];

  function dayRow(date: string, calories: number): CalorieRow {
    return { date, Calories: calories };
  }

  it('returns null with fewer than 7 complete days of data', () => {
    const calories = ['2026-01-10', '2026-01-11'].map((d) => dayRow(d, 1300));
    const todayMs = new Date('2026-01-12T12:00:00').getTime();
    expect(appetiteSuppressionSignal(calories, targets, undefined, todayMs, 14)).toBeNull();
  });

  it('averages the deviation across the trailing complete days, excluding today', () => {
    const dates = ['2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14'];
    const calories = [...dates.map((d) => dayRow(d, 1300)), dayRow('2026-01-15', 1)]; // today, should be excluded
    const todayMs = new Date('2026-01-15T12:00:00').getTime();
    const result = appetiteSuppressionSignal(calories, targets, undefined, todayMs, 14);
    expect(result?.days).toBe(7);
    expect(result?.avgDeviation).toBe(1300 - 1700);
  });
});

describe('giToleranceSignal', () => {
  it('returns null with no nausea data in the window', () => {
    expect(giToleranceSignal([], Date.now())).toBeNull();
  });

  it('averages nausea across surveyed injections in the window and tracks the latest reading', () => {
    const todayMs = new Date('2026-02-01T12:00:00').getTime();
    const injections: Injection[] = [
      { date: '2026-01-10', doseMg: 2.5, nausea: 4 },
      { date: '2026-01-20', doseMg: 2.5, nausea: 6 },
    ];
    const result = giToleranceSignal(injections, todayMs);
    expect(result?.avgNausea).toBe(5);
    expect(result?.latestNausea).toBe(6);
    expect(result?.count).toBe(2);
  });

  it('flags persistent intolerance when the last two surveyed injections at the same dose are both >= 7', () => {
    const todayMs = new Date('2026-02-01T12:00:00').getTime();
    const injections: Injection[] = [
      { date: '2026-01-10', doseMg: 2.5, nausea: 8 },
      { date: '2026-01-20', doseMg: 2.5, nausea: 7 },
    ];
    const result = giToleranceSignal(injections, todayMs);
    expect(result?.persistent).toBe(true);
    expect(result?.persistentDoseMg).toBe(2.5);
  });

  it('does not flag persistent intolerance across a dose change', () => {
    const todayMs = new Date('2026-02-01T12:00:00').getTime();
    const injections: Injection[] = [
      { date: '2026-01-10', doseMg: 2.5, nausea: 8 },
      { date: '2026-01-20', doseMg: 3, nausea: 7 },
    ];
    expect(giToleranceSignal(injections, todayMs)?.persistent).toBe(false);
  });
});

describe('subjectiveAppetiteCrossCheck', () => {
  const todayMs = new Date('2026-02-01T12:00:00').getTime();

  it('returns null with no hunger/food-noise data', () => {
    expect(subjectiveAppetiteCrossCheck([], todayMs, null)).toBeNull();
  });

  it('corroborates when both hunger and food noise are low', () => {
    const injections: Injection[] = [{ date: '2026-01-20', doseMg: 2.5, hunger: 2, foodNoise: 2 }];
    const result = subjectiveAppetiteCrossCheck(injections, todayMs, null);
    expect(result?.type).toBe('corroborated');
  });

  it('contradicts when still hungry despite the deficit', () => {
    const injections: Injection[] = [{ date: '2026-01-20', doseMg: 2.5, hunger: 7, foodNoise: 7 }];
    const result = subjectiveAppetiteCrossCheck(injections, todayMs, null);
    expect(result?.type).toBe('contradicted');
  });

  it('returns null (neither corroborated nor contradicted) for ambiguous middling values', () => {
    const injections: Injection[] = [{ date: '2026-01-20', doseMg: 2.5, hunger: 5, foodNoise: 5 }];
    expect(subjectiveAppetiteCrossCheck(injections, todayMs, null)).toBeNull();
  });
});

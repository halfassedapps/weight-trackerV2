import { describe, expect, it } from 'vitest';
import { calorieDeviationFor, exerciseCreditFor, netTier, proteinTier, targetActiveAt } from '../../../../src/lib/domain/tdee';
import type { CalorieRow, DatedTarget } from '../../../../src/lib/gist/types';

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

import { describe, expect, it } from 'vitest';
import { computeLogbook, toLbs } from '../../../../src/lib/domain/weightSeries';

describe('toLbs', () => {
  it('converts kg to lbs', () => {
    expect(toLbs(100)).toBeCloseTo(220.462, 2);
  });
});

describe('computeLogbook', () => {
  // 21 consecutive days, newest-first, losing exactly 0.1kg/day so the
  // moving-average/rate math has a predictable shape to assert against.
  const days = Array.from({ length: 21 }, (_, i) => ({
    date: `2026-01-${String(21 - i).padStart(2, '0')}`,
    wKg: 80 - i * 0.1,
  }));

  it('computes a 7-entry moving average for the newest row', () => {
    const [first] = computeLogbook(days);
    const expectedAvgKg = (80 + 79.9 + 79.8 + 79.7 + 79.6 + 79.5 + 79.4) / 7;
    expect(first.movAvg).toBeCloseTo(toLbs(expectedAvgKg), 5);
  });

  it('leaves rate/twoWeekLoss null when there is not enough trailing history', () => {
    const logbook = computeLogbook(days);
    // Only the oldest rows lack a full 7-or-14-day lookback window.
    expect(logbook[0].rate).not.toBeNull();
    expect(logbook[logbook.length - 1].rate).toBeNull();
    expect(logbook[logbook.length - 1].twoWeekLoss).toBeNull();
  });

  it('returns an empty array for empty input', () => {
    expect(computeLogbook([])).toEqual([]);
  });
});

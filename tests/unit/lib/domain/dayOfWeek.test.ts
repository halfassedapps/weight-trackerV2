import { describe, expect, it } from 'vitest';
import { buildDayOfWeekBars, computeDayOfWeekDeltas } from '../../../../src/lib/domain/dayOfWeek';

describe('computeDayOfWeekDeltas', () => {
  it('computes today-minus-yesterday for consecutive calendar days', () => {
    // 2026-01-05 is a Monday. Newest-first.
    const rows = [
      { date: '2026-01-05', lbs: 180 },
      { date: '2026-01-04', lbs: 181 },
    ];
    const deltas = computeDayOfWeekDeltas(rows);
    expect(deltas[1]).toEqual([{ date: '2026-01-05', delta: -1 }]); // Monday bucket
  });

  it('skips a pair that is not actually consecutive (a logging gap)', () => {
    const rows = [
      { date: '2026-01-10', lbs: 180 },
      { date: '2026-01-05', lbs: 181 },
    ];
    const deltas = computeDayOfWeekDeltas(rows);
    expect(deltas.every((d) => d.length === 0)).toBe(true);
  });
});

describe('buildDayOfWeekBars', () => {
  it('orders bars Monday through Sunday', () => {
    const bars = buildDayOfWeekBars([[], [], [], [], [], [], []]);
    expect(bars.map((b) => b.wd)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('averages deltas for a weekday and reports null when there are none', () => {
    const dayDeltas: ReturnType<typeof computeDayOfWeekDeltas> = [[], [], [], [], [], [], []];
    dayDeltas[1] = [
      { date: '2026-01-05', delta: -1 },
      { date: '2026-01-12', delta: -0.5 },
    ];
    const bars = buildDayOfWeekBars(dayDeltas);
    const monday = bars.find((b) => b.dow === 1)!;
    expect(monday.avg).toBeCloseTo(-0.75, 5);
    expect(monday.count).toBe(2);
    const sunday = bars.find((b) => b.dow === 0)!;
    expect(sunday.avg).toBeNull();
  });
});

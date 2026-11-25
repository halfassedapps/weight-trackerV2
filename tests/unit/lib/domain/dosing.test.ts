import { describe, expect, it } from 'vitest';
import {
  buildWeeklyDoseCycles,
  dedupCycles,
  doseActiveAt,
  getDoseSchedule,
  nextScheduledMs,
  pkContrib,
  pkTotal,
} from '../../../../src/lib/domain/dosing';
import type { Injection } from '../../../../src/lib/gist/types';

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

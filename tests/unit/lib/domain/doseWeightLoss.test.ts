import { describe, expect, it } from 'vitest';
import { computeDoseWeightLossPeriods } from '../../../../src/lib/domain/doseWeightLoss';
import type { Injection } from '../../../../src/lib/gist/types';

describe('computeDoseWeightLossPeriods', () => {
  const todayMs = new Date('2026-02-01T12:00:00').getTime();

  it('returns null with fewer than 2 weigh-ins or fewer than 2 injections', () => {
    expect(computeDoseWeightLossPeriods([], [], [], todayMs)).toBeNull();
    expect(
      computeDoseWeightLossPeriods(
        [{ date: '2026-01-01', lbs: 200 }],
        [{ date: '2026-01-01', doseMg: 2.5 }],
        [],
        todayMs,
      ),
    ).toBeNull();
  });

  it('returns null when there are fewer than 2 distinct weekly-dose periods', () => {
    const rows = [
      { date: '2026-01-15', lbs: 195 },
      { date: '2026-01-01', lbs: 200 },
    ];
    const injections: Injection[] = [
      { date: '2026-01-01', doseMg: 2.5 },
      { date: '2026-01-08', doseMg: 2.5 },
    ];
    expect(computeDoseWeightLossPeriods(rows, injections, [], todayMs)).toBeNull();
  });

  it('computes lbs lost per dose period via linear interpolation between weigh-ins', () => {
    // Rows newest-first; interval-mode schedule (no weekday schedule) so
    // dose periods are "contiguous runs of the same per-injection dose".
    const rows = [
      { date: '2026-01-15', lbs: 190 },
      { date: '2026-01-01', lbs: 200 },
    ];
    const injections: Injection[] = [
      { date: '2026-01-01', doseMg: 2.5 },
      { date: '2026-01-08', doseMg: 5 }, // dose change here
    ];
    const periods = computeDoseWeightLossPeriods(rows, injections, [], todayMs)!;
    expect(periods).not.toBeNull();
    expect(periods).toHaveLength(2);
    // First period: Jan 1 (200 lbs) -> Jan 8 (interpolated ~195 lbs) = ~5 lbs lost
    expect(periods[0].lostLbs).toBeCloseTo(5, 0);
    expect(periods[0].doseMg).toBeGreaterThan(0);
  });
});

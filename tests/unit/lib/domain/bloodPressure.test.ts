import { describe, expect, it } from 'vitest';
import { bpCategory, clusterBpReadings, computeDailyBp } from '../../../../src/lib/domain/bloodPressure';
import type { BpReading } from '../../../../src/lib/gist/types';

const reading = (ms: number, systolic: number, diastolic: number): BpReading => ({
  date: new Date(ms).toISOString().slice(0, 10),
  ms,
  systolic,
  diastolic,
});

describe('clusterBpReadings', () => {
  it('uses a single reading as-is', () => {
    const [s] = clusterBpReadings([reading(0, 130, 85)]);
    expect(s.systolic).toBe(130);
    expect(s.diastolic).toBe(85);
    expect(s.readingCount).toBe(1);
  });

  it('uses the lower reading outright for exactly two in the same sitting', () => {
    const [s] = clusterBpReadings([reading(0, 140, 90), reading(60_000, 120, 80)]);
    expect(s.systolic).toBe(120);
    expect(s.diastolic).toBe(80);
    expect(s.readingCount).toBe(2);
  });

  it('averages the lowest two (paired) for three or more in the same sitting', () => {
    const [s] = clusterBpReadings([reading(0, 150, 95), reading(60_000, 120, 80), reading(120_000, 125, 82)]);
    expect(s.systolic).toBeCloseTo((120 + 125) / 2, 5);
    expect(s.diastolic).toBeCloseTo((80 + 82) / 2, 5);
  });

  it('starts a new sitting after a >15min gap even on the same day', () => {
    const sittings = clusterBpReadings([reading(0, 120, 80), reading(16 * 60_000, 125, 82)]);
    expect(sittings).toHaveLength(2);
  });
});

describe('computeDailyBp', () => {
  it('collapses multiple sittings in one day to a single point', () => {
    const am = new Date('2026-01-01T08:00:00').getTime();
    const pm = new Date('2026-01-01T20:00:00').getTime();
    const daily = computeDailyBp([reading(am, 120, 80), reading(pm, 130, 85)]);
    expect(daily).toHaveLength(1);
    expect(daily[0].sittingCount).toBe(2);
    expect(daily[0].readings).toHaveLength(2);
  });
});

describe('bpCategory', () => {
  it('categorizes normal, elevated, stage1 (via diastolic), stage2, and crisis', () => {
    expect(bpCategory(115, 75).key).toBe('normal');
    expect(bpCategory(125, 75).key).toBe('elevated');
    expect(bpCategory(115, 82).key).toBe('stage1'); // diastolic alone triggers stage1, not elevated
    expect(bpCategory(145, 70).key).toBe('stage2');
    expect(bpCategory(185, 70).key).toBe('crisis');
  });
});

import { describe, expect, it } from 'vitest';
import { binPtsByUnit, buildTrendLines, fitTrendLine } from '../../../../src/lib/domain/trendLine';

describe('binPtsByUnit', () => {
  it('groups points into Sunday-anchored weekly buckets', () => {
    // 2026-01-04 is a Sunday
    const points = [
      { ms: new Date('2026-01-04T12:00:00').getTime(), lbs: 200 },
      { ms: new Date('2026-01-05T12:00:00').getTime(), lbs: 198 },
      { ms: new Date('2026-01-11T12:00:00').getTime(), lbs: 196 },
    ];
    const bins = binPtsByUnit(points, 'week');
    expect(bins).toHaveLength(2);
    expect(bins[0].lbs).toBe(199);
    expect(bins[0].n).toBe(2);
    expect(bins[1].lbs).toBe(196);
  });

  it('groups points into calendar-month buckets', () => {
    const points = [
      { ms: new Date('2026-01-15T12:00:00').getTime(), lbs: 200 },
      { ms: new Date('2026-01-20T12:00:00').getTime(), lbs: 198 },
      { ms: new Date('2026-02-02T12:00:00').getTime(), lbs: 196 },
    ];
    const bins = binPtsByUnit(points, 'month');
    expect(bins).toHaveLength(2);
    expect(bins[0].n).toBe(2);
  });

  it('clamps a bucket boundary before minMs into the visible window start', () => {
    const points = [
      { ms: new Date('2026-01-05T12:00:00').getTime(), lbs: 200 }, // week of Jan 4
      { ms: new Date('2026-01-07T12:00:00').getTime(), lbs: 198 },
    ];
    const minMs = new Date('2026-01-06T00:00:00').getTime();
    const bins = binPtsByUnit(points, 'week', minMs);
    expect(bins).toHaveLength(1);
    expect(bins[0].ms).toBe(minMs);
  });
});

describe('fitTrendLine', () => {
  it('fits a perfect downward line exactly', () => {
    const originMs = new Date('2026-01-01T12:00:00').getTime();
    const pts = Array.from({ length: 10 }, (_, i) => ({
      ms: originMs + i * 86400000,
      lbs: 200 - i, // -1 lb/day
    }));
    const fit = fitTrendLine(pts, originMs, 0, originMs + 9 * 86400000);
    expect(fit.slope).toBeCloseTo(-1, 5);
    expect(fit.at(originMs)).toBeCloseTo(200, 5);
    expect(fit.at(originMs + 5 * 86400000)).toBeCloseTo(195, 5);
  });

  it('falls back to the full point set when the trendDays window has fewer than 4 points', () => {
    const originMs = new Date('2026-01-01T12:00:00').getTime();
    const todayMs = originMs + 29 * 86400000;
    const pts = Array.from({ length: 30 }, (_, i) => ({ ms: originMs + i * 86400000, lbs: 200 - i * 0.5 }));
    // A 1-day trend window only catches the very last point — falls back to all 30.
    const fit = fitTrendLine(pts, originMs, 1, todayMs);
    expect(fit.slope).toBeCloseTo(-0.5, 5);
  });
});

describe('buildTrendLines', () => {
  const startMs = new Date('2026-01-01T12:00:00').getTime();
  const todayMs = startMs + 60 * 86400000;
  const fit = { slope: -1, intercept: 200, at: (ms: number) => 200 + -1 * ((ms - startMs) / 86400000) };

  it('projects the current regression line to its goal date', () => {
    const lines = buildTrendLines(['current'], fit, startMs, todayMs, 150);
    expect(lines).toHaveLength(1);
    expect(lines[0].goalMs).not.toBeNull();
    // fit.at(ms) = 200 - days; reaches 150 lbs at day 50
    expect(lines[0].goalMs).toBeCloseTo(startMs + 50 * 86400000, -2);
  });

  it('fans a hypothetical rate line from today toward goal', () => {
    const lines = buildTrendLines(['r2'], fit, startMs, todayMs, 100);
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('r2');
    expect(lines[0].goalMs).not.toBeNull();
    expect(lines[0].goalMs!).toBeGreaterThan(todayMs);
  });

  it('omits a rate line goal date when already at or below goal', () => {
    const lines = buildTrendLines(['r1'], fit, startMs, todayMs, 500);
    expect(lines[0].goalMs).toBeNull();
  });

  it('returns nothing for unchecked ids', () => {
    expect(buildTrendLines([], fit, startMs, todayMs, 150)).toHaveLength(0);
  });
});

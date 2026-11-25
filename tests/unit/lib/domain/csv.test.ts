import { describe, expect, it } from 'vitest';
import {
  buildBpReadings,
  buildCalorieMap,
  buildDailyMap,
  detectSchema,
  mergeBpByMs,
  mergeCaloriesByDate,
  mergeEntriesByDate,
  parseCSV,
  processCSVText,
  splitLine,
} from '../../../../src/lib/domain/csv';

describe('splitLine', () => {
  it('splits plain comma-separated values', () => {
    expect(splitLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('respects double-quoted values containing commas', () => {
    expect(splitLine('a,"b, with comma",c')).toEqual(['a', 'b, with comma', 'c']);
  });
});

describe('parseCSV', () => {
  it('parses a header row plus data rows into objects', () => {
    const rows = parseCSV('Date,Value\n2026-01-01,180\n2026-01-02,179');
    expect(rows).toEqual([
      { Date: '2026-01-01', Value: '180' },
      { Date: '2026-01-02', Value: '179' },
    ]);
  });
  it('returns empty for a header-only or empty CSV', () => {
    expect(parseCSV('Date,Value')).toEqual([]);
    expect(parseCSV('')).toEqual([]);
  });
});

describe('detectSchema', () => {
  it('detects long format and finds the weight metric among several', () => {
    const rows = parseCSV(
      'Date,Metric,Value,Units\n' +
        '2026-01-01,Weight Body Mass,81.5,kg\n' +
        '2026-01-01,Active Energy,400,kcal\n',
    );
    const schema = detectSchema(Object.keys(rows[0]), rows);
    expect(schema.format).toBe('long');
    expect(schema.weightMetric).toBe('Weight Body Mass');
    expect(schema.allMetrics).toContain('Active Energy');
  });

  it('detects wide format when there is a weight column but no metric column', () => {
    const rows = parseCSV('Date,Weight,Units\n2026-01-01,180,lbs\n');
    const schema = detectSchema(Object.keys(rows[0]), rows);
    expect(schema.format).toBe('wide');
  });

  it('is unknown when neither shape matches', () => {
    const rows = parseCSV('Foo,Bar\n1,2\n');
    const schema = detectSchema(Object.keys(rows[0]), rows);
    expect(schema.format).toBe('unknown');
  });
});

const LONG_CSV = [
  'Date,Metric,Value,Units,Source',
  '2026-01-01T08:00:00,Weight Body Mass,180,lb,HealthFit',
  '2026-01-01T09:00:00,Dietary Energy (Calories),2000,kcal,HealthFit',
  '2026-01-01T09:00:00,Active Energy,400,kcal,HealthFit',
  '2026-01-01T09:00:00,Basal Energy Burned,1600,kcal,HealthFit',
  '2026-01-01T09:00:00,Dietary Protein,150,g,HealthFit',
  '2026-01-01T09:00:00,Workout,,,HealthFit',
  '2026-01-01T07:00:00,Blood Pressure Systolic,120,mmHg,HealthFit',
  '2026-01-01T07:00:00,Blood Pressure Diastolic,78,mmHg,HealthFit',
  '2026-01-02T08:00:00,Weight Body Mass,179.5,lb,HealthFit',
].join('\n');

describe('buildCalorieMap', () => {
  it('aggregates per-day calorie/macro/workout metrics', () => {
    const parsed = parseCSV(LONG_CSV);
    const schema = detectSchema(Object.keys(parsed[0]), parsed);
    const map = buildCalorieMap(parsed, schema);
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({ date: '2026-01-01', Calories: 2000, ActiveEnergy: 400, BasalEnergy: 1600, Protein: 150, HasWorkout: true });
  });
});

describe('buildBpReadings', () => {
  it('pairs systolic+diastolic rows sharing the same timestamp', () => {
    const parsed = parseCSV(LONG_CSV);
    const schema = detectSchema(Object.keys(parsed[0]), parsed);
    const readings = buildBpReadings(parsed, schema);
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ systolic: 120, diastolic: 78 });
  });

  it('drops unpaired readings (only one of systolic/diastolic present)', () => {
    const parsed = parseCSV(
      'Date,Metric,Value,Units\n2026-01-01T07:00:00,Blood Pressure Systolic,120,mmHg\n2026-01-02T07:00:00,Blood Pressure Diastolic,80,mmHg\n',
    );
    const schema = detectSchema(Object.keys(parsed[0]), parsed);
    expect(buildBpReadings(parsed, schema)).toEqual([]);
  });
});

describe('buildDailyMap', () => {
  it('converts lb to kg and keeps the latest reading per day', () => {
    const parsed = parseCSV(LONG_CSV);
    const schema = detectSchema(Object.keys(parsed[0]), parsed);
    const daily = buildDailyMap(parsed, schema);
    expect(daily).toHaveLength(2);
    const jan1 = daily.find((d) => d.date === '2026-01-01')!;
    expect(jan1.wKg).toBeCloseTo(180 / 2.20462, 4);
  });
});

describe('processCSVText', () => {
  it('parses a full long-format export into weight/calorie/BP rows', () => {
    const result = processCSVText(LONG_CSV);
    expect(result.weightEntries).toHaveLength(2);
    expect(result.meta.metric).toBe('Weight Body Mass');
    expect(result.meta.source).toBe('HealthFit');
    expect(result.calorieData).toHaveLength(1);
    expect(result.bpData).toHaveLength(1);
  });

  it('throws on an empty CSV', () => {
    expect(() => processCSVText('')).toThrow('empty');
  });

  it('throws when no weight metric is present in a long-format export', () => {
    const csv = 'Date,Metric,Value,Units\n2026-01-01,Active Energy,400,kcal\n';
    expect(() => processCSVText(csv)).toThrow('No weight metric found');
  });
});

describe('merge helpers', () => {
  it('mergeEntriesByDate: incoming rows win on date collision, sorted newest-first', () => {
    const current = [
      { date: '2026-01-01', wKg: 80 },
      { date: '2026-01-03', wKg: 79 },
    ];
    const incoming = [{ date: '2026-01-01', wKg: 81.5 }];
    const merged = mergeEntriesByDate(current, incoming);
    expect(merged).toEqual([
      { date: '2026-01-03', wKg: 79 },
      { date: '2026-01-01', wKg: 81.5 },
    ]);
  });

  it('mergeCaloriesByDate: incoming rows win on date collision, sorted oldest-first', () => {
    const current = [{ date: '2026-01-02', Calories: 1800 }];
    const incoming = [{ date: '2026-01-01', Calories: 1700 }, { date: '2026-01-02', Calories: 1900 }];
    const merged = mergeCaloriesByDate(current, incoming);
    expect(merged.map((c) => c.Calories)).toEqual([1700, 1900]);
  });

  it('mergeBpByMs: incoming rows win on exact-ms collision, sorted by ms', () => {
    const current = [{ date: '2026-01-01', ms: 100, systolic: 120, diastolic: 80 }];
    const incoming = [{ date: '2026-01-01', ms: 100, systolic: 118, diastolic: 76 }, { date: '2026-01-02', ms: 200, systolic: 122, diastolic: 81 }];
    const merged = mergeBpByMs(current, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ systolic: 118, diastolic: 76 });
  });
});

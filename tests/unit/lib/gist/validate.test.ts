import { describe, expect, it } from 'vitest';
import { normalizeGistPayload } from '../../../../src/lib/gist/validate';
import {
  DEFAULT_CALORIE_TARGETS,
  DEFAULT_PROTEIN_TARGETS,
  GOAL_LBS_DEFAULT,
  HEIGHT_IN_DEFAULT,
  MAINTENANCE_DRIFT_LBS_DEFAULT,
} from '../../../../src/lib/gist/defaults';
import type { RawGistPayload } from '../../../../src/lib/gist/types';
import sample from '../../../fixtures/weight-data.sample.json';

describe('normalizeGistPayload', () => {
  it('round-trips a fully-populated real-shaped payload unchanged', () => {
    const normalized = normalizeGistPayload(sample as RawGistPayload);
    // entries/calories/etc. pass through as-is when already valid+sorted.
    expect(normalized.goalLbs).toBe(170);
    expect(normalized.heightIn).toBe(70);
    expect(normalized.maintenanceDriftLbs).toBe(2.5);
    expect(normalized.intervalsActivities).toEqual(sample.intervalsActivities);
    expect(normalized.bmrProfile).toEqual(sample.bmrProfile);
    expect(normalized.injSchedule).toEqual(sample.injSchedule);
    expect(normalized.maintenanceHistory).toEqual(sample.maintenanceHistory);
  });

  it('applies every documented default when fields are missing — this is the direct guard against the full-PATCH "silently deletes an unlisted field" class of bug', () => {
    const normalized = normalizeGistPayload({});
    expect(normalized.goalLbs).toBe(GOAL_LBS_DEFAULT);
    expect(normalized.heightIn).toBe(HEIGHT_IN_DEFAULT);
    expect(normalized.maintenanceDriftLbs).toBe(MAINTENANCE_DRIFT_LBS_DEFAULT);
    expect(normalized.calorieTargets).toEqual(DEFAULT_CALORIE_TARGETS);
    expect(normalized.proteinTargets).toEqual(DEFAULT_PROTEIN_TARGETS);
    expect(normalized.entries).toEqual([]);
    expect(normalized.injections).toEqual([]);
    expect(normalized.injSchedule).toEqual([]);
    expect(normalized.calories).toEqual([]);
    expect(normalized.intervalsActivities).toBeNull();
    expect(normalized.bloodPressure).toEqual([]);
    expect(normalized.weightAnnotations).toEqual([]);
    expect(normalized.maintenanceHistory).toEqual([]);
    expect(normalized.bmrProfile).toBeNull();
    expect(normalized.meta).toEqual({ metric: 'Weight', source: '' });
  });

  it('never drops intervalsActivities (watcher-only field) when passed through unmodified', () => {
    const normalized = normalizeGistPayload(sample as RawGistPayload);
    expect(normalized.intervalsActivities).not.toBeNull();
    expect(normalized.intervalsActivities?.calMap).toEqual(sample.intervalsActivities.calMap);
  });

  it('dedupes entries by date, keeping sorted newest-first', () => {
    const normalized = normalizeGistPayload({
      entries: [
        { date: '2026-01-01', wKg: 80 },
        { date: '2026-01-03', wKg: 79 },
        { date: '2026-01-01', wKg: 80.5 }, // duplicate date, later in array wins per V1's Set-based dedup
      ],
    });
    expect(normalized.entries.map((e) => e.date)).toEqual(['2026-01-03', '2026-01-01']);
  });

  it('falls back to defaults for an out-of-range activityLevel instead of accepting garbage', () => {
    const normalized = normalizeGistPayload({
      bmrProfile: { age: 30, sex: 'female', activityLevel: 'not-a-real-level' },
    });
    expect(normalized.bmrProfile).toEqual({ age: 30, sex: 'female', activityLevel: 'sedentary' });
  });

  it('accepts both weekday and interval injSchedule shapes', () => {
    const weekday = normalizeGistPayload({ injSchedule: [{ day: 2, ampm: 'pm' }] });
    expect(weekday.injSchedule).toEqual([{ day: 2, ampm: 'pm' }]);

    const interval = normalizeGistPayload({
      injSchedule: { mode: 'interval', everyNDays: 3, ampm: 'am' },
    });
    expect(interval.injSchedule).toEqual({ mode: 'interval', everyNDays: 3, ampm: 'am' });
  });
});

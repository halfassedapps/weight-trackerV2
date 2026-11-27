// Mirrors V1's `parseGistPayload` (index.html:669-711) validation/default
// rules field-for-field, so a payload normalized here and one parsed by V1
// agree on what every field means. One deliberate difference: V1's
// `parseGistPayload` returns a *computed* `logbook` (via `computeLogbook`)
// instead of raw `entries` — that's a presentation-layer transform, not part
// of the Gist schema, so it belongs in `lib/domain/`, not here. This function
// returns the raw, schema-shaped `GistPayload` only.
import {
  BMR_ACTIVITY_LEVELS,
  DEFAULT_CALORIE_TARGETS,
  DEFAULT_PROTEIN_TARGETS,
  GOAL_LBS_DEFAULT,
  HEIGHT_IN_DEFAULT,
  MAINTENANCE_DRIFT_LBS_DEFAULT,
} from './defaults';
import { isValidInjSchedule } from './guards';
import type {
  BmrProfile,
  BpReading,
  CalorieRow,
  DatedTarget,
  GistPayload,
  Injection,
  IntervalsActivities,
  MaintenanceHistoryEntry,
  RawGistPayload,
  WeightAnnotation,
  WeightEntry,
} from './types';

function normalizeEntries(raw: unknown): WeightEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return (raw as WeightEntry[])
    .filter((e) => e && e.date && e.wKg != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((e) => {
      if (seen.has(e.date)) return false;
      seen.add(e.date);
      return true;
    });
}

function normalizeInjections(raw: unknown): Injection[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Injection[]).filter((i) => i && i.date && i.doseMg != null);
}

function normalizeCalories(raw: unknown): CalorieRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as CalorieRow[]).filter((c) => c && c.date);
}

function normalizeIntervalsActivities(raw: unknown): IntervalsActivities | null {
  const v = raw as IntervalsActivities | null | undefined;
  return v && (v.calMap || v.ridesMap) ? v : null;
}

function normalizeDatedTargets(raw: unknown, fallback: DatedTarget[]): DatedTarget[] {
  if (Array.isArray(raw) && raw.length) {
    return [...(raw as DatedTarget[])].sort((a, b) => a.date.localeCompare(b.date));
  }
  return fallback;
}

function normalizeBloodPressure(raw: unknown): BpReading[] {
  if (!Array.isArray(raw)) return [];
  return (raw as BpReading[]).filter(
    (s) => s && s.date && s.ms != null && ((s.systolic != null && s.diastolic != null) || (typeof s.note === 'string' && s.note.trim() !== '')),
  );
}

function normalizeWeightAnnotations(raw: unknown): WeightAnnotation[] {
  if (!Array.isArray(raw)) return [];
  return (raw as WeightAnnotation[]).filter((a) => a && a.id && a.startDate && a.endDate && a.label);
}

function normalizeMaintenanceHistory(raw: unknown): MaintenanceHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as MaintenanceHistoryEntry[])
    .filter((h) => h && h.date && (h.action === 'start' || h.action === 'stop') && h.doseMg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeBmrProfile(raw: unknown): BmrProfile | null {
  const v = raw as Partial<BmrProfile> | null | undefined;
  if (!v || typeof v.age !== 'number' || v.age <= 0) return null;
  return {
    age: v.age,
    sex: v.sex === 'female' ? 'female' : 'male',
    activityLevel: BMR_ACTIVITY_LEVELS.some((a) => a.id === v.activityLevel)
      ? (v.activityLevel as BmrProfile['activityLevel'])
      : 'sedentary',
  };
}

/**
 * Fills every GistPayload field from the raw incoming value (or its
 * validated default) — never `undefined`. This is what makes "silently
 * delete a field on write" structurally hard to do by accident: a caller
 * that forgets a field still gets a fully-populated, schema-valid payload
 * back, not a payload with a hole in it.
 */
export function normalizeGistPayload(raw: RawGistPayload): GistPayload {
  const goalLbs = raw.goalLbs;
  const heightIn = raw.heightIn;
  const maintenanceDriftLbs = raw.maintenanceDriftLbs;

  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
    meta: (raw.meta as GistPayload['meta']) ?? { metric: 'Weight', source: '' },
    entries: normalizeEntries(raw.entries),
    injections: normalizeInjections(raw.injections),
    injSchedule: isValidInjSchedule(raw.injSchedule) ? raw.injSchedule : [],
    calories: normalizeCalories(raw.calories),
    intervalsActivities: normalizeIntervalsActivities(raw.intervalsActivities),
    calorieTargets: normalizeDatedTargets(raw.calorieTargets, DEFAULT_CALORIE_TARGETS),
    proteinTargets: normalizeDatedTargets(raw.proteinTargets, DEFAULT_PROTEIN_TARGETS),
    bloodPressure: normalizeBloodPressure(raw.bloodPressure),
    weightAnnotations: normalizeWeightAnnotations(raw.weightAnnotations),
    goalLbs: typeof goalLbs === 'number' && goalLbs > 0 ? goalLbs : GOAL_LBS_DEFAULT,
    heightIn: typeof heightIn === 'number' && heightIn > 0 ? heightIn : HEIGHT_IN_DEFAULT,
    maintenanceDriftLbs:
      typeof maintenanceDriftLbs === 'number' && maintenanceDriftLbs > 0
        ? maintenanceDriftLbs
        : MAINTENANCE_DRIFT_LBS_DEFAULT,
    maintenanceHistory: normalizeMaintenanceHistory(raw.maintenanceHistory),
    bmrProfile: normalizeBmrProfile(raw.bmrProfile),
  };
}

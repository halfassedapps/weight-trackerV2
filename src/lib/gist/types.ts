// The Gist data contract — kept 1:1 with V1's `parseGistPayload`/`patchGist`
// (halfassedapps/Weight-Tracker, index.html:669-807). V2 reads and writes the
// exact same Gist (`GIST_ID` in client.ts), so this file is the single source
// of truth both apps must agree on. Do not add a field here without also
// confirming V1 and the Python watcher (watcher/weight_export_watcher.py)
// either write it or explicitly pass it through unchanged — every write is a
// full-file PATCH, so an unlisted field is a deleted field.

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  wKg: number;
}

export interface Injection {
  date: string;
  doseMg: number;
  site?: string;
  nausea?: number;
  hunger?: number;
  foodNoise?: number;
}

export type Ampm = 'am' | 'pm';

/** One weekday slot in a weekday-based injection schedule. */
export interface WeekdayScheduleEntry {
  day: number; // 0 (Sun) - 6 (Sat)
  ampm: Ampm;
}

/** A fixed weekday schedule — e.g. "every Sunday and Thursday". */
export type WeekdaySchedule = WeekdayScheduleEntry[];

/** An every-N-days schedule instead of fixed weekdays. */
export interface IntervalSchedule {
  mode: 'interval';
  everyNDays: number;
  ampm: Ampm;
}

export type InjSchedule = WeekdaySchedule | IntervalSchedule;

export interface CalorieRow {
  date: string;
  Calories?: number;
  ActiveEnergy?: number;
  BasalEnergy?: number;
  Protein?: number;
  Carbs?: number;
  Fat?: number;
  HasWorkout?: boolean;
}

export interface DatedTarget {
  date: string;
  target: number;
}

export interface BpReading {
  date: string;
  ms: number;
  systolic: number;
  diastolic: number;
}

export interface WeightAnnotation {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
}

export type MaintenanceAction = 'start' | 'stop';

export interface MaintenanceHistoryEntry {
  date: string;
  action: MaintenanceAction;
  doseMg: number;
}

export type BmrActivityLevelId = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

export interface BmrProfile {
  age: number;
  sex: 'male' | 'female';
  activityLevel: BmrActivityLevelId;
}

export interface RideActivity {
  id: number | string;
  name: string;
  sport: string;
  durSecs: number;
  distM: number;
  cal: number;
  pwr?: number | null;
  hr?: number | null;
}

export interface RideDay {
  date: string;
  totalDurSecs: number;
  totalDistM: number;
  totalCal: number;
  rides: RideActivity[];
}

/**
 * Watcher-only — written exclusively by watcher/weight_export_watcher.py
 * (the intervals.icu API key never touches the Gist or this app). V2 must
 * pass the current value through unmodified on every write and never
 * compute it itself.
 */
export interface IntervalsActivities {
  calMap: Record<string, number>;
  ridesMap: Record<string, RideDay>;
  syncedAt: string;
}

export interface GistMeta {
  metric: string;
  source: string;
}

/** The full `weight-data.json` contract. Every field must round-trip on write. */
export interface GistPayload {
  version: number;
  savedAt: string;
  meta: GistMeta;
  entries: WeightEntry[];
  injections: Injection[];
  injSchedule: InjSchedule;
  calories: CalorieRow[];
  intervalsActivities: IntervalsActivities | null;
  calorieTargets: DatedTarget[];
  proteinTargets: DatedTarget[];
  bloodPressure: BpReading[];
  weightAnnotations: WeightAnnotation[];
  goalLbs: number;
  heightIn: number;
  maintenanceDriftLbs: number;
  maintenanceHistory: MaintenanceHistoryEntry[];
  bmrProfile: BmrProfile | null;
}

/** Partial/untyped JSON as it comes off the wire, before `normalizeGistPayload`. */
export type RawGistPayload = Partial<Record<keyof GistPayload, unknown>>;

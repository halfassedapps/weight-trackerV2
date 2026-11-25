// Defaults ported verbatim from V1 (index.html) — keep these in sync with
// GOAL_LBS_DEFAULT / HEIGHT_IN_DEFAULT / MAINTENANCE_DRIFT_LBS_DEFAULT and
// the DEFAULT_CALORIE_TARGETS / DEFAULT_PROTEIN_TARGETS arrays there.
import type { BmrActivityLevelId, DatedTarget } from './types';

export const GOAL_LBS_DEFAULT = 155;
export const HEIGHT_IN_DEFAULT = 67;
export const MAINTENANCE_DRIFT_LBS_DEFAULT = 2;

export const DEFAULT_CALORIE_TARGETS: DatedTarget[] = [
  { date: '2026-05-02', target: 1709 },
  { date: '2026-07-30', target: 1500 },
];

export const DEFAULT_PROTEIN_TARGETS: DatedTarget[] = [
  { date: '2026-05-02', target: 171 },
];

export interface BmrActivityLevel {
  id: BmrActivityLevelId;
  label: string;
  mult: number;
}

export const BMR_ACTIVITY_LEVELS: BmrActivityLevel[] = [
  { id: 'sedentary', label: 'Sedentary — little/no exercise', mult: 1.2 },
  { id: 'light', label: 'Light — exercise 1-3 days/wk', mult: 1.375 },
  { id: 'moderate', label: 'Moderate — exercise 3-5 days/wk', mult: 1.55 },
  { id: 'active', label: 'Active — exercise 6-7 days/wk', mult: 1.725 },
  { id: 'veryActive', label: 'Very active — hard exercise, physical job', mult: 1.9 },
];

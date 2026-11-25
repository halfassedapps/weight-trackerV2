// Ported verbatim from V1 (index.html:1216-1217).
import type { InjSchedule, IntervalSchedule, WeekdaySchedule } from './types';

export function isIntervalSchedule(s: unknown): s is IntervalSchedule {
  return !!s && typeof s === 'object' && (s as IntervalSchedule).mode === 'interval';
}

export function isWeekdaySchedule(s: unknown): s is WeekdaySchedule {
  return Array.isArray(s) && s.length > 0;
}

export function isValidInjSchedule(s: unknown): s is InjSchedule {
  return Array.isArray(s) || isIntervalSchedule(s);
}

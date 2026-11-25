import { useState } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs, type MsRange } from '../lib/domain/ranges';

/**
 * Replaces V1's 6-8x independently-duplicated rangeMode/customDays/
 * customStartDate/customEndDate state + localStorage-persistence blocks
 * (one per chart). Every chart gets the same shape; only the storage key
 * prefix differs.
 */
export function useRangePicker(storageKeyPrefix: string, defaultDays = 0) {
  const storageKey = (suffix: string) => `weight-tracker-v2:${storageKeyPrefix}:${suffix}`;

  const [days, setDaysState] = useState<number>(() => {
    const raw = localStorage.getItem(storageKey('days'));
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : defaultDays;
  });
  const [customStart, setCustomStartState] = useState<string>(
    () => localStorage.getItem(storageKey('customStart')) ?? '',
  );
  const [customEnd, setCustomEndState] = useState<string>(
    () => localStorage.getItem(storageKey('customEnd')) ?? '',
  );

  const setDays = (n: number) => {
    setDaysState(n);
    try {
      localStorage.setItem(storageKey('days'), String(n));
    } catch {
      /* localStorage can throw in private-browsing contexts — a persistence
       * miss here just means the preference resets next visit, not a bug. */
    }
  };
  const setCustomStart = (v: string) => {
    setCustomStartState(v);
    try {
      localStorage.setItem(storageKey('customStart'), v);
    } catch {
      /* see setDays */
    }
  };
  const setCustomEnd = (v: string) => {
    setCustomEndState(v);
    try {
      localStorage.setItem(storageKey('customEnd'), v);
    } catch {
      /* see setDays */
    }
  };

  const customRange: MsRange | null = days === CUSTOM_RANGE_DAYS ? customDateRangeMs(customStart, customEnd) : null;

  return { days, setDays, customStart, setCustomStart, customEnd, setCustomEnd, customRange };
}

export type UseRangePickerResult = ReturnType<typeof useRangePicker>;

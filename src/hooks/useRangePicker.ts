import { useState } from 'react';
import { CUSTOM_RANGE_DAYS, customDateRangeMs, type MsRange } from '../lib/domain/ranges';
import { safeSetItem } from '../lib/storage';

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
    safeSetItem(storageKey('days'), String(n));
  };
  const setCustomStart = (v: string) => {
    setCustomStartState(v);
    safeSetItem(storageKey('customStart'), v);
  };
  const setCustomEnd = (v: string) => {
    setCustomEndState(v);
    safeSetItem(storageKey('customEnd'), v);
  };

  const customRange: MsRange | null = days === CUSTOM_RANGE_DAYS ? customDateRangeMs(customStart, customEnd) : null;

  return { days, setDays, customStart, setCustomStart, customEnd, setCustomEnd, customRange };
}

export type UseRangePickerResult = ReturnType<typeof useRangePicker>;

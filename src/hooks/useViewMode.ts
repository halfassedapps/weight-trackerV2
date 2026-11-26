import { useState } from 'react';
import type { GraphTableMode } from '../components/charts/shared/GraphTableToggle';
import { safeSetItem } from '../lib/storage';

/** Persisted 'graph' | 'table' toggle state, shared by every chart that has one. */
export function useViewMode(storageKeyPrefix: string, defaultMode: GraphTableMode = 'graph') {
  const storageKey = `weight-tracker-v2:${storageKeyPrefix}:viewMode`;
  const [mode, setModeState] = useState<GraphTableMode>(() => {
    const raw = localStorage.getItem(storageKey);
    return raw === 'graph' || raw === 'table' ? raw : defaultMode;
  });
  const setMode = (next: GraphTableMode) => {
    setModeState(next);
    safeSetItem(storageKey, next);
  };
  return { mode, setMode };
}

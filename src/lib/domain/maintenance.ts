// Ported from V1 (index.html:4631-4682).
import type { MaintenanceAction, MaintenanceHistoryEntry } from '../gist/types';

export interface MaintenancePeriod {
  startMs: number;
  startDoseMg: number;
  endMs: number;
  /** null for an ongoing period — the caller substitutes the live current dose. */
  endDoseMg: number | null;
  ongoing: boolean;
}

export interface MaintenanceState {
  maintenanceMode: boolean;
  maintenanceSince: string | null;
  maintenanceEntryDoseMg: number | null;
  maintenancePeriods: MaintenancePeriod[];
}

export function deriveMaintenanceState(maintenanceHistory: MaintenanceHistoryEntry[] | undefined, todayMs: number): MaintenanceState {
  const sorted = [...(maintenanceHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.length ? sorted[sorted.length - 1] : null;
  const maintenanceMode = !!last && last.action === 'start';

  const periods: MaintenancePeriod[] = [];
  let openStart: { startMs: number; startDoseMg: number } | null = null;
  for (const h of sorted) {
    const ms = new Date(`${h.date}T12:00:00`).getTime();
    if (h.action === 'start') {
      openStart = { startMs: ms, startDoseMg: h.doseMg };
    } else if (h.action === 'stop' && openStart) {
      periods.push({ ...openStart, endMs: ms, endDoseMg: h.doseMg, ongoing: false });
      openStart = null;
    }
  }
  if (openStart) periods.push({ ...openStart, endMs: todayMs, endDoseMg: null, ongoing: true });

  return {
    maintenanceMode,
    maintenanceSince: maintenanceMode ? last!.date : null,
    maintenanceEntryDoseMg: maintenanceMode ? last!.doseMg : null,
    maintenancePeriods: periods,
  };
}

export interface MaintenanceMarker {
  ms: number;
  action: MaintenanceAction;
}

/** One marker per unique date (last action wins if a date has more than
 * one — e.g. from testing/manual edits), with its action, for a chart's
 * own hover tooltip to say which: "Maintenance started" vs "ended". */
export function visibleMaintMarkers(
  maintenanceHistory: MaintenanceHistoryEntry[] | undefined,
  rangeStartMs: number,
  rangeEndMs: number,
): MaintenanceMarker[] {
  const byDate = new Map<string, MaintenanceAction>();
  (maintenanceHistory || []).forEach((h) => byDate.set(h.date, h.action));
  return [...byDate.entries()]
    .map(([date, action]) => ({ ms: new Date(`${date}T12:00:00`).getTime(), action }))
    .filter((m) => m.ms >= rangeStartMs && m.ms <= rangeEndMs)
    .sort((a, b) => a.ms - b.ms);
}

export function maintToggleLabel(action: MaintenanceAction | null | undefined): string | null {
  if (action === 'start') return 'Maintenance started';
  if (action === 'stop') return 'Maintenance ended → Weight loss mode';
  return null;
}

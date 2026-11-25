import { describe, expect, it } from 'vitest';
import {
  deriveMaintenanceState,
  maintToggleLabel,
  visibleMaintMarkers,
} from '../../../../src/lib/domain/maintenance';

describe('deriveMaintenanceState', () => {
  it('reports not-in-maintenance with no history', () => {
    const state = deriveMaintenanceState([], Date.now());
    expect(state.maintenanceMode).toBe(false);
    expect(state.maintenancePeriods).toEqual([]);
  });

  it('reports an ongoing period when the last action is start', () => {
    const todayMs = new Date('2026-02-01T12:00:00').getTime();
    const state = deriveMaintenanceState([{ date: '2026-01-15', action: 'start', doseMg: 4 }], todayMs);
    expect(state.maintenanceMode).toBe(true);
    expect(state.maintenanceSince).toBe('2026-01-15');
    expect(state.maintenancePeriods).toHaveLength(1);
    expect(state.maintenancePeriods[0].ongoing).toBe(true);
    expect(state.maintenancePeriods[0].endMs).toBe(todayMs);
  });

  it('closes a period on stop and reports not-in-maintenance afterward', () => {
    const state = deriveMaintenanceState(
      [
        { date: '2026-01-01', action: 'start', doseMg: 4 },
        { date: '2026-01-20', action: 'stop', doseMg: 4 },
      ],
      Date.now(),
    );
    expect(state.maintenanceMode).toBe(false);
    expect(state.maintenancePeriods).toHaveLength(1);
    expect(state.maintenancePeriods[0].ongoing).toBe(false);
  });
});

describe('visibleMaintMarkers', () => {
  it('dedupes same-date toggles, keeping the last action', () => {
    const markers = visibleMaintMarkers(
      [
        { date: '2026-01-15', action: 'start', doseMg: 4 },
        { date: '2026-01-15', action: 'stop', doseMg: 4 },
      ],
      0,
      Infinity,
    );
    expect(markers).toHaveLength(1);
    expect(markers[0].action).toBe('stop');
  });

  it('filters markers outside the given range', () => {
    const jan1 = new Date('2026-01-01T12:00:00').getTime();
    const jan31 = new Date('2026-01-31T12:00:00').getTime();
    const markers = visibleMaintMarkers([{ date: '2026-02-15', action: 'start', doseMg: 4 }], jan1, jan31);
    expect(markers).toEqual([]);
  });
});

describe('maintToggleLabel', () => {
  it('describes start and stop, and nulls out otherwise', () => {
    expect(maintToggleLabel('start')).toBe('Maintenance started');
    expect(maintToggleLabel('stop')).toContain('Weight loss mode');
    expect(maintToggleLabel(null)).toBeNull();
  });
});

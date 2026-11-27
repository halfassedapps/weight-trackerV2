// Ported from V1 (index.html:942-1012, 2239-2267).
import type { BpReading } from '../gist/types';
import { avg } from './math';

export const BP_SYS_COLOR = '#e05252';
export const BP_DIA_COLOR = '#4a90d9';

const msToLocalDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// A gap > this many minutes to the previous reading (on the same calendar
// day) starts a new "sitting" — multiple readings close together are one
// blood-pressure-taking session, not independent data points.
const BP_SESSION_GAP_MIN = 15;

export interface BpSitting {
  date: string;
  ms: number;
  systolic: number;
  diastolic: number;
  readingCount: number;
}

/**
 * Groups raw readings into sittings and collapses each sitting to one
 * value: a single reading is used as-is; exactly two uses the lower
 * reading outright (not an average); three or more averages the lowest
 * two (paired, not cross-matched) — this mirrors the standard home-BP-
 * monitoring guidance of discarding a high first reading as "white coat"
 * noise, not a statistical artifact.
 */
type NumericBpReading = BpReading & { systolic: number; diastolic: number };

export function clusterBpReadings(readings: BpReading[]): BpSitting[] {
  // Note-only entries (no systolic/diastolic) never participate in
  // sitting clustering or BP averaging — they're display-only until a
  // real reading is logged against them.
  const bpReadings = readings.filter((r): r is NumericBpReading => r.systolic != null && r.diastolic != null);
  if (!bpReadings.length) return [];
  const gapMs = BP_SESSION_GAP_MIN * 60000;
  const sittings: NumericBpReading[][] = [];
  let cur: NumericBpReading[] = [bpReadings[0]];
  for (let i = 1; i < bpReadings.length; i++) {
    const prev = bpReadings[i - 1];
    const r = bpReadings[i];
    if (r.ms - prev.ms <= gapMs && msToLocalDate(r.ms) === msToLocalDate(prev.ms)) {
      cur.push(r);
    } else {
      sittings.push(cur);
      cur = [r];
    }
  }
  sittings.push(cur);

  return sittings.map((group): BpSitting => {
    const firstMs = group[0].ms;
    const date = msToLocalDate(firstMs);
    let systolic: number;
    let diastolic: number;
    if (group.length === 1) {
      systolic = group[0].systolic;
      diastolic = group[0].diastolic;
    } else if (group.length === 2) {
      const lower = group[0].systolic <= group[1].systolic ? group[0] : group[1];
      systolic = lower.systolic;
      diastolic = lower.diastolic;
    } else {
      const lowest2 = [...group].sort((a, b) => a.systolic - b.systolic).slice(0, 2);
      systolic = avg(lowest2.map((r) => r.systolic));
      diastolic = avg(lowest2.map((r) => r.diastolic));
    }
    return {
      date,
      ms: firstMs,
      systolic: Math.round(systolic * 10) / 10,
      diastolic: Math.round(diastolic * 10) / 10,
      readingCount: group.length,
    };
  });
}

export interface DailyBp {
  date: string;
  ms: number;
  /** null for a day with only a note entry — nothing was actually measured. */
  systolic: number | null;
  diastolic: number | null;
  sittingCount: number;
  /** every raw reading for the day, sorted — for a hover table showing exactly what went into it */
  readings: BpReading[];
  /** every non-empty note logged against the day, joined — shown in the
   * chart's hover tooltip and the table, independent of whether the day
   * also has a real BP measurement. */
  note: string | null;
}

/**
 * One point per calendar day that has EITHER a real BP measurement or a
 * note (or both): clusters raw readings into sittings, then averages
 * sitting-level results together when a day holds more than one (e.g.
 * separate AM and PM readings) — so a day with any measurement always
 * renders as exactly one chart point, however many times BP was actually
 * taken that day. A day with only a note and no measurement still gets a
 * point (systolic/diastolic null) so the note has somewhere to attach on
 * the chart.
 */
export function computeDailyBp(readings: BpReading[]): DailyBp[] {
  const sittings = clusterBpReadings(readings);
  const byDate = new Map<string, BpSitting[]>();
  for (const s of sittings) {
    const arr = byDate.get(s.date) ?? [];
    arr.push(s);
    byDate.set(s.date, arr);
  }
  const rawByDate = new Map<string, BpReading[]>();
  for (const r of readings) {
    const key = msToLocalDate(r.ms);
    const arr = rawByDate.get(key) ?? [];
    arr.push(r);
    rawByDate.set(key, arr);
  }

  const allDates = new Set([...byDate.keys(), ...rawByDate.keys()]);

  return [...allDates]
    .map((date): DailyBp => {
      const sits = byDate.get(date);
      const raw = [...(rawByDate.get(date) ?? [])].sort((a, b) => a.ms - b.ms);
      const notes = raw.map((r) => r.note?.trim()).filter((n): n is string => !!n);
      return {
        date,
        ms: sits ? sits[0].ms : raw[0].ms,
        systolic: sits ? Math.round(avg(sits.map((s) => s.systolic)) * 10) / 10 : null,
        diastolic: sits ? Math.round(avg(sits.map((s) => s.diastolic)) * 10) / 10 : null,
        sittingCount: sits ? sits.length : 0,
        readings: raw,
        note: notes.length ? notes.join(' · ') : null,
      };
    })
    .sort((a, b) => a.ms - b.ms);
}

export interface BpBand {
  max: number;
  color: string;
  label: string;
}

/** Soft background bands for the standard AHA systolic categories — context
 * only, not a medical judgment. Diastolic isn't separately banded (its
 * thresholds differ from systolic's) to avoid a cluttered dual-threshold
 * overlay sharing one y-axis. */
export const BP_BANDS: BpBand[] = [
  { max: 120, color: '#34c759', label: 'Normal' },
  { max: 130, color: '#ffd60a', label: 'Elevated' },
  { max: 140, color: '#ff9500', label: 'Stage 1' },
  { max: 180, color: '#ff3b30', label: 'Stage 2' },
  { max: Infinity, color: '#7f1d1d', label: 'Crisis' },
];

export interface BpCategoryResult {
  key: 'crisis' | 'stage2' | 'stage1' | 'elevated' | 'normal';
  label: string;
  color: string;
}

/** Per-reading category (unlike BP_BANDS, which is systolic-only for the
 * graph's single shared y-axis) — the real AHA both-values rule: whichever
 * of systolic/diastolic falls into the more severe category wins, and
 * Elevated specifically requires diastolic still under 80. */
export function bpCategory(sys: number, dia: number): BpCategoryResult {
  if (sys >= 180 || dia >= 120) return { key: 'crisis', label: 'Hypertensive Crisis', color: '#7f1d1d' };
  if (sys >= 140 || dia >= 90) return { key: 'stage2', label: 'Stage 2', color: '#ff3b30' };
  if (sys >= 130 || dia >= 80) return { key: 'stage1', label: 'Stage 1', color: '#ff9500' };
  if (sys >= 120 && dia < 80) return { key: 'elevated', label: 'Elevated', color: '#ffd60a' };
  return { key: 'normal', label: 'Normal', color: '#34c759' };
}

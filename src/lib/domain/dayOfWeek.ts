// Ported from V1's DailyWeightChart (index.html:7243-7355), split into pure
// data (this file) vs. rendering (the component) per the project plan.
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WD_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export interface DeltaEntry {
  date: string;
  delta: number;
}

export interface DayOfWeekBar {
  dow: number;
  wd: string;
  avg: number | null;
  count: number;
}

export interface WeightLikeRow {
  date: string;
  lbs: number;
}

/** 7 buckets (0=Sun…6=Sat), each the list of day-over-day deltas (today's lbs
 * minus yesterday's) for logged dates that fell on that weekday. `rows` must
 * be newest-first and only counts genuinely consecutive calendar days —
 * a logging gap just drops that pair rather than comparing across it. */
export function computeDayOfWeekDeltas(rows: WeightLikeRow[]): DeltaEntry[][] {
  const dayDeltas: DeltaEntry[][] = [[], [], [], [], [], [], []];
  for (let i = 0; i < rows.length - 1; i++) {
    const todayMs = new Date(`${rows[i].date}T12:00:00`).getTime();
    const yestMs = new Date(`${rows[i + 1].date}T12:00:00`).getTime();
    if (todayMs - yestMs !== 86400000) continue;
    const dow = new Date(`${rows[i].date}T12:00:00`).getDay();
    const delta = rows[i].lbs - rows[i + 1].lbs; // negative = lost weight
    dayDeltas[dow].push({ date: rows[i].date, delta });
  }
  return dayDeltas;
}

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

/** Mon→Sun bars with each weekday's average delta (null if never logged on
 * that weekday with a consecutive-day predecessor) and sample count. */
export function buildDayOfWeekBars(dayDeltas: DeltaEntry[][]): DayOfWeekBar[] {
  return DISPLAY_ORDER.map((dow) => {
    const entries = dayDeltas[dow];
    return {
      dow,
      wd: WD[dow],
      avg: entries.length ? entries.reduce((s, v) => s + v.delta, 0) / entries.length : null,
      count: entries.length,
    };
  });
}

// Ported from V1 (index.html:807-1035, 1170-1188). Parses an Apple Health
// CSV export (via HealthFit or similar) into weight/calorie/blood-pressure
// rows. One structural difference from V1: V1 merges each import into a
// localStorage mirror keyed by date/ms (mergeWithStored/
// mergeCaloriesWithStored/mergeBpWithStored), since it kept its own local
// copy of everything. V2 has no such mirror (see the project plan) — the
// merge target here is instead whatever the live Gist currently holds, via
// mergeEntriesByDate/mergeCaloriesByDate/mergeBpByMs, called from the import
// hook's writeGist `mutate`.
import type { BpReading, CalorieRow, WeightEntry } from '../gist/types';

export function msToLocalDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** One CSV line → fields, respecting double-quoted values that may contain commas. */
export function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === ',' && !q) {
      out.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim().replace(/^"|"$/g, ''));
  return out;
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (vals[i] ?? '').trim();
    });
    return row;
  });
}

export interface CsvSchema {
  format: 'long' | 'wide' | 'unknown';
  dateCol?: string;
  metricCol?: string;
  valueCol?: string;
  unitCol?: string;
  weightMetric?: string;
  allMetrics?: string[];
}

export function detectSchema(headers: string[], rows: Record<string, string>[]): CsvSchema {
  const lc = (h: string) => h.toLowerCase().replace(/[\s_-]/g, '');
  const find = (...keys: string[]) => headers.find((h) => keys.some((k) => lc(h) === k || lc(h).includes(k)));
  const dateCol = find('date', 'startdate', 'datetime', 'timestamp');
  const metricCol = find('metric', 'metricname', 'type', 'category', 'name');
  const valueCol = find('value', 'qty');
  const unitCol = find('unit', 'units');
  if (metricCol && valueCol && dateCol) {
    const metricValues = [...new Set(rows.map((r) => r[metricCol]).filter(Boolean))];
    const weightMetric =
      metricValues.find((m) => ['bodyweight', 'body weight', 'weight', 'bodymass', 'body mass'].includes(m.toLowerCase().replace(/\s+/g, ' ').trim())) ??
      metricValues.find((m) => m.toLowerCase().includes('weight'));
    return { format: 'long', dateCol, metricCol, valueCol, unitCol, weightMetric, allMetrics: metricValues };
  }
  const wideValue = find('weight', 'bodymass', 'body mass', 'mass', 'value');
  if (dateCol && wideValue) return { format: 'wide', dateCol, valueCol: wideValue, unitCol };
  return { format: 'unknown', dateCol, valueCol, unitCol };
}

// Blood Pressure metric name matching — unlike weight/calories there are two
// paired metrics (systolic + diastolic) sharing one timestamp per reading.
const BP_SYSTOLIC_RE = /blood pressure.*systolic|systolic.*blood pressure/i;
const BP_DIASTOLIC_RE = /blood pressure.*diastolic|diastolic.*blood pressure/i;

export function findBpMetrics(allMetrics: string[] | undefined): { systolic?: string; diastolic?: string } {
  const systolic = (allMetrics || []).find((m) => BP_SYSTOLIC_RE.test(m));
  const diastolic = (allMetrics || []).find((m) => BP_DIASTOLIC_RE.test(m));
  return { systolic, diastolic };
}

export function toKg(weight: number, unit: string | undefined): number {
  const u = (unit ?? '').toLowerCase().trim();
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return weight / 2.20462;
  return weight;
}

export function buildCalorieMap(rows: Record<string, string>[], schema: CsvSchema): CalorieRow[] {
  const map: Record<string, CalorieRow> = {};
  const calorieMetrics: Record<string, number> = {};
  for (const row of rows) {
    const rawDate = row[schema.dateCol!];
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) continue;
    const metric = row[schema.metricCol!];
    if (!metric) continue;
    const key = msToLocalDate(d.getTime());
    if (!map[key]) map[key] = { date: key, Calories: 0, ActiveEnergy: 0, BasalEnergy: 0, Protein: 0, Carbs: 0, Fat: 0, HasWorkout: false };
    if (metric.toLowerCase() === 'workout') {
      map[key].HasWorkout = true;
      continue;
    }
    const rawVal = (row[schema.valueCol!] ?? '').replace(/,/g, '');
    const val = parseFloat(rawVal);
    if (isNaN(val)) continue;
    const lower = metric.toLowerCase();
    if (lower.includes('calor')) calorieMetrics[key] = (calorieMetrics[key] ?? 0) + val;
    else if (lower.includes('active energy')) map[key].ActiveEnergy = (map[key].ActiveEnergy ?? 0) + val;
    else if (lower.includes('basal energy')) map[key].BasalEnergy = (map[key].BasalEnergy ?? 0) + val;
    else if (lower.includes('protein')) map[key].Protein = (map[key].Protein ?? 0) + val;
    else if (lower.includes('carbohydrate')) map[key].Carbs = (map[key].Carbs ?? 0) + val;
    else if (lower.includes('total fat')) map[key].Fat = (map[key].Fat ?? 0) + val;
  }
  Object.entries(calorieMetrics).forEach(([key, total]) => {
    if (map[key]) map[key].Calories = total;
  });
  return Object.values(map)
    .filter((d) => (d.Calories ?? 0) > 0 || (d.ActiveEnergy ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface RawBpReading {
  ms: number;
  systolic: number;
  diastolic: number;
}

/** Pairs Systolic/Diastolic rows sharing the same exact timestamp into single readings. */
export function buildBpReadings(rows: Record<string, string>[], schema: CsvSchema): RawBpReading[] {
  if (schema.format !== 'long') return [];
  const { systolic, diastolic } = findBpMetrics(schema.allMetrics);
  if (!systolic || !diastolic) return [];
  const byTs: Record<string, Partial<RawBpReading> & { ms: number }> = {};
  for (const row of rows) {
    const metric = row[schema.metricCol!];
    if (metric !== systolic && metric !== diastolic) continue;
    const rawDate = row[schema.dateCol!];
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) continue;
    const val = parseFloat((row[schema.valueCol!] ?? '').replace(/,/g, ''));
    if (isNaN(val)) continue;
    const key = String(d.getTime());
    if (!byTs[key]) byTs[key] = { ms: d.getTime() };
    if (metric === systolic) byTs[key].systolic = val;
    else byTs[key].diastolic = val;
  }
  return Object.values(byTs)
    .filter((r): r is RawBpReading => r.systolic != null && r.diastolic != null)
    .sort((a, b) => a.ms - b.ms);
}

/** Raw readings shaped for Gist storage — one row per real-world cuff reading, no reduction. */
export function buildBpMap(rows: Record<string, string>[], schema: CsvSchema): BpReading[] {
  return buildBpReadings(rows, schema).map((r) => ({ date: msToLocalDate(r.ms), ...r }));
}

export function buildDailyMap(rows: Record<string, string>[], schema: CsvSchema): WeightEntry[] {
  const map: Record<string, { date: string; wKg: number; ts: Date }> = {};
  for (const row of rows) {
    if (schema.format === 'long' && row[schema.metricCol!] !== schema.weightMetric) continue;
    const rawDate = row[schema.dateCol!];
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) continue;
    const rawVal = (row[schema.valueCol!] ?? '').replace(/,/g, '');
    const wRaw = parseFloat(rawVal);
    if (isNaN(wRaw)) continue;
    const unit = schema.unitCol ? row[schema.unitCol] : '';
    const wKg = toKg(wRaw, unit);
    const key = msToLocalDate(d.getTime());
    if (!map[key] || d > map[key].ts) map[key] = { date: key, wKg, ts: d };
  }
  return Object.values(map)
    .map(({ date, wKg }) => ({ date, wKg }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface ProcessedCsv {
  weightEntries: WeightEntry[];
  meta: { metric: string; source: string };
  calorieData: CalorieRow[];
  bpData: BpReading[];
}

/**
 * Parses and validates a CSV export, producing the new rows it contains.
 * Does NOT merge into existing data (V1's processCSVText did, via
 * mergeWithStored — see this file's header comment for why V2 doesn't);
 * callers merge these against the live Gist payload via mergeEntriesByDate/
 * mergeCaloriesByDate/mergeBpByMs below.
 */
export function processCSVText(text: string): ProcessedCsv {
  const parsed = parseCSV(text);
  if (!parsed.length) throw new Error('CSV is empty.');
  const schema = detectSchema(Object.keys(parsed[0]), parsed);
  if (schema.format === 'unknown') throw new Error(`Couldn't identify schema. Headers: ${Object.keys(parsed[0]).join(', ')}`);
  if (schema.format === 'long' && !schema.weightMetric) {
    const sample = (schema.allMetrics ?? []).slice(0, 8).join(', ');
    throw new Error(`No weight metric found. Metrics present: ${sample}`);
  }
  const weightEntries = buildDailyMap(parsed, schema);
  if (!weightEntries.length) throw new Error('No valid weight entries found.');

  const srcCol = Object.keys(parsed[0]).find((h) => h.toLowerCase() === 'source');
  const wRows = schema.format === 'long' ? parsed.filter((r) => r[schema.metricCol!] === schema.weightMetric) : parsed;
  const source = srcCol ? [...new Set(wRows.map((r) => r[srcCol]).filter(Boolean))].join(', ') : '';
  const meta = { metric: schema.weightMetric ?? 'Weight', source };

  const calorieData = schema.format === 'long' ? buildCalorieMap(parsed, schema) : [];
  const bpData = schema.format === 'long' ? buildBpMap(parsed, schema) : [];

  return { weightEntries, meta, calorieData, bpData };
}

/** Merge new weight entries into the current Gist's entries, keyed by date — new rows win. */
export function mergeEntriesByDate(current: WeightEntry[], incoming: WeightEntry[]): WeightEntry[] {
  const map = new Map(current.map((e) => [e.date, e]));
  for (const e of incoming) map.set(e.date, e);
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Merge new calorie rows into the current Gist's calories, keyed by date — new rows win. */
export function mergeCaloriesByDate(current: CalorieRow[], incoming: CalorieRow[]): CalorieRow[] {
  const map = new Map(current.map((c) => [c.date, c]));
  for (const c of incoming) map.set(c.date, c);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Merge new BP readings into the current Gist's bloodPressure, keyed by exact ms — new rows win. */
export function mergeBpByMs(current: BpReading[], incoming: BpReading[]): BpReading[] {
  const map = new Map(current.map((r) => [r.ms, r]));
  for (const r of incoming) map.set(r.ms, r);
  return [...map.values()].sort((a, b) => a.ms - b.ms);
}

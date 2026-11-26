// Ported from V1 (index.html:8157-8163, 8318-8322) — the reference units
// table covering the full titration range at a given vial concentration.
export const DOSE_TABLE_MIN_MG = 1;
export const DOSE_TABLE_MAX_MG = 15;
export const DOSE_TABLE_STEP_MG = 0.25;

export interface DoseTableRow {
  mg: number;
  units: number;
  ml: string;
}

/** Quarter-mg steps as an integer loop (0.25 is an exact power-of-two
 * fraction, so q*0.25 never drifts the way a float += loop would). */
export function buildDoseTable(concMgMl: number): DoseTableRow[] {
  const steps = Math.round((DOSE_TABLE_MAX_MG - DOSE_TABLE_MIN_MG) / DOSE_TABLE_STEP_MG);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const mg = DOSE_TABLE_MIN_MG + i * DOSE_TABLE_STEP_MG;
    return { mg, units: Math.round(((mg / concMgMl) * 100 * 10)) / 10, ml: (mg / concMgMl).toFixed(2) };
  });
}

// Ported from V1 (index.html:1529-1536) — a small shared SVG path helper
// used by all three nutrition charts' bars.

export interface BmiRange {
  label: string;
  range: string;
  min: number;
  max: number;
  color: string;
}

// Ported from V1 (index.html:4411-4420).
export const BMI_RANGES: BmiRange[] = [
  { label: 'Underweight', range: 'Below 18.5', min: 0, max: 18.5, color: '#5ac8fa' },
  { label: 'Normal', range: '18.5 – 24.9', min: 18.5, max: 25, color: '#34c759' },
  { label: 'Overweight', range: '25.0 – 29.9', min: 25, max: 30, color: '#ffd60a' },
  { label: 'Obese', range: '30.0 – 39.9', min: 30, max: 40, color: '#ff9500' },
  { label: 'Morbidly Obese', range: '40.0+', min: 40, max: Infinity, color: '#ff3b30' },
];

export function bmiCategory(bmi: number): BmiRange {
  return BMI_RANGES.find((r) => bmi < r.max) ?? BMI_RANGES[BMI_RANGES.length - 1];
}

/** Inverse of the BMI formula (bmi = 703 * lbs / height^2) — shows each
 * category's weight-range equivalent at the user's own height. */
export function lbsAtBmi(bmi: number, heightIn: number): number {
  return (bmi * heightIn * heightIn) / 703;
}

/** A bar path from `yBaseline` to `yEnd`, rounded on whichever end is away from the baseline. */
export function roundedBarPath(x: number, w: number, yBaseline: number, yEnd: number, r: number): string {
  const up = yEnd < yBaseline;
  const rr = Math.max(0, Math.min(r, w / 2, Math.abs(yBaseline - yEnd)));
  if (rr === 0) return `M${x},${yBaseline} H${x + w} V${yEnd} H${x} Z`;
  return up
    ? `M${x},${yBaseline} V${yEnd + rr} Q${x},${yEnd} ${x + rr},${yEnd} H${x + w - rr} Q${x + w},${yEnd} ${x + w},${yEnd + rr} V${yBaseline} Z`
    : `M${x},${yBaseline} V${yEnd - rr} Q${x},${yEnd} ${x + rr},${yEnd} H${x + w - rr} Q${x + w},${yEnd} ${x + w},${yEnd - rr} V${yBaseline} Z`;
}

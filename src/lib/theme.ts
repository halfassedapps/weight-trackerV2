// Shared color values charts need in raw JS (SVG `stroke`/`fill`, which
// Tailwind utility classes can't reach). V1 had this exact palette
// copy-pasted in WeightChart, DoseWeightLossChart, and DoseChart
// independently — one canonical source here instead.
export const DOSE_PALETTE = [
  '#4a90d9',
  '#34c759',
  '#ff9500',
  '#ff3b30',
  '#b06dff',
  '#00c7be',
  '#ff2d55',
  '#5856d6',
  '#ffcc00',
  '#8e8e93',
] as const;

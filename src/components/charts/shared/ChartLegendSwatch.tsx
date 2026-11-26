// Was independently redefined as "Legend" (line charts: WeightChart, BpChart,
// DoseChart, PkChart) and "Swatch" (bar charts: TdeeChart,
// CaloriesVsTargetChart, ProteinChart) — same component under two names,
// differing only in stroke thickness. Unified here via the `thick` prop
// (bar charts want a filled-looking swatch; line charts want a thin line).
export interface ChartLegendSwatchProps {
  /** Raw CSS color (hex, etc.) — SVG `stroke` can't reach Tailwind classes. */
  color: string;
  label: string;
  dashed?: boolean;
  /** Bar-chart legends want a thick, filled-looking swatch instead of a thin line. */
  thick?: boolean;
}

export function ChartLegendSwatch({ color, label, dashed, thick }: ChartLegendSwatchProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={12} height={8}>
        <line x1={0} y1={4} x2={12} y2={4} stroke={color} strokeWidth={dashed && thick ? 1.3 : thick ? 6 : 1.5} strokeDasharray={dashed ? '2,2' : undefined} />
      </svg>
      {label}
    </span>
  );
}

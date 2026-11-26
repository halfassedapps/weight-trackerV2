// Was independently redefined in WeightChart, BpChart, PkChart, TdeeChart,
// CaloriesVsTargetChart, and ProteinChart (six copies, two silently
// different APIs: some took `color` as a Tailwind class applied via
// className, others as a raw hex applied via inline style). Standardized
// here on the inline-style/raw-color convention: several callers compute
// `color` at runtime (e.g. `tier != null ? NET_TIER_COLOR[tier] : '#3c3c43'`),
// and a dynamically-interpolated Tailwind arbitrary-value class
// (`text-[${color}]`) is invisible to Tailwind's static class scanner —
// it would silently never generate the CSS. Inline style has no such
// landmine and already covered every dynamic-color caller correctly.
export interface StatProps {
  label: string;
  value: string;
  note?: string;
  /** Raw CSS color (hex, etc). */
  color?: string;
}

export function Stat({ label, value, note, color = '#0f172a' }: StatProps) {
  return (
    <div>
      <div className="text-[clamp(9px,0.9vw,12px)] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-semibold tabular-nums text-[clamp(0.875rem,1.7vw,1.5rem)]" style={{ color }}>
        {value}
      </div>
      {note && <div className="text-[clamp(9px,0.9vw,12px)] text-slate-400">{note}</div>}
    </div>
  );
}

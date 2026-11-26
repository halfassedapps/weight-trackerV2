// The `<select>` half of useRangePicker — was byte-for-byte identical in
// WeightChart, BpChart, DoseChart, PkChart, and NutritionPage (five copies).
import { DATA_RANGE_OPTIONS } from '../../../lib/domain/ranges';

export interface RangePickerSelectProps {
  days: number;
  onChange: (days: number) => void;
}

export function RangePickerSelect({ days, onChange }: RangePickerSelectProps) {
  return (
    <select
      value={days}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
    >
      {DATA_RANGE_OPTIONS.map((o) => (
        <option key={o.days} value={o.days}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// The `<select>` half of useRangePicker — was byte-for-byte identical in
// WeightChart, BpChart, DoseChart, PkChart, RidesChart, and NutritionPage
// (six copies). Also renders the start/end date inputs when "Date range…"
// is selected — useRangePicker already tracked customStart/customEnd and
// every series hook already consumed them, but no caller ever rendered a
// way to actually set them.
import { CUSTOM_RANGE_DAYS, DATA_RANGE_OPTIONS } from '../../../lib/domain/ranges';
import type { UseRangePickerResult } from '../../../hooks/useRangePicker';

export interface RangePickerSelectProps {
  range: UseRangePickerResult;
}

export function RangePickerSelect({ range }: RangePickerSelectProps) {
  return (
    <>
      <select
        value={range.days}
        onChange={(e) => range.setDays(Number(e.target.value))}
        className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
      >
        {DATA_RANGE_OPTIONS.map((o) => (
          <option key={o.days} value={o.days}>
            {o.label}
          </option>
        ))}
      </select>
      {range.days === CUSTOM_RANGE_DAYS && (
        <div className="basis-full flex items-center gap-1.5 mt-1.5 text-[11px]">
          <input
            type="date"
            value={range.customStart}
            onChange={(e) => range.setCustomStart(e.target.value)}
            max={range.customEnd || undefined}
            className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={range.customEnd}
            onChange={(e) => range.setCustomEnd(e.target.value)}
            min={range.customStart || undefined}
            className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700"
          />
        </div>
      )}
    </>
  );
}

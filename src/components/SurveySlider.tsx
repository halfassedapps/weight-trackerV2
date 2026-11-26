// Shared by AddInjectionCard, InjectionLogCard's edit form, and
// InjectionDayBanner — all three ask for the same nausea/hunger/food-noise
// 0-10 sliders.
interface SurveySliderProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function SurveySlider({ label, value, onChange }: SurveySliderProps) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-xs font-bold text-blue-600 tabular-nums">{value === '' ? '—' : value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value === '' ? 0 : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

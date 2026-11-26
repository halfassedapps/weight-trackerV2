// Ported from V1's "Trend Lines" checkbox-dropdown (index.html:6330-6370ish)
// — multi-select menu for which hypothetical trend lines the chart draws.
import { useEffect, useRef, useState } from 'react';
import { TREND_OPTIONS } from '../../../lib/domain/trendLine';

interface TrendLinesMenuProps {
  checked: string[];
  onChange: (next: string[]) => void;
}

export function TrendLinesMenu({ checked, onChange }: TrendLinesMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const toggle = (id: string) => {
    onChange(checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id]);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700"
      >
        Trend Lines{checked.length ? ` (${checked.length})` : ''} ▾
      </button>
      {open && (
        <div className="absolute top-7 left-0 z-20 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5">
          {TREND_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-slate-700 cursor-pointer">
              <input type="checkbox" checked={checked.includes(opt.id)} onChange={() => toggle(opt.id)} className="accent-blue-600" />
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

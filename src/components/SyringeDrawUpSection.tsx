// Ported from V1's "Syringe draw-up" section inside DosePanel
// (index.html:4346-4392) — vial/syringe config (local preference, never
// written to the Gist) plus the draw-up graphic for whatever dose the
// caller is currently recommending, and the "Calculator" button that opens
// the standalone what-if calculator. Self-contained (not folded into
// DoseRecommendationCard's own state) to avoid touching that component's
// already-intricate dose-guidance logic for what's purely a display
// convenience layered on top of it.
import { useState } from 'react';
import { DoseCalculatorModal } from './DoseCalculatorModal';
import { SyringeGraphic } from './SyringeGraphic';
import { safeSetItem } from '../lib/storage';
import type { Injection } from '../lib/gist/types';

const LS_VIAL_MG_KEY = 'weight-tracker-vial-mg';
const LS_VIAL_VOL_KEY = 'weight-tracker-vial-vol';
const LS_VIAL_CONC_KEY = 'weight-tracker-vial-conc';
const LS_SYRINGE_UNITS_KEY = 'weight-tracker-syringe-units';

interface SyringeDrawUpSectionProps {
  doseMg: number;
  injPerWeek: number;
  color: string;
  /** Ascending by date (ds.sortedInj) — used only to build the modal's
   * last-4-with-survey-data display, not for any guidance math. */
  sortedInjections: Injection[];
}

export function SyringeDrawUpSection({ doseMg, injPerWeek, color, sortedInjections }: SyringeDrawUpSectionProps) {
  const [vialMg, setVialMg] = useState(() => Math.max(parseFloat(localStorage.getItem(LS_VIAL_MG_KEY) ?? localStorage.getItem(LS_VIAL_CONC_KEY) ?? '12.5') || 12.5, 0.1));
  const [vialVol, setVialVol] = useState(() => Math.max(parseFloat(localStorage.getItem(LS_VIAL_VOL_KEY) ?? '1') || 1, 0.01));
  const [syringeUnits, setSyringeUnits] = useState(() => parseInt(localStorage.getItem(LS_SYRINGE_UNITS_KEY) ?? '100', 10));
  const [showCalc, setShowCalc] = useState(false);

  const vialConc = Math.max(vialMg / vialVol, 0.01);
  // Mirrored into the plain mg/mL key too — SyringeGraphic/DoseCalculatorModal
  // on other pages (e.g. InjectionDayBanner) only know about mg/mL, not the
  // mg-per-volume pair this form edits.
  const handleVialMg = (v: string) => {
    const n = Math.max(parseFloat(v) || 12.5, 0.1);
    setVialMg(n);
    safeSetItem(LS_VIAL_MG_KEY, String(n));
    safeSetItem(LS_VIAL_CONC_KEY, String(Math.max(n / vialVol, 0.01)));
  };
  const handleVialVol = (v: string) => {
    const n = Math.max(parseFloat(v) || 1, 0.01);
    setVialVol(n);
    safeSetItem(LS_VIAL_VOL_KEY, String(n));
    safeSetItem(LS_VIAL_CONC_KEY, String(Math.max(vialMg / n, 0.01)));
  };
  const handleSyringeUnits = (v: string) => {
    const n = parseInt(v, 10);
    setSyringeUnits(n);
    safeSetItem(LS_SYRINGE_UNITS_KEY, String(n));
  };

  return (
    <div className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${color}22` }}>
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Vial</span>
          <input
            type="number"
            step={0.5}
            min={0.1}
            value={vialMg}
            onChange={(e) => handleVialMg(e.target.value)}
            className="w-16 text-[13px] font-semibold px-2 py-0.5 rounded-lg border border-slate-300 bg-slate-50 text-center"
          />
          <span className="text-[11px] text-slate-400">mg /</span>
          <input
            type="number"
            step={0.1}
            min={0.01}
            value={vialVol}
            onChange={(e) => handleVialVol(e.target.value)}
            className="w-14 text-[13px] font-semibold px-2 py-0.5 rounded-lg border border-slate-300 bg-slate-50 text-center"
          />
          <span className="text-[11px] text-slate-400">mL ({vialConc.toFixed(2)} mg/mL)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Syringe</span>
          <select
            value={syringeUnits}
            onChange={(e) => handleSyringeUnits(e.target.value)}
            className="text-[13px] font-semibold px-2 py-0.5 rounded-lg border border-slate-300 bg-slate-50"
          >
            <option value={30}>30 units</option>
            <option value={60}>60 units</option>
            <option value={100}>100 units</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
          {injPerWeek > 1 ? 'Draw up per injection' : 'Draw up'}
        </div>
        <button
          type="button"
          onClick={() => setShowCalc(true)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
        >
          Calculator
        </button>
      </div>
      <SyringeGraphic doseMg={doseMg} concentration={vialConc} color={color} maxUnits={syringeUnits} />

      {showCalc && (
        <DoseCalculatorModal
          initialDoseMg={doseMg}
          initialConcMgMl={vialConc}
          surveyTrend={sortedInjections.filter((inj) => inj.nausea != null || inj.hunger != null || inj.foodNoise != null).slice(-4)}
          onClose={() => setShowCalc(false)}
        />
      )}
    </div>
  );
}

// Ported from V1's DoseCalculatorModal (index.html:8296-8530) — a standalone
// "what if" calculator for drawing up an arbitrary dose at an arbitrary vial
// concentration, plus a reference units table across the full titration
// range. Simplified from V1: no PNG-share-to-chat button and no "recent
// survey trend" panel (already visible per-row in the Dosing tab's
// injection log) — both are conveniences layered on the calculator itself,
// not the calculator.
import { useState } from 'react';
import { SyringeGraphic } from './SyringeGraphic';
import { buildDoseTable } from '../lib/domain/doseTable';
import { safeSetItem } from '../lib/storage';

const LS_VIAL_CONC_KEY = 'weight-tracker-vial-conc';
const LS_SYRINGE_UNITS_KEY = 'weight-tracker-syringe-units';

interface DoseCalculatorModalProps {
  initialDoseMg: number;
  initialConcMgMl: number;
  onClose: () => void;
}

export function DoseCalculatorModal({ initialDoseMg, initialConcMgMl, onClose }: DoseCalculatorModalProps) {
  const [dose, setDose] = useState(String(initialDoseMg));
  const [conc, setConc] = useState(String(initialConcMgMl));

  const handleConcChange = (v: string) => {
    setConc(v);
    safeSetItem(LS_VIAL_CONC_KEY, v);
  };

  const doseMg = parseFloat(dose) || 0;
  const concMgMl = Math.max(parseFloat(conc) || 12.5, 0.1);
  const units = doseMg > 0 ? Math.round(((doseMg / concMgMl) * 100 * 10)) / 10 : 0;
  const ml = doseMg > 0 ? (doseMg / concMgMl).toFixed(2) : '—';
  const syringeMax = parseInt(localStorage.getItem(LS_SYRINGE_UNITS_KEY) || '100', 10);
  const doseTable = buildDoseTable(concMgMl);

  return (
    <div className="fixed inset-0 bg-black/45 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[22px] px-5 pt-5.5 pb-6.5 w-full max-w-[400px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <div className="text-lg font-bold text-slate-900">💉 Dose Calculator</div>
          <button type="button" onClick={onClose} className="text-lg text-slate-400 bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Dose (mg)</div>
            <input
              type="number"
              step={0.125}
              min={0}
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              className="w-full text-[22px] font-bold py-2.5 border-0 border-b-2 border-slate-300 text-center outline-none bg-transparent text-slate-900"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Vial (mg/mL)</div>
            <input
              type="number"
              step={0.1}
              min={0.1}
              value={conc}
              onChange={(e) => handleConcChange(e.target.value)}
              className="w-full text-[22px] font-bold py-2.5 border-0 border-b-2 border-slate-300 text-center outline-none bg-transparent text-slate-900"
            />
          </div>
        </div>

        <SyringeGraphic doseMg={doseMg} concentration={concMgMl} color="#2563eb" maxUnits={syringeMax} />

        <div className={`mt-4 text-center py-3.5 px-3 rounded-2xl ${doseMg > 0 ? 'bg-blue-50' : 'bg-slate-50'}`}>
          {doseMg > 0 ? (
            <>
              <div>
                <span className="text-[38px] font-extrabold text-blue-600 tabular-nums">{units}</span>
                <span className="text-xl text-blue-600 ml-1.5">units</span>
                <span className="text-base text-slate-400 ml-4">{ml} mL</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">on {syringeMax}-unit insulin syringe</div>
            </>
          ) : (
            <div className="text-sm text-slate-400">Enter a dose above</div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Units table @ {concMgMl.toFixed(2)} mg/mL</div>
          <div className="max-h-[200px] overflow-y-auto border border-slate-200 rounded-[10px]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['Dose (mg)', 'Units', 'mL'].map((h) => (
                    <th key={h} className="sticky top-0 bg-slate-50 text-[10.5px] font-bold text-slate-400 uppercase tracking-wide px-2.5 py-1.5 text-center border-b border-slate-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doseTable.map((r, i) => {
                  const isCurrent = doseMg > 0 && Math.abs(r.mg - doseMg) < 0.001;
                  return (
                    <tr key={r.mg} style={{ background: isCurrent ? '#eaf3ff' : i % 2 ? '#fafafc' : '#fff' }}>
                      <td className={`px-2.5 py-1.5 text-center ${isCurrent ? 'font-bold text-blue-800' : 'font-semibold text-slate-900'}`}>{r.mg.toFixed(2)}</td>
                      <td className={`px-2.5 py-1.5 text-center ${isCurrent ? 'font-bold text-blue-800' : 'font-semibold text-slate-900'}`}>{r.units}</td>
                      <td className={`px-2.5 py-1.5 text-center ${isCurrent ? 'text-blue-800' : 'text-slate-400'}`}>{r.ml}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

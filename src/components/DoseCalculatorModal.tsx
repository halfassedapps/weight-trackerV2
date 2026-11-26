// Ported from V1's DoseCalculatorModal (index.html:8296-8530) — a standalone
// "what if" calculator for drawing up an arbitrary dose at an arbitrary vial
// concentration, plus a reference units table across the full titration
// range, a PNG share of the result, and a recent-survey-trend readout.
import { useState } from 'react';
import { SyringeGraphic } from './SyringeGraphic';
import { buildDoseTable } from '../lib/domain/doseTable';
import { safeSetItem } from '../lib/storage';
import type { Injection } from '../lib/gist/types';

const LS_VIAL_CONC_KEY = 'weight-tracker-vial-conc';
const LS_SYRINGE_UNITS_KEY = 'weight-tracker-syringe-units';
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif";

interface DoseCalculatorModalProps {
  initialDoseMg: number;
  initialConcMgMl: number;
  /** Last up to 4 injections with any survey data logged, ascending by date —
   * a display convenience, never read by any guidance logic. */
  surveyTrend?: Injection[];
  onClose: () => void;
}

export function DoseCalculatorModal({ initialDoseMg, initialConcMgMl, surveyTrend = [], onClose }: DoseCalculatorModalProps) {
  const [dose, setDose] = useState(String(initialDoseMg));
  const [conc, setConc] = useState(String(initialConcMgMl));
  const [sharing, setSharing] = useState(false);
  const [includeTable, setIncludeTable] = useState(false);

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

  const shareCalculator = async () => {
    if (sharing || doseMg <= 0) return;
    setSharing(true);
    try {
      const scale = 3;
      const W = 320;
      const headerH = 90;
      const rowH = 15;
      const tableHeaderH = 18;
      const bodyH = includeTable ? tableHeaderH + doseTable.length * rowH + 10 : 0;

      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = (headerH + bodyH + 10) * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1c1c1e';
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText('💉 Dose Calculator', 16, 22);
      ctx.fillStyle = '#8e8e93';
      ctx.font = `600 11px ${FONT}`;
      ctx.fillText(`Vial: ${concMgMl.toFixed(2)} mg/mL`, 16, 40);

      ctx.fillStyle = '#2563eb';
      ctx.font = `800 26px ${FONT}`;
      ctx.fillText(`${units} units`, 16, 68);
      ctx.fillStyle = '#8e8e93';
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText(`${ml} mL  ·  ${doseMg} mg  ·  ${syringeMax}-unit syringe`, 16, 84);

      if (includeTable) {
        ctx.font = `700 9px ${FONT}`;
        ctx.fillStyle = '#8e8e93';
        ctx.fillText('DOSE (MG)', 16, headerH + 10);
        ctx.fillText('UNITS', 140, headerH + 10);
        ctx.fillText('ML', 240, headerH + 10);
        doseTable.forEach((r, i) => {
          const rowY = headerH + tableHeaderH + i * rowH;
          const isCurrent = doseMg > 0 && Math.abs(r.mg - doseMg) < 0.001;
          if (isCurrent) {
            ctx.fillStyle = '#eaf3ff';
            ctx.fillRect(10, rowY - 10, W - 20, rowH);
          } else if (i % 2 === 1) {
            ctx.fillStyle = '#f7f7f9';
            ctx.fillRect(10, rowY - 10, W - 20, rowH);
          }
          ctx.font = `600 10.5px ${FONT}`;
          ctx.fillStyle = isCurrent ? '#1c56a0' : '#3c3c43';
          ctx.fillText(r.mg.toFixed(2), 16, rowY);
          ctx.fillText(String(r.units), 140, rowY);
          ctx.fillText(r.ml, 240, rowY);
        });
      }

      const fileBlob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!fileBlob) return;
      const file = new File([fileBlob], 'dose-calculator.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Dose Calculator',
          text: `${doseMg} mg = ${units} units (${ml} mL) @ ${concMgMl.toFixed(2)} mg/mL`,
        });
      } else {
        const url = URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dose-calculator.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.warn('[DoseCalculatorModal] share failed:', e);
    } finally {
      setSharing(false);
    }
  };

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

        <div className="flex items-center justify-between mt-3.5">
          <label className="flex items-center gap-1.5 text-[12.5px] text-slate-700 cursor-pointer">
            <input type="checkbox" checked={includeTable} onChange={(e) => setIncludeTable(e.target.checked)} className="accent-blue-600 w-[15px] h-[15px]" />
            Include units table
          </label>
          <button
            type="button"
            onClick={shareCalculator}
            disabled={sharing || doseMg <= 0}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 rounded-full px-3 py-1.5 disabled:opacity-50"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .09 1.74L8.91 9.13a3 3 0 1 0 0 5.74l6.18 3.39A3 3 0 1 0 18 16a3 3 0 0 0-2.6 1.51l-6.19-3.4a3 3 0 0 0 0-.22l6.19-3.4A3 3 0 0 0 18 8z" />
            </svg>
            {sharing ? 'Preparing…' : 'Share'}
          </button>
        </div>

        {surveyTrend.length > 0 && (
          <div className="mt-2.5 p-3.5 rounded-2xl bg-white border border-black/[.08]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Recent Survey Trend</div>
            {(['nausea', 'hunger', 'foodNoise'] as const).map((key) => (
              <div key={key} className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 w-[78px] shrink-0">{key === 'foodNoise' ? 'Food noise' : key === 'hunger' ? 'Hunger' : 'Nausea'}</span>
                <div className="flex gap-1.5">
                  {surveyTrend.map((inj) => (
                    <span key={inj.date} className={`text-xs font-semibold tabular-nums ${inj[key] == null ? 'text-slate-300' : 'text-slate-900'}`}>
                      {inj[key] ?? '—'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

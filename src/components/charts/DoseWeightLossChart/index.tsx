import { useMemo, useState } from 'react';
import { useGistData } from '../../../hooks/useGistData';
import { computeDoseWeightLossPeriods } from '../../../lib/domain/doseWeightLoss';
import { computeLogbook } from '../../../lib/domain/weightSeries';
import { DOSE_PALETTE } from '../../../lib/theme';

const CX = 140;
const CY = 140;
const R = 119;

/**
 * Pie chart + table of lbs lost per weekly-dose period — small enough (per
 * the project plan's splitting guidance) to keep data-fetch + render in one
 * file. Ported from V1's DoseWeightLossChart (index.html:7414-7552).
 */
export function DoseWeightLossChart() {
  const { data: gist, isLoading, error } = useGistData();
  const [hoveredDose, setHoveredDose] = useState<number | null>(null);

  const periods = useMemo(() => {
    if (!gist || gist.entries.length < 2 || gist.injections.length < 2) return null;
    const rows = computeLogbook(gist.entries); // newest-first
    const todayMs = new Date().setHours(12, 0, 0, 0);
    return computeDoseWeightLossPeriods(rows, gist.injections, gist.injSchedule, todayMs);
  }, [gist]);

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist || gist.injections.length < 2 || !periods || !periods.length) return null;

  const dosePeriods = periods.map((p, i) => ({ ...p, color: DOSE_PALETTE[i % DOSE_PALETTE.length] }));

  // Pie only shows periods where weight was lost; the table shows all.
  const pieSlices = dosePeriods.filter((p) => p.lostLbs > 0);
  const totalLost = dosePeriods.reduce((s, p) => s + p.lostLbs, 0);
  if (!pieSlices.length || totalLost <= 0) return null;

  let angle = -Math.PI / 2;
  const totalPieLost = pieSlices.reduce((s, p) => s + p.lostLbs, 0);
  const slices = pieSlices.map((p, i) => {
    const fraction = p.lostLbs / totalPieLost;
    const startA = angle;
    angle += fraction * 2 * Math.PI;
    const endA = angle;
    const large = fraction > 0.5 ? 1 : 0;
    const x1 = CX + R * Math.cos(startA);
    const y1 = CY + R * Math.sin(startA);
    const x2 = CX + R * Math.cos(endA);
    const y2 = CY + R * Math.sin(endA);
    return {
      ...p,
      i,
      fraction,
      d: `M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
    };
  });

  const hov = hoveredDose != null ? slices.find((s) => s.doseMg === hoveredDose) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-3.5 pt-2.5 pb-1 border-b border-black/[.06]">
        <div className="text-[13px] font-bold text-slate-900">Weight Loss per Dose</div>
        <div className="text-[10px] text-slate-400 mt-0.5">lbs lost during each dose period</div>
      </div>

      <div className="flex justify-center items-start flex-wrap gap-6 px-3.5 py-3">
        <svg
          viewBox="0 0 280 280"
          style={{ width: 240 }}
          className="shrink-0 cursor-default"
          onMouseLeave={() => setHoveredDose(null)}
        >
          {slices.map((s) => (
            <path
              key={s.i}
              d={s.d}
              fill={s.color}
              stroke="#fff"
              strokeWidth={1.5}
              opacity={hov && hov.doseMg !== s.doseMg ? 0.55 : 1}
              style={{ cursor: 'pointer', transition: 'opacity .15s' }}
              onMouseEnter={() => setHoveredDose(s.doseMg)}
              onClick={() => setHoveredDose((v) => (v === s.doseMg ? null : s.doseMg))}
            />
          ))}
          {hov && (
            <g pointerEvents="none">
              <circle cx={CX} cy={CY} r={58} fill="rgba(28,28,30,.88)" />
              <text x={CX} y={CY - 17} textAnchor="middle" fontSize={15} fontWeight={800} fill={hov.color}>
                {hov.doseMg} mg
              </text>
              <text x={CX} y={CY + 3} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,.65)">
                {(hov.fraction * 100).toFixed(1)}% of loss
              </text>
              <text x={CX} y={CY + 20} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
                {hov.lostLbs.toFixed(1)} lbs
              </text>
            </g>
          )}
        </svg>

        <div className="min-w-[180px] max-w-[260px]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b-[1.5px] border-black/10">
                <th className="text-left pt-1 pr-4 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-[.4px]">
                  Dose
                </th>
                <th className="text-right pt-1 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-[.4px]">
                  lbs lost
                </th>
              </tr>
            </thead>
            <tbody>
              {dosePeriods.map((p, i) => (
                <tr
                  key={i}
                  className="border-b border-black/[.06] cursor-pointer"
                  style={{ background: hoveredDose === p.doseMg ? `${p.color}12` : 'transparent' }}
                  onMouseEnter={() => setHoveredDose(p.doseMg)}
                  onMouseLeave={() => setHoveredDose(null)}
                >
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="font-semibold text-slate-900">{p.doseMg} mg</span>
                    </div>
                  </td>
                  <td
                    className="text-right py-1.5 font-semibold tabular-nums"
                    style={{ color: p.lostLbs < 0 ? '#ff3b30' : '#1c1c1e' }}
                  >
                    {p.lostLbs >= 0 ? p.lostLbs.toFixed(1) : `+${Math.abs(p.lostLbs).toFixed(1)}`}
                  </td>
                </tr>
              ))}
              <tr className="border-t-[1.5px] border-black/10">
                <td className="pt-1.5 pr-4 pb-1 pl-[18px] text-xs text-slate-400">Total</td>
                <td className="text-right pt-1.5 pb-1 font-bold text-slate-900 tabular-nums">{totalLost.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

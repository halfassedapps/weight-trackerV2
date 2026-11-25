import { useMemo, useState, type RefObject } from 'react';
import { maintToggleLabel } from '../../../lib/domain/maintenance';
import { DOSE_PALETTE } from '../../../lib/theme';
import type { DoseSeries } from './useDoseSeries';

const VW = 360;
const VH = 200;

interface ChartProps {
  svgRef: RefObject<SVGSVGElement | null>;
  series: DoseSeries;
  showWeight: boolean;
}

interface TipState {
  x: number;
  ms: number;
  dose: number;
  weight: { ms: number; lbs: number } | null;
  maint: 'start' | 'stop' | null;
}

export function Chart({ svgRef, series, showWeight }: ChartProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const { periods, weightPts, doseAtMs, weightAtMs, maintMarkers, lifetimeStartMs, viewStartMs, viewEndMs } = series;

  const PAD = useMemo(() => ({ t: 14, r: showWeight ? 30 : 14, b: 30, l: 30 }), [showWeight]);
  const cW = VW - PAD.l - PAD.r;
  const cH = VH - PAD.t - PAD.b;
  const xOf = (ms: number) => PAD.l + ((ms - viewStartMs) / (viewEndMs - viewStartMs || 1)) * cW;

  // One color per distinct weekly-dose period, assigned in appearance order
  // — matches WeightChart's DOSE_PALETTE cycling.
  const doseColorMap = useMemo(() => {
    const map = new Map<number, string>();
    periods.forEach((p) => {
      if (!map.has(p.doseMg)) map.set(p.doseMg, DOSE_PALETTE[map.size % DOSE_PALETTE.length]);
    });
    return map;
  }, [periods]);
  const colorForDose = (mg: number) => doseColorMap.get(mg) ?? '#4a90d9';

  const maxDoseMg = Math.max(...periods.map((p) => p.doseMg));
  const yMaxDose = Math.max(5, Math.ceil((maxDoseMg * 1.2) / 2.5) * 2.5);
  const yOfDose = (mg: number) => PAD.t + cH - (mg / yMaxDose) * cH;

  const weightMinRaw = weightPts.length ? Math.min(...weightPts.map((p) => p.lbs)) : 0;
  const weightMaxRaw = weightPts.length ? Math.max(...weightPts.map((p) => p.lbs)) : 1;
  const weightMin = Math.floor((weightMinRaw - 2) / 5) * 5;
  const weightMax = Math.ceil((weightMaxRaw + 2) / 5) * 5;
  const yOfWeight = (lbs: number) => PAD.t + cH - ((lbs - weightMin) / (weightMax - weightMin || 1)) * cH;

  // Solid fill step-area under the weekly dose, closed back down to the 0mg
  // baseline so it reads as a filled area rather than just a line.
  const areaD = useMemo(() => {
    if (!periods.length) return '';
    let d = `M ${xOf(periods[0].startMs).toFixed(2)} ${yOfDose(0).toFixed(2)}`;
    periods.forEach((p) => {
      d += ` L ${xOf(p.startMs).toFixed(2)} ${yOfDose(p.doseMg).toFixed(2)}`;
      d += ` L ${xOf(p.endMs).toFixed(2)} ${yOfDose(p.doseMg).toFixed(2)}`;
    });
    d += ` L ${xOf(periods[periods.length - 1].endMs).toFixed(2)} ${yOfDose(0).toFixed(2)} Z`;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, viewStartMs, viewEndMs, yMaxDose, PAD.l, PAD.r]);

  const weightPath = weightPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.ms).toFixed(2)} ${yOfWeight(p.lbs).toFixed(2)}`).join(' ');

  const doseStep = yMaxDose <= 10 ? 2.5 : yMaxDose <= 20 ? 5 : 10;
  const yTicksDose: number[] = [];
  for (let v = 0; v <= yMaxDose; v += doseStep) yTicksDose.push(v);

  const yTicksWeight: number[] = [];
  for (let v = Math.ceil(weightMin / 10) * 10; v <= weightMax; v += 10) yTicksWeight.push(v);

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const d = new Date(viewStartMs);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    while (d.getTime() <= viewEndMs) {
      ticks.push(d.getTime());
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  }, [viewStartMs, viewEndMs]);

  // Week-count ticks — weeks elapsed since the lifetime start, stable as the
  // range selector zooms in and out (same anchor WeightChart's week row uses).
  const { weekTicks, weekLabelStep } = useMemo(() => {
    const STEP = 86400000;
    const ticks: { ms: number; n: number }[] = [];
    const firstWeekN = Math.ceil((viewStartMs - lifetimeStartMs) / (7 * STEP));
    for (let n = firstWeekN; lifetimeStartMs + n * 7 * STEP <= viewEndMs; n++) {
      ticks.push({ ms: lifetimeStartMs + n * 7 * STEP, n });
    }
    const weekPxGap = cW / Math.max(ticks.length - 1, 1);
    return { weekTicks: ticks, weekLabelStep: Math.max(1, Math.ceil(7 / weekPxGap)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStartMs, viewEndMs, lifetimeStartMs, cW]);

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    if (x < PAD.l || x > PAD.l + cW) {
      setTip(null);
      return;
    }
    const ms = viewStartMs + ((x - PAD.l) / cW) * (viewEndMs - viewStartMs);
    const dose = doseAtMs(ms);
    if (dose == null) {
      setTip(null);
      return;
    }
    const nearMarker = maintMarkers.find((m) => Math.abs(xOf(m.ms) - x) < 3);
    setTip({ x, ms, dose, weight: showWeight ? weightAtMs(ms) : null, maint: nearMarker ? nearMarker.action : null });
  };

  if (!periods.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No dose data in this range.</p>;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      className="block w-full h-auto"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setTip(null)}
    >
      {yTicksDose.map((v) => (
        <g key={v}>
          <line x1={PAD.l} y1={yOfDose(v)} x2={PAD.l + cW} y2={yOfDose(v)} stroke="rgba(0,0,0,.05)" strokeWidth={0.5} />
          <text x={PAD.l - 3} y={yOfDose(v) + 2} textAnchor="end" fontSize={6} fill="#aeaeb2">
            {v}
          </text>
        </g>
      ))}

      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + cH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />
      <line x1={PAD.l} y1={PAD.t + cH} x2={PAD.l + cW} y2={PAD.t + cH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />

      {maintMarkers.map((m) => (
        <line
          key={m.ms}
          x1={xOf(m.ms)}
          y1={PAD.t}
          x2={xOf(m.ms)}
          y2={PAD.t + cH}
          stroke="#8e8e93"
          strokeWidth={1.3}
          strokeDasharray="2,2"
          opacity={0.6}
        />
      ))}

      <path d={areaD} fill="#4a90d9" opacity={0.22} />
      {periods.map((p, i) => (
        <line
          key={i}
          x1={xOf(p.startMs)}
          y1={yOfDose(p.doseMg)}
          x2={xOf(p.endMs)}
          y2={yOfDose(p.doseMg)}
          stroke={colorForDose(p.doseMg)}
          strokeWidth={1.5}
        />
      ))}
      {periods.slice(1).map((p, i) => (
        <line
          key={`step${i}`}
          x1={xOf(p.startMs)}
          y1={yOfDose(periods[i].doseMg)}
          x2={xOf(p.startMs)}
          y2={yOfDose(p.doseMg)}
          stroke={colorForDose(p.doseMg)}
          strokeWidth={1.5}
        />
      ))}

      {showWeight && weightPts.length > 1 && <path d={weightPath} fill="none" stroke="#34c759" strokeWidth={1} />}
      {showWeight &&
        yTicksWeight.map((v) => (
          <text key={v} x={PAD.l + cW + 4} y={yOfWeight(v) + 2} textAnchor="start" fontSize={6} fill="#34c759">
            {v}
          </text>
        ))}

      <text x={PAD.l - 3} y={PAD.t + cH + 10} textAnchor="end" fontSize={3.5} fill="#aeaeb2">
        Week
      </text>
      {weekTicks.map(({ ms, n }) => (
        <g key={n}>
          <line x1={xOf(ms)} y1={PAD.t + cH} x2={xOf(ms)} y2={PAD.t + cH + 2} stroke="#e5e5ea" strokeWidth={0.75} />
          {n % weekLabelStep === 0 && (
            <text x={xOf(ms)} y={PAD.t + cH + 10} textAnchor="middle" fontSize={3.5} fill="#c7c7cc">
              {n}
            </text>
          )}
        </g>
      ))}

      {xTicks.map((ms) => (
        <g key={ms}>
          <line x1={xOf(ms)} y1={PAD.t + cH} x2={xOf(ms)} y2={PAD.t + cH + 3} stroke="#d1d1d6" strokeWidth={1} />
          <text x={xOf(ms)} y={PAD.t + cH + 22} textAnchor="middle" fontSize={6} fill="#aeaeb2">
            {new Date(ms).toLocaleDateString('en-US', { month: 'short' })}
          </text>
        </g>
      ))}

      {tip &&
        (() => {
          const maintLabel = maintToggleLabel(tip.maint);
          const TW = maintLabel ? 102 : 86;
          const TH = 19 + (tip.weight ? 11 : 0) + (maintLabel ? 11 : 0) + 7;
          const tx = Math.max(PAD.l, Math.min(tip.x - TW / 2, PAD.l + cW - TW));
          const ty = PAD.t + 2;
          let row = ty + 9;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={tip.x} y1={PAD.t} x2={tip.x} y2={PAD.t + cH} stroke="rgba(28,28,30,.25)" strokeWidth={1} />
              <rect x={tx} y={ty} width={TW} height={TH} rx={4} fill="rgba(28,28,30,.9)" />
              <text x={tx + 5} y={row} fontSize={5} fill="rgba(255,255,255,.5)">
                {new Date(tip.ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </text>
              <text x={tx + 5} y={(row += 10)} fontSize={7.5} fontWeight={700} fill={colorForDose(tip.dose)}>
                {Math.round(tip.dose * 10) / 10} mg/wk
              </text>
              {tip.weight && (
                <text x={tx + 5} y={(row += 11)} fontSize={6} fill="#34c759">
                  {tip.weight.lbs.toFixed(1)} lbs
                </text>
              )}
              {maintLabel && (
                <text x={tx + 5} y={(row += 11)} fontSize={6} fontWeight={600} fill="#c7c7cc">
                  {maintLabel}
                </text>
              )}
            </g>
          );
        })()}
    </svg>
  );
}

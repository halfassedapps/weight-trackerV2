import { useMemo, useState, type RefObject } from 'react';
import { BP_BANDS, BP_DIA_COLOR, BP_SYS_COLOR } from '../../../lib/domain/bloodPressure';
import { maintToggleLabel } from '../../../lib/domain/maintenance';
import type { BpSeries } from './useBpSeries';

const VW = 360;
const VH = 180;
const PAD = { t: 14, r: 10, b: 28, l: 32 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;

interface ChartProps {
  svgRef: RefObject<SVGSVGElement | null>;
  series: BpSeries;
}

interface TipState {
  x: number;
  point: BpSeries['points'][number];
  maint: 'start' | 'stop' | null;
}

export function Chart({ svgRef, series }: ChartProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const { points, viewStartMs, viewEndMs, maintMarkers } = series;

  const dataMax = Math.max(...points.map((p) => p.systolic));
  const dataMin = Math.min(...points.map((p) => p.diastolic));
  const yMax = Math.max(160, Math.ceil((dataMax + 10) / 10) * 10);
  const yMin = Math.min(50, Math.floor((dataMin - 10) / 10) * 10);

  const xOf = (ms: number) => PAD.l + ((ms - viewStartMs) / (viewEndMs - viewStartMs || 1)) * CW;
  const yOf = (mmHg: number) => PAD.t + CH - ((mmHg - yMin) / (yMax - yMin)) * CH;

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / 20) * 20; v <= yMax; v += 20) ticks.push(v);
    return ticks;
  }, [yMin, yMax]);

  const bandRects = useMemo(() => {
    const rects: { y1: number; y2: number; color: string }[] = [];
    let prevMax = yMin;
    for (const b of BP_BANDS) {
      const top = Math.min(b.max, yMax);
      if (top > prevMax) rects.push({ y1: prevMax, y2: top, color: b.color });
      prevMax = top;
      if (prevMax >= yMax) break;
    }
    return rects;
  }, [yMin, yMax]);

  const sysPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.ms)},${yOf(p.systolic)}`).join(' ');
  const diaPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.ms)},${yOf(p.diastolic)}`).join(' ');

  const xTicks = useMemo(() => {
    const STEP = 86400000;
    const winMs = viewEndMs - viewStartMs;
    const tickMs = winMs > 60 * STEP ? 14 * STEP : winMs > 20 * STEP ? 7 * STEP : 3 * STEP;
    const first = Math.ceil(viewStartMs / tickMs) * tickMs;
    const ticks: number[] = [];
    for (let ms = first; ms <= viewEndMs; ms += tickMs) ticks.push(ms);
    return ticks;
  }, [viewStartMs, viewEndMs]);

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    if (x < PAD.l || x > PAD.l + CW || !points.length) {
      setTip(null);
      return;
    }
    const targetMs = viewStartMs + ((x - PAD.l) / CW) * (viewEndMs - viewStartMs);
    let idx = 0;
    let minDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.ms - targetMs);
      if (d < minDist) {
        minDist = d;
        idx = i;
      }
    });
    const point = points[idx];
    const nearMarker = maintMarkers.find((m) => Math.abs(xOf(m.ms) - x) < 3);
    setTip({ x: xOf(point.ms), point, maint: nearMarker ? nearMarker.action : null });
  };

  if (!points.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No readings in this range.</p>;
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="block w-full h-auto" onMouseMove={onMouseMove} onMouseLeave={() => setTip(null)}>
      {bandRects.map((b, i) => (
        <rect key={i} x={PAD.l} y={yOf(b.y2)} width={CW} height={yOf(b.y1) - yOf(b.y2)} fill={b.color} opacity={0.07} />
      ))}

      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} y1={yOf(v)} x2={PAD.l + CW} y2={yOf(v)} stroke="rgba(0,0,0,.05)" strokeWidth={0.5} />
          <text x={PAD.l - 3} y={yOf(v) + 2} textAnchor="end" fontSize={7} fill="#aeaeb2">
            {v}
          </text>
        </g>
      ))}

      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />
      <line x1={PAD.l} y1={PAD.t + CH} x2={PAD.l + CW} y2={PAD.t + CH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />

      {maintMarkers.map((m) => (
        <line key={m.ms} x1={xOf(m.ms)} y1={PAD.t} x2={xOf(m.ms)} y2={PAD.t + CH} stroke="#8e8e93" strokeWidth={1.3} strokeDasharray="2,2" opacity={0.6} />
      ))}

      <path d={sysPath} fill="none" stroke={BP_SYS_COLOR} strokeWidth={1} />
      <path d={diaPath} fill="none" stroke={BP_DIA_COLOR} strokeWidth={1} />

      {points.map((p) => (
        <g key={p.date}>
          <circle cx={xOf(p.ms)} cy={yOf(p.systolic)} r={1.5} fill={BP_SYS_COLOR} />
          <circle cx={xOf(p.ms)} cy={yOf(p.diastolic)} r={1.5} fill={BP_DIA_COLOR} />
        </g>
      ))}

      {xTicks.map((ms) => (
        <text key={ms} x={xOf(ms)} y={PAD.t + CH + 10} textAnchor="middle" fontSize={7} fill="#aeaeb2">
          {new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}

      {tip &&
        (() => {
          const maintLabel = maintToggleLabel(tip.maint);
          const TW = 96;
          const rowH = 6.5;
          const headH = 21;
          const TH = headH + (tip.point.readings.length ? 5 + tip.point.readings.length * rowH : 0) + (maintLabel ? 9 : 0) + 4;
          const tx = Math.max(PAD.l, Math.min(tip.x - TW / 2, PAD.l + CW - TW));
          const ty = PAD.t + 2;
          const colT = tx + 5;
          const colS = tx + 46;
          const colD = tx + 70;
          let row = ty + 7;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={tip.x} y1={PAD.t} x2={tip.x} y2={PAD.t + CH} stroke="rgba(28,28,30,.25)" strokeWidth={1} />
              <rect x={tx} y={ty} width={TW} height={TH} rx={3} fill="rgba(28,28,30,.9)" />
              <text x={tx + 5} y={row} fontSize={5} fill="rgba(255,255,255,.5)">
                {new Date(tip.point.ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {tip.point.readings.length > 1 ? ` · ${tip.point.readings.length} readings` : ''}
              </text>
              <text x={tx + 5} y={(row += 10)} fontSize={8} fontWeight={700}>
                <tspan fill={BP_SYS_COLOR}>{Math.round(tip.point.systolic)}</tspan>
                <tspan fill="rgba(255,255,255,.5)"> / </tspan>
                <tspan fill={BP_DIA_COLOR}>{Math.round(tip.point.diastolic)}</tspan>
              </text>
              {tip.point.readings.length > 0 && (
                <>
                  <text x={colT} y={(row += 8)} fontSize={4.5} fill="rgba(255,255,255,.35)">TIME</text>
                  <text x={colS} y={row} fontSize={4.5} fill="rgba(255,255,255,.35)">SYS</text>
                  <text x={colD} y={row} fontSize={4.5} fill="rgba(255,255,255,.35)">DIA</text>
                  {tip.point.readings.map((r, i) => (
                    <g key={r.ms}>
                      <text x={colT} y={row + (i + 1) * rowH} fontSize={5} fill="rgba(255,255,255,.85)">
                        {new Date(r.ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </text>
                      <text x={colS} y={row + (i + 1) * rowH} fontSize={5} fill={BP_SYS_COLOR}>
                        {Math.round(r.systolic)}
                      </text>
                      <text x={colD} y={row + (i + 1) * rowH} fontSize={5} fill={BP_DIA_COLOR}>
                        {Math.round(r.diastolic)}
                      </text>
                    </g>
                  ))}
                </>
              )}
              {maintLabel && (
                <text x={tx + 5} y={ty + TH - 5} fontSize={4.5} fontWeight={600} fill="#c7c7cc">
                  {maintLabel}
                </text>
              )}
            </g>
          );
        })()}
    </svg>
  );
}

import { useState, type RefObject } from 'react';
import type { RidesSeries } from './useRidesSeries';

const VW = 360;
const VH = 140;
const PAD = { t: 10, r: 8, b: 28, l: 40 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;

interface ChartProps {
  svgRef: RefObject<SVGSVGElement | null>;
  series: RidesSeries;
}

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function Chart({ svgRef, series }: ChartProps) {
  const { points, viewStartMs, viewEndMs, maintMarkers } = series;
  const [tip, setTip] = useState<{ x: number; date: string; durSecs: number } | null>(null);

  if (!points.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No ride data in this range.</p>;
  }

  const maxMins = Math.max(...points.map((p) => p.totalDurSecs / 60), 1);
  const yMax = maxMins * 1.15;
  const xOf = (ms: number) => PAD.l + ((ms - viewStartMs) / (viewEndMs - viewStartMs || 1)) * CW;
  const yOf = (min: number) => PAD.t + CH - (min / yMax) * CH;
  const slotW = CW / Math.max(1, points.length);
  const barW = Math.max(1, Math.min(10, slotW * 0.6));

  const tickStep = yMax > 180 ? 60 : yMax > 60 ? 30 : 15;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += tickStep) yTicks.push(v);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="block w-full h-auto" onMouseLeave={() => setTip(null)}>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />
      <line x1={PAD.l} y1={PAD.t + CH} x2={PAD.l + CW} y2={PAD.t + CH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} y1={yOf(v)} x2={PAD.l + CW} y2={yOf(v)} stroke="rgba(0,0,0,.05)" strokeWidth={0.5} />
          <text x={PAD.l - 5} y={yOf(v) + 3} textAnchor="end" fontSize={5} fill="#aeaeb2">
            {v >= 60 ? `${(v / 60).toFixed(0)}h` : `${v}m`}
          </text>
        </g>
      ))}

      {maintMarkers.map((m) => (
        <line key={m.ms} x1={xOf(m.ms)} y1={PAD.t} x2={xOf(m.ms)} y2={PAD.t + CH} stroke="#8e8e93" strokeWidth={1.3} strokeDasharray="2,2" opacity={0.6} />
      ))}

      {points.map((p) => {
        const h = Math.max(0.5, (p.totalDurSecs / 60 / yMax) * CH);
        return (
          <rect
            key={p.date}
            x={xOf(p.ms) - barW / 2}
            y={PAD.t + CH - h}
            width={barW}
            height={h}
            rx={1}
            fill="#4a90d9"
            opacity={tip && tip.date === p.date ? 1 : 0.82}
            onMouseEnter={() => setTip({ x: xOf(p.ms), date: p.date, durSecs: p.totalDurSecs })}
          />
        );
      })}

      {tip &&
        (() => {
          const TW = 70;
          const TH = 22;
          const tx = Math.max(PAD.l, Math.min(tip.x - TW / 2, PAD.l + CW - TW));
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tx} y={PAD.t} width={TW} height={TH} rx={4} fill="rgba(28,28,30,.92)" />
              <text x={tx + TW / 2} y={PAD.t + 9} textAnchor="middle" fontSize={4.5} fill="rgba(255,255,255,.6)">
                {new Date(`${tip.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
              <text x={tx + TW / 2} y={PAD.t + 18} textAnchor="middle" fontSize={6} fontWeight={600} fill="#7fb2e8">
                {fmtDur(tip.durSecs)}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

import { useState, type RefObject } from 'react';
import type { RidePoint, RidesSeries } from './useRidesSeries';

const VW = 360;
const VH = 140;
const PAD = { t: 10, r: 8, b: 28, l: 40 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;

interface ChartProps {
  svgRef: RefObject<SVGSVGElement | null>;
  series: RidesSeries;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function Chart({ svgRef, series, selectedDate, onSelectDate }: ChartProps) {
  const { points, viewStartMs, viewEndMs, maintMarkers } = series;
  const [tip, setTip] = useState<RidePoint | null>(null);

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
            opacity={(tip?.date ?? selectedDate) === p.date ? 1 : 0.82}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setTip(p)}
            onClick={() => onSelectDate(p.date)}
          />
        );
      })}

      {/* Hover tooltip — date, duration, distance/calories, avg power/heart
          rate across the day's rides, and the activity count. Ported from
          V1 (index.html:3079-3116). */}
      {tip &&
        (() => {
          const pwrRides = tip.rides.filter((r) => r.pwr);
          const avgPwr = pwrRides.length ? Math.round(pwrRides.reduce((s, r) => s + (r.pwr ?? 0), 0) / pwrRides.length) : null;
          const hrRides = tip.rides.filter((r) => r.hr);
          const avgHr = hrRides.length ? Math.round(hrRides.reduce((s, r) => s + (r.hr ?? 0), 0) / hrRides.length) : null;
          const TW = 74;
          const TH = 44;
          const tx = Math.max(PAD.l, Math.min(xOf(tip.ms) - TW / 2, PAD.l + CW - TW));
          const ty = PAD.t + 2;
          let row = ty + 6;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={xOf(tip.ms)} y1={PAD.t} x2={xOf(tip.ms)} y2={PAD.t + CH} stroke="rgba(28,28,30,.25)" strokeWidth={1} />
              <rect x={tx} y={ty} width={TW} height={TH} rx={3} fill="rgba(28,28,30,.92)" />
              <text x={tx + 4} y={row} fontSize={4} fill="rgba(255,255,255,.5)">
                {new Date(`${tip.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </text>
              <text x={tx + 4} y={(row += 7)} fontSize={5.2} fontWeight={700} fill="#fff">
                {fmtDur(tip.totalDurSecs)}
              </text>
              <text x={tx + 4} y={(row += 7)} fontSize={4.5} fill="#aeaeb2">
                <tspan fill="#6cb2ff">{(tip.totalDistM / 1609.34).toFixed(1)} mi</tspan>
                <tspan dx={4} fill="#ffb04d">
                  {Math.round(tip.totalCal)} cal
                </tspan>
              </text>
              <text x={tx + 4} y={(row += 7)} fontSize={4.5} fill="#aeaeb2">
                {avgPwr != null ? <tspan fill="#bf5af2">{avgPwr}W</tspan> : <tspan>— W</tspan>}
                <tspan dx={4}>{avgHr != null ? <tspan fill="#ff375f">{avgHr} bpm</tspan> : '— bpm'}</tspan>
              </text>
              <text x={tx + 4} y={(row += 7)} fontSize={4} fill="rgba(255,255,255,.4)">
                {tip.rides.length} {tip.rides.length === 1 ? 'activity' : 'activities'}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

import { useMemo, useState, type RefObject } from 'react';
import { maintToggleLabel } from '../../../lib/domain/maintenance';
import type { PkSeries } from './usePkSeries';

const VW = 360;
const VH = 190;
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STEP_HALF = 3 * 3600000;

interface ChartProps {
  svgRef: RefObject<SVGSVGElement | null>;
  series: PkSeries;
}

interface TipState {
  x: number;
  y: number;
  ms: number;
  level: number;
  wLbs: number | null;
  segAvg: number | null;
  maint: 'start' | 'stop' | null;
}

export function Chart({ svgRef, series }: ChartProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const {
    viewStartMs,
    viewEndMs,
    todayMs,
    points,
    projPoints,
    intervalAvgs,
    futureIntervalAvgs,
    weightPts,
    interpWeight,
    upcomingInjMs,
    scheduleActive,
    curLevel,
    maxV,
    maintMarkers,
    showClutter,
    sortedInj,
  } = series;

  const PAD = { t: 18, r: 40, b: showClutter ? 60 : 22, l: 36 };
  const cW = VW - PAD.l - PAD.r;
  const cH = VH - PAD.t - PAD.b;
  const yMax = maxV * 1.5;

  const xOf = (ms: number) => PAD.l + ((ms - viewStartMs) / (viewEndMs - viewStartMs)) * cW;
  const yOf = (v: number) => PAD.t + cH - Math.min(v / yMax, 1) * cH;

  const wVals = weightPts.map((p) => p.lbs);
  const wMin = wVals.length ? Math.min(...wVals) : 0;
  const wMax = wVals.length ? Math.max(...wVals) : 1;
  const wPad = Math.max((wMax - wMin) * 0.15, 2);
  const wLo = wMin - wPad;
  const wHi = wMax + wPad;
  const yOfW = (lbs: number) => PAD.t + cH - ((lbs - wLo) / (wHi - wLo || 1)) * cH;

  const monthTicks = useMemo(() => {
    const ticks: { ms: number; label: string }[] = [];
    const d = new Date(viewStartMs);
    d.setDate(1);
    d.setHours(12, 0, 0, 0);
    while (d.getTime() <= viewEndMs) {
      ticks.push({ ms: d.getTime(), label: `${MO[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` });
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  }, [viewStartMs, viewEndMs]);

  const xWeekTicks = useMemo(() => {
    const ticks: number[] = [];
    const firstSun = new Date(viewStartMs);
    firstSun.setHours(12, 0, 0, 0);
    firstSun.setDate(firstSun.getDate() - firstSun.getDay());
    for (let tw = firstSun.getTime(); tw <= viewEndMs; tw += 7 * 86400000) {
      if (tw >= viewStartMs) ticks.push(tw);
    }
    return ticks;
  }, [viewStartMs, viewEndMs]);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.ms).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
  const area = points.length
    ? `${line} L${xOf(viewEndMs).toFixed(1)},${(PAD.t + cH).toFixed(1)} L${xOf(viewStartMs).toFixed(1)},${(PAD.t + cH).toFixed(1)} Z`
    : '';

  const todayX = xOf(todayMs);
  const yTicks = [maxV * 0.5, maxV];
  const yLabelPivot = PAD.t + cH + 4;

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VW;
    if (svgX < PAD.l || svgX > PAD.l + cW) {
      setTip(null);
      return;
    }
    const frac = (svgX - PAD.l) / cW;
    const ms = viewStartMs + frac * (viewEndMs - viewStartMs);
    const level = points.length ? (() => {
      // Nearest-point lookup, same resolution as the plotted curve.
      let best = points[0];
      let bestD = Infinity;
      for (const p of points) {
        const d = Math.abs(p.ms - ms);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best.v;
    })() : 0;
    const wLbs = interpWeight(ms);
    const seg = intervalAvgs.find((s) => ms >= s.startMs && ms <= s.endMs);
    const nearMarker = maintMarkers.find((m) => Math.abs(xOf(m.ms) - svgX) < 3);
    setTip({ x: svgX, y: yOf(level), ms, level, wLbs, segAvg: seg ? seg.mean : null, maint: nearMarker ? nearMarker.action : null });
  };

  if (!points.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No dose data in this range.</p>;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      className="block w-full h-auto cursor-crosshair overflow-hidden"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setTip(null)}
    >
      {!showClutter && monthTicks.map(({ ms }) => (
        <line key={ms} x1={xOf(ms)} y1={PAD.t} x2={xOf(ms)} y2={PAD.t + cH} stroke="rgba(0,0,0,.08)" strokeWidth={0.6} />
      ))}
      {showClutter && xWeekTicks.map((ms) => (
        <line key={ms} x1={xOf(ms)} y1={PAD.t} x2={xOf(ms)} y2={PAD.t + cH} stroke="rgba(0,0,0,.08)" strokeWidth={0.6} />
      ))}
      {yTicks.map((v, i) => (
        <line key={i} x1={PAD.l} y1={yOf(v)} x2={PAD.l + cW} y2={yOf(v)} stroke="rgba(0,0,0,.06)" strokeWidth={1} />
      ))}
      {todayMs >= viewStartMs && todayMs <= viewEndMs && (
        <rect x={todayX} y={PAD.t} width={Math.max(0, xOf(viewEndMs) - todayX)} height={cH} fill="rgba(0,0,0,.025)" />
      )}

      <path d={area} fill="#4a90d9" opacity={0.1} />
      <path d={line} fill="none" stroke="#4a90d9" strokeWidth={1.5} strokeLinejoin="round" />

      {projPoints.length > 1 && (
        <path
          d={projPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.ms).toFixed(1)},${Math.max(PAD.t, yOf(p.v)).toFixed(1)}`).join(' ')}
          fill="none"
          stroke="#4a90d9"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeDasharray="5,3"
          opacity={0.6}
        />
      )}

      {futureIntervalAvgs.map((seg, i) => {
        const x1 = Math.max(PAD.l, xOf(seg.startMs));
        const x2 = Math.min(PAD.l + cW, xOf(seg.endMs));
        if (x2 <= x1) return null;
        return (
          <g key={i}>
            <rect x={x1} y={yOf(seg.mean)} width={x2 - x1} height={Math.max(0, PAD.t + cH - yOf(seg.mean))} fill="#b06dff" opacity={0.04} />
            <line x1={x1} y1={yOf(seg.mean)} x2={x2} y2={yOf(seg.mean)} stroke="#b06dff" strokeWidth={1} opacity={0.4} strokeLinecap="round" strokeDasharray="3,2" />
          </g>
        );
      })}

      {showClutter &&
        intervalAvgs.map((seg, i) => {
          const x1 = Math.max(PAD.l, xOf(seg.startMs));
          const x2 = Math.min(PAD.l + cW, xOf(seg.endMs));
          if (x2 <= x1) return null;
          const xNow = seg.isLast ? Math.max(x1, Math.min(xOf(todayMs), x2)) : x2;
          const y = yOf(seg.mean);
          const h = Math.max(0, PAD.t + cH - y);
          return (
            <g key={i}>
              <rect x={x1} y={y} width={xNow - x1} height={h} fill="#b06dff" opacity={0.08} />
              <line x1={x1} y1={y} x2={xNow} y2={y} stroke="#b06dff" strokeWidth={1} opacity={0.55} strokeLinecap="round" />
              {seg.isLast && xNow < x2 && (
                <g>
                  <rect x={xNow} y={y} width={x2 - xNow} height={h} fill="#b06dff" opacity={0.04} />
                  <line x1={xNow} y1={y} x2={x2} y2={y} stroke="#b06dff" strokeWidth={1} opacity={0.45} strokeLinecap="round" strokeDasharray="3,2" />
                </g>
              )}
            </g>
          );
        })}

      {weightPts.length > 1 && (
        <polyline
          points={weightPts.map((p) => `${xOf(p.ms).toFixed(1)},${yOfW(p.lbs).toFixed(1)}`).join(' ')}
          fill="none"
          stroke="#34c759"
          strokeWidth={1}
          strokeLinejoin="round"
          opacity={0.85}
        />
      )}
      {weightPts.length === 1 && <circle cx={xOf(weightPts[0].ms)} cy={yOfW(weightPts[0].lbs)} r={2} fill="#34c759" />}

      {weightPts.length > 0 &&
        (() => {
          const rx = PAD.l + cW;
          const ticks = [wLo + wPad, (wLo + wHi) / 2, wHi - wPad].map((v) => Math.round(v * 10) / 10);
          return (
            <g>
              <line x1={rx} y1={PAD.t} x2={rx} y2={PAD.t + cH} stroke="rgba(52,198,89,.3)" strokeWidth={0.7} />
              {ticks.map((v, i) => (
                <g key={i}>
                  <line x1={rx} y1={yOfW(v)} x2={rx + 3} y2={yOfW(v)} stroke="rgba(52,198,89,.4)" strokeWidth={0.7} />
                  <text x={rx + 5} y={yOfW(v) + 2.5} fontSize={4.5} fill="#34c759" opacity={0.8}>
                    {Math.round(v)}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}

      {showClutter &&
        sortedInj
          .filter((inj) => {
            const ms = new Date(`${inj.date}T12:00:00`).getTime();
            return ms >= viewStartMs && ms <= viewEndMs;
          })
          .map((inj) => {
            const ms = new Date(`${inj.date}T12:00:00`).getTime();
            const x = xOf(ms);
            const y = yOf(points.find((p) => Math.abs(p.ms - ms) < STEP_HALF)?.v ?? 0);
            const d = new Date(`${inj.date}T12:00:00`);
            return (
              <g key={inj.date}>
                <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + cH} stroke="#4a90d9" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.45} />
                <circle cx={x} cy={y} r={2} fill="#fff" stroke="#4a90d9" strokeWidth={1} />
                <text x={x} y={yLabelPivot} textAnchor="end" fontSize={5} fill="#4a90d9" transform={`rotate(-90, ${x}, ${yLabelPivot})`}>
                  {MO[d.getMonth()]} {d.getDate()} · {inj.doseMg} mg
                </text>
              </g>
            );
          })}

      {maintMarkers.map((m) => (
        <line key={m.ms} x1={xOf(m.ms)} y1={PAD.t} x2={xOf(m.ms)} y2={PAD.t + cH} stroke="#8e8e93" strokeWidth={1.3} strokeDasharray="2,2" opacity={0.7} />
      ))}

      {showClutter &&
        upcomingInjMs.map((ms) => {
          const nx = xOf(ms);
          if (nx < PAD.l || nx > PAD.l + cW) return null;
          return (
            <g key={ms}>
              <line x1={nx} y1={PAD.t} x2={nx} y2={PAD.t + cH} stroke="#4a90d9" strokeWidth={0.7} strokeDasharray="2,3" opacity={0.25} />
              <text x={nx} y={yLabelPivot} textAnchor="end" fontSize={5} fill="#4a90d9" opacity={0.45} transform={`rotate(-90, ${nx}, ${yLabelPivot})`}>
                {new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {scheduleActive ? '' : ' · next?'}
              </text>
            </g>
          );
        })}

      {todayMs >= viewStartMs && todayMs <= viewEndMs && (
        <g>
          <line x1={todayX} y1={PAD.t} x2={todayX} y2={PAD.t + cH} stroke="#ff6b35" strokeWidth={1} />
          <circle cx={todayX} cy={yOf(curLevel)} r={2.5} fill="#ff6b35" stroke="#fff" strokeWidth={1} />
          <text x={todayX + 4} y={PAD.t + 7} fontSize={5} fill="#ff6b35" fontWeight={600}>
            today
          </text>
        </g>
      )}

      {yTicks.map((v, i) => (
        <text key={i} x={PAD.l - 4} y={yOf(v) + 2.5} textAnchor="end" fontSize={4.5} fill="#aeaeb2">
          {v.toFixed(1)}
        </text>
      ))}
      <text x={PAD.l - 4} y={PAD.t + cH + 4} textAnchor="end" fontSize={4.5} fill="#aeaeb2">
        0
      </text>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + cH} stroke="rgba(0,0,0,.1)" strokeWidth={1} />
      <line x1={PAD.l} y1={PAD.t + cH} x2={PAD.l + cW} y2={PAD.t + cH} stroke="rgba(0,0,0,.1)" strokeWidth={1} />

      {!showClutter &&
        monthTicks.map(({ ms, label }) => {
          const gx = xOf(ms);
          const lx = Math.max(PAD.l + 16, Math.min(PAD.l + cW - 16, gx));
          return (
            <g key={ms}>
              <line x1={gx} y1={PAD.t + cH} x2={gx} y2={PAD.t + cH + 4} stroke="rgba(0,0,0,.15)" strokeWidth={0.8} />
              <text x={lx} y={PAD.t + cH + 13} textAnchor="middle" fontSize={7} fill="#8e8e93">
                {label}
              </text>
            </g>
          );
        })}

      {tip &&
        (() => {
          const startLbs = weightPts.length ? weightPts[0].lbs : null;
          const lostLbs = tip.wLbs != null && startLbs != null ? tip.wLbs - startLbs : null;
          const maintLabel = maintToggleLabel(tip.maint);
          const TW = maintLabel ? 110 : 62;
          const TR = 4;
          const TH = 18 + (tip.wLbs != null ? 9 : 0) + (tip.segAvg != null ? 9 : 0) + (maintLabel ? 9 : 0);
          const flipLeft = tip.x > PAD.l + cW * 0.65;
          const tx = flipLeft ? tip.x - TW - 5 : tip.x + 5;
          const ty = Math.max(PAD.t, Math.min(tip.y - TH / 2, PAD.t + cH - TH));
          let row = ty + 6;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={tip.x} y1={PAD.t} x2={tip.x} y2={PAD.t + cH} stroke="rgba(28,28,30,.25)" strokeWidth={1} />
              <circle cx={tip.x} cy={tip.y} r={3} fill="#4a90d9" stroke="#fff" strokeWidth={1} />
              <rect x={tx} y={ty} width={TW} height={TH} rx={TR} fill="rgba(28,28,30,.88)" />
              <text x={tx + 5} y={row} fontSize={5} fill="rgba(255,255,255,.55)">
                {new Date(tip.ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </text>
              <text x={tx + 5} y={(row += 8)} fontSize={7.5} fontWeight={700} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {tip.level.toFixed(2)} mg
              </text>
              {tip.wLbs != null && (
                <text x={tx + 5} y={(row += 9)} fontSize={6.5} fill="#34c759" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {tip.wLbs.toFixed(1)}
                  {lostLbs != null ? ` / ${lostLbs.toFixed(1)}` : ''}
                </text>
              )}
              {tip.segAvg != null && (
                <text x={tx + 5} y={(row += 9)} fontSize={6.5} fill="#b06dff" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {tip.segAvg.toFixed(2)} mg
                </text>
              )}
              {maintLabel && (
                <text x={tx + 5} y={(row += 9)} fontSize={5.5} fontWeight={600} fill="#c7c7cc">
                  {maintLabel}
                </text>
              )}
            </g>
          );
        })()}
    </svg>
  );
}

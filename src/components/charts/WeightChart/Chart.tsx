import { useMemo, useState, type RefObject } from 'react';
import { lbsAtMs } from '../../../lib/domain/weightSeries';
import { maintToggleLabel } from '../../../lib/domain/maintenance';
import type { WeightSeries } from './useWeightSeries';

const VW = 360;
const VH = 200;
const PAD_BASE = { r: 14, b: 30, l: 38 };
// Dose-callout pills (below) live in a dedicated band above the plotted
// line, clear of the data entirely — only reserved while they're actually
// drawn (hideInjections off), otherwise it's just dead space at the top.
const PILL_H = 6;
const PILL_GAP = 2;
const PILL_ROW_Y = [2, 2 + PILL_H + 2]; // row 0 top, row 1 top

interface ChartProps {
  svgRef: RefObject<SVGSVGElement | null>;
  series: WeightSeries;
  goalLbs: number;
  maintenanceDriftLbs: number;
  /** Share view only — flattens the per-dose line coloring so a public link never implies dosing history. */
  hideInjections?: boolean;
}

interface TipState {
  x: number;
  ms: number;
  lbs: number;
  maint: 'start' | 'stop' | null;
}

export function Chart({ svgRef, series, goalLbs, maintenanceDriftLbs, hideInjections = false }: ChartProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const { displayPts, trendLines, doseAt, doseChanges, modeAtMs, maintMarkers, viewStartMs, viewEndMs } = series;
  const points = displayPts;

  const PAD = { ...PAD_BASE, t: hideInjections ? 14 : 32 };
  const CW = VW - PAD.l - PAD.r;
  const CH = VH - PAD.t - PAD.b;

  const maxLbs = Math.max(...points.map((p) => p.lbs)) + 5;
  const minLbs = goalLbs - 8;
  const xOf = (ms: number) => PAD.l + ((ms - viewStartMs) / (viewEndMs - viewStartMs || 1)) * CW;
  const yOf = (lbs: number) => PAD.t + (1 - (lbs - minLbs) / (maxLbs - minLbs)) * CH;
  const goalY = yOf(goalLbs);

  const colorForDose = (dose: number | null) => (hideInjections ? '#4a90d9' : series.colorForDose(dose));

  // Split the weight line into runs sharing the same active dose, each
  // overlapping its neighbor by one point so segments connect with no gap.
  const doseSegments = useMemo(() => {
    if (!points.length) return [];
    const segs: { dose: number | null; pts: typeof points }[] = [];
    let curDose = doseAt(points[0].ms);
    let curRun = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const d = doseAt(points[i].ms);
      if (d !== curDose) {
        curRun.push(points[i]);
        segs.push({ dose: curDose, pts: curRun });
        curRun = [points[i]];
        curDose = d;
      } else {
        curRun.push(points[i]);
      }
    }
    segs.push({ dose: curDose, pts: curRun });
    return segs;
  }, [points, doseAt]);

  // Dose-change callout pills — ported from V1 (index.html:5862-5897).
  // Placed left-to-right at each dose change's x position; a pill nudges
  // right of its ideal (dot-centered) position whenever it would overlap
  // the previous one in the same row, and drops to a second row once that
  // would push it too far right, so dense titration periods don't collide.
  const pillPlacements = useMemo(() => {
    if (hideInjections || !doseChanges.length) return [];
    const priorChanges = doseChanges.filter((c) => c.ms < viewStartMs);
    const visibleDoseChanges = [
      ...(priorChanges.length ? [{ ...priorChanges[priorChanges.length - 1], ms: viewStartMs }] : []),
      ...doseChanges.filter((c) => c.ms >= viewStartMs && c.ms <= viewEndMs),
    ];
    const prevRight = [-Infinity, -Infinity];
    return visibleDoseChanges.map((c) => {
      const dotX = xOf(c.ms);
      const dotY = yOf(lbsAtMs(points, c.ms) ?? goalLbs);
      const color = series.colorForDose(c.doseMg);
      const dosePart = `${c.doseMg}mg`;
      const pillW = 7 + dosePart.length * 2.2 + 8;
      let bestRow = 0;
      let bestCx = Infinity;
      for (let row = 0; row < 2; row++) {
        const minCx = prevRight[row] + PILL_GAP + pillW / 2;
        const cx = Math.min(Math.max(Math.max(dotX, minCx), PAD.l + pillW / 2), PAD.l + CW - pillW / 2);
        if (cx < bestCx) {
          bestCx = cx;
          bestRow = row;
        }
      }
      prevRight[bestRow] = bestCx + pillW / 2;
      return { dotX, dotY, color, dosePart, pillW, cx: bestCx, rowY: PILL_ROW_Y[bestRow] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideInjections, doseChanges, points, viewStartMs, viewEndMs]);

  // Goal-line segmentation: a plain dashed line while in weight-loss mode,
  // a shaded ± band with a dashed centerline while in maintenance mode.
  const goalSegs = useMemo(() => {
    const segs: { start: number; end: number; band: boolean }[] = [];
    const STEP = 86400000;
    let cursor = viewStartMs;
    for (let ms = viewStartMs; ms <= viewEndMs; ms += STEP) {
      const band = modeAtMs(ms) === 'maintenance';
      const last = segs[segs.length - 1];
      if (last && last.band === band) last.end = ms;
      else segs.push({ start: cursor, end: ms, band });
      cursor = ms;
    }
    return segs;
  }, [viewStartMs, viewEndMs, modeAtMs]);
  const bandTopY = yOf(goalLbs + maintenanceDriftLbs);
  const bandBotY = yOf(goalLbs - maintenanceDriftLbs);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = Math.ceil(minLbs / 10) * 10; v <= maxLbs; v += 10) ticks.push(v);
    return ticks;
  }, [minLbs, maxLbs]);

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

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    if (x < PAD.l || x > PAD.l + CW || !points.length) {
      setTip(null);
      return;
    }
    const targetMs = viewStartMs + ((x - PAD.l) / CW) * (viewEndMs - viewStartMs);
    let best = points[0];
    let minD = Infinity;
    for (const p of points) {
      const d = Math.abs(p.ms - targetMs);
      if (d < minD) {
        minD = d;
        best = p;
      }
    }
    const nearMarker = maintMarkers.find((m) => Math.abs(xOf(m.ms) - x) < 3);
    setTip({ x: xOf(best.ms), ms: best.ms, lbs: best.lbs, maint: nearMarker ? nearMarker.action : null });
  };

  if (!points.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No weight data in this range.</p>;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      className="block w-full h-auto"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setTip(null)}
    >
      {/* Maintenance band */}
      {goalSegs
        .filter((s) => s.band)
        .map((s, i) => (
          <rect
            key={`band-${i}`}
            x={xOf(s.start)}
            y={bandTopY}
            width={Math.max(0, xOf(s.end) - xOf(s.start))}
            height={Math.max(0, bandBotY - bandTopY)}
            fill="rgba(74,144,217,.12)"
          />
        ))}

      {/* Goal line (dashed, both modes), with an always-visible "weight loss
          goal" / "maintenance goal" label centered on each long-enough
          segment — ported from V1 (index.html:6588-6617). A sliver segment
          near the view's edge skips the label rather than clipping it. */}
      {goalSegs.map((s, i) => {
        const x1 = xOf(s.start);
        const x2 = xOf(s.end);
        const labelStr = s.band ? 'maintenance goal' : 'weight loss goal';
        const labelFontSize = 6;
        const labelLetterSpacing = 0.2;
        const labelW = labelStr.length * labelFontSize * 0.62 + (labelStr.length - 1) * labelLetterSpacing;
        const MIN_LABEL_SEG_W = 70;
        const showLabel = x2 - x1 >= MIN_LABEL_SEG_W;
        return (
          <g key={`goal-${i}`}>
            <line
              x1={x1}
              y1={goalY}
              x2={x2}
              y2={goalY}
              stroke={s.band ? '#4a90d9' : '#34c759'}
              strokeWidth={s.band ? 1 : 1.5}
              strokeDasharray={s.band ? '2,2' : '5,3'}
              opacity={s.band ? 0.5 : 0.55}
            />
            {showLabel && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={(x1 + x2) / 2 - labelW / 2 - 4}
                  y={goalY - labelFontSize / 2 - 2.5}
                  width={labelW + 8}
                  height={labelFontSize + 5}
                  rx={2}
                  fill={s.band ? '#e9f2fa' : '#fff'}
                />
                <text
                  x={(x1 + x2) / 2}
                  y={goalY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelFontSize}
                  fontWeight={700}
                  letterSpacing={labelLetterSpacing}
                  fill={s.band ? '#2c5682' : '#34c759'}
                >
                  {labelStr}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Maintenance toggle markers */}
      {maintMarkers.map((m) => (
        <line
          key={m.ms}
          x1={xOf(m.ms)}
          y1={PAD.t}
          x2={xOf(m.ms)}
          y2={PAD.t + CH}
          stroke="#8e8e93"
          strokeWidth={1.3}
          strokeDasharray="2,2"
          opacity={0.6}
        />
      ))}

      {/* Y grid + axis */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />
      <line x1={PAD.l} y1={PAD.t + CH} x2={PAD.l + CW} y2={PAD.t + CH} stroke="rgba(0,0,0,.1)" strokeWidth={0.5} />
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} y1={yOf(v)} x2={PAD.l + CW} y2={yOf(v)} stroke="rgba(0,0,0,.05)" strokeWidth={0.5} />
          <text x={PAD.l - 5} y={yOf(v) + 3} textAnchor="end" fontSize={4.5} fill="#aeaeb2">
            {v}
          </text>
        </g>
      ))}
      <text x={PAD.l - 5} y={goalY + 3} textAnchor="end" fontSize={4.5} fill="#34c759" fontWeight={600}>
        {goalLbs}
      </text>

      {/* X axis month ticks */}
      {xTicks.map((ms) => (
        <g key={ms}>
          <line x1={xOf(ms)} y1={PAD.t + CH} x2={xOf(ms)} y2={PAD.t + CH + 3} stroke="#d1d1d6" strokeWidth={1} />
          <text x={xOf(ms)} y={PAD.t + CH + 12} textAnchor="middle" fontSize={5} fill="#aeaeb2">
            {new Date(ms).toLocaleDateString('en-US', { month: 'short' })}
          </text>
        </g>
      ))}

      {/* Weight line, colored per active dose */}
      {doseSegments.map((seg, i) => (
        <path
          key={i}
          d={seg.pts.map((p, j) => `${j === 0 ? 'M' : 'L'} ${xOf(p.ms).toFixed(2)} ${yOf(p.lbs).toFixed(2)}`).join(' ')}
          fill="none"
          stroke={colorForDose(seg.dose)}
          strokeWidth={1.5}
        />
      ))}

      {/* Dose-change callout pills: dot on the line, pill in the dedicated
          top band, linked by a thin leader line. */}
      {pillPlacements.map((p, i) => (
        <g key={i}>
          <line x1={p.cx} y1={p.rowY + PILL_H} x2={p.dotX} y2={p.dotY} stroke={p.color} strokeWidth={0.6} opacity={0.5} />
          <circle cx={p.dotX} cy={p.dotY} r={2} fill={p.color} stroke="#fff" strokeWidth={0.8} />
          <g style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.2))' }}>
            <rect x={p.cx - p.pillW / 2} y={p.rowY} width={p.pillW} height={PILL_H} rx={PILL_H / 2} fill={p.color} />
            <text x={p.cx} y={p.rowY + PILL_H / 2 + 1.2} textAnchor="middle" fontSize={3.2} fontWeight={700} fill="#fff">
              {p.dosePart}
              <tspan fontSize={2.5} fontWeight={600}> /wk</tspan>
            </text>
          </g>
        </g>
      ))}

      {/* Trend lines — the regression fit ("current") and any checked
          hypothetical fixed-rate projections, each a dashed line from its
          own anchor to its own projected goal date (or fallback horizon). */}
      {trendLines.map((t) => (
        <line
          key={t.id}
          x1={xOf(t.points[0].ms)}
          y1={yOf(t.points[0].lbs)}
          x2={xOf(t.points[1].ms)}
          y2={yOf(t.points[1].lbs)}
          stroke={t.color}
          strokeWidth={1}
          strokeDasharray="3,2"
          opacity={0.7}
        />
      ))}

      {/* Hover tooltip */}
      {tip &&
        (() => {
          const maintLabel = maintToggleLabel(tip.maint);
          const modeLabel =
            modeAtMs(tip.ms) === 'maintenance'
              ? `maintenance goal: ${goalLbs - maintenanceDriftLbs}–${goalLbs + maintenanceDriftLbs} lbs`
              : `weight loss goal: ${goalLbs} lbs`;
          const TW = maintLabel ? 128 : 100;
          // +7 bottom padding below whichever line ends up last — without
          // it, the last line sits flush against the box edge.
          const TH = 29 + (maintLabel ? 10 : 0) + 7;
          const wy = yOf(tip.lbs);
          const tx = Math.max(PAD.l, Math.min(tip.x - TW / 2, PAD.l + CW - TW));
          const ty = Math.max(PAD.t + 2, wy - TH - 6);
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={tip.x} y1={PAD.t} x2={tip.x} y2={PAD.t + CH} stroke="rgba(28,28,30,.25)" strokeWidth={1} />
              <circle cx={tip.x} cy={wy} r={1.5} fill="#1c1c1e" />
              <rect x={tx} y={ty} width={TW} height={TH} rx={4} fill="rgba(28,28,30,.92)" />
              <text x={tx + TW / 2} y={ty + 8} textAnchor="middle" fontSize={4.5} fill="rgba(255,255,255,.55)">
                {new Date(tip.ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </text>
              <text x={tx + TW / 2} y={ty + 19} textAnchor="middle" fontSize={6.5} fontWeight={600} fill="#34c759">
                {tip.lbs.toFixed(1)} lbs
              </text>
              <text x={tx + TW / 2} y={ty + 29} textAnchor="middle" fontSize={4} fontWeight={600} fill="#7fb2e8">
                {modeLabel}
              </text>
              {maintLabel && (
                <text x={tx + TW / 2} y={ty + 39} textAnchor="middle" fontSize={4.5} fontWeight={600} fill="#c7c7cc">
                  {maintLabel}
                </text>
              )}
            </g>
          );
        })()}
    </svg>
  );
}

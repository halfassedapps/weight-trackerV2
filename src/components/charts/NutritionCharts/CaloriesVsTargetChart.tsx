// Ported from V1's CaloriesVsTargetChart (index.html:1945-2082). Deliberately
// does NOT re-derive a "goal deficit" from TDEE — see V1's own comment there:
// consumed-vs-chosen-target is the only daily number safe to hold yourself
// to; TDEE/energy-balance is only a multi-day trend (Predicted Pace below).
import { useState } from 'react';
import { maintToggleLabel, visibleMaintMarkers } from '../../../lib/domain/maintenance';
import { avg } from '../../../lib/domain/math';
import { roundedBarPath } from '../../../lib/domain/format';
import { NET_TIER_COLOR, calorieDeviationFor, netTier, type NetTier } from '../../../lib/domain/tdee';
import type { LogbookRow } from '../../../lib/domain/weightSeries';
import type { DatedTarget, MaintenanceHistoryEntry } from '../../../lib/gist/types';
import type { CalorieDayPoint } from './useNutritionWindow';

const VW = 360;
const VH = 140;
const PAD = { t: 10, r: 8, b: 28, l: 34 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;

interface CaloriesVsTargetChartProps {
  periodDaily: CalorieDayPoint[];
  visStartMs: number;
  visEndMs: number;
  todayMs: number;
  logbookRows: LogbookRow[];
  calorieTargets: DatedTarget[];
  intervalsCalories: Record<string, number> | undefined;
  maintenanceHistory: MaintenanceHistoryEntry[];
}

interface Pt extends CalorieDayPoint {
  tdee: number;
  net: number;
  baseTarget: number | null;
  exercise: number;
  target: number | null;
  deviation: number | null;
  tier: NetTier | null;
}

interface TipState extends Pt {
  maint: 'start' | 'stop' | null;
}

export function CaloriesVsTargetChart({
  periodDaily,
  visStartMs,
  visEndMs,
  todayMs,
  logbookRows,
  calorieTargets,
  intervalsCalories,
  maintenanceHistory,
}: CaloriesVsTargetChartProps) {
  const [tip, setTip] = useState<TipState | null>(null);

  const pts: Pt[] = periodDaily.map((d) => {
    const tdee = (d.BasalEnergy || 0) + (d.ActiveEnergy || 0);
    const net = (d.Calories || 0) - tdee;
    const { baseTarget, exercise, target, deviation } = calorieDeviationFor(d, calorieTargets, intervalsCalories);
    const tier = deviation != null ? netTier(deviation) : null;
    return { ...d, tdee, net, baseTarget, exercise, target, deviation, tier };
  });
  const withDeviation = pts.filter((p) => p.deviation != null);
  const maintMarkers = visibleMaintMarkers(maintenanceHistory, visStartMs, visEndMs);

  const maxAbs = Math.max(...withDeviation.map((p) => Math.abs(p.deviation!)), 300) * 1.15;
  const yZero = PAD.t + CH / 2;
  const yOf = (v: number) => yZero - (v / maxAbs) * (CH / 2);
  const xOf = (ms: number) => PAD.l + ((ms - visStartMs) / (visEndMs - visStartMs)) * CW;
  const barW = Math.max(0.5, Math.min(10, (CW / pts.length) * 0.55));

  const avgNet = avg(pts.map((p) => p.net));
  const predictedLbsPerWeek = (avgNet * 7) / 3500;
  const avgDeviation = withDeviation.length ? avg(withDeviation.map((p) => p.deviation!)) : null;
  const avgTier = avgDeviation != null ? netTier(avgDeviation) : null;

  const windowStartDate = new Date(visStartMs).toISOString().slice(0, 10);
  const windowEndDate = new Date(Math.min(todayMs, visEndMs)).toISOString().slice(0, 10);
  const actualRates = logbookRows.filter((r) => r.date >= windowStartDate && r.date < windowEndDate && r.rate != null).map((r) => r.rate!);
  const actualLbsPerWeek = actualRates.length ? avg(actualRates) : null;

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    if (x < PAD.l || x > PAD.l + CW) {
      setTip(null);
      return;
    }
    const targetMs = visStartMs + ((x - PAD.l) / CW) * (visEndMs - visStartMs);
    let idx = 0;
    let minDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.ms - targetMs);
      if (d < minDist) {
        minDist = d;
        idx = i;
      }
    });
    const nearMarker = maintMarkers.find((m) => Math.abs(xOf(m.ms) - x) < 3);
    setTip({ ...pts[idx], maint: nearMarker ? nearMarker.action : null });
  };

  return (
    <div>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="block w-full h-auto" onMouseMove={onMouseMove} onMouseLeave={() => setTip(null)}>
        {withDeviation.map((p) => {
          const x = xOf(p.ms) - barW / 2;
          const rx = Math.min(3, barW * 0.3);
          return <path key={p.date} d={roundedBarPath(x, barW, yZero, yOf(p.deviation!), rx)} fill={NET_TIER_COLOR[p.tier!]} opacity={0.88} />;
        })}

        <line x1={PAD.l} y1={yZero} x2={PAD.l + CW} y2={yZero} stroke="rgba(0,0,0,.2)" strokeWidth={0.7} />

        {maintMarkers.map((m) => (
          <line key={m.ms} x1={xOf(m.ms)} y1={PAD.t} x2={xOf(m.ms)} y2={PAD.t + CH} stroke="#8e8e93" strokeWidth={1.3} strokeDasharray="2,2" opacity={0.7} />
        ))}

        <text x={PAD.l - 3} y={PAD.t + 6} textAnchor="end" fontSize={7} fill="#aeaeb2">
          +{Math.round(maxAbs)}
        </text>
        <text x={PAD.l - 3} y={PAD.t + CH - 2} textAnchor="end" fontSize={7} fill="#aeaeb2">
          -{Math.round(maxAbs)}
        </text>
        <text x={PAD.l - 3} y={yZero + 2} textAnchor="end" fontSize={7} fill="#aeaeb2">
          0
        </text>

        {pts
          .filter((_, i) => i % Math.max(1, Math.floor(pts.length / 4)) === 0)
          .map((p) => (
            <text key={p.date} x={xOf(p.ms)} y={PAD.t + CH + 10} textAnchor="middle" fontSize={7} fill="#aeaeb2">
              {p.date.slice(5)}
            </text>
          ))}

        {tip &&
          tip.deviation != null &&
          (() => {
            const hasExercise = tip.exercise > 0;
            const maintLabel = maintToggleLabel(tip.maint);
            const TW = maintLabel ? 108 : 88;
            const TH = (hasExercise ? 33 : 27) + (maintLabel ? 9 : 0);
            const tx = Math.max(PAD.l, Math.min(xOf(tip.ms) - TW / 2, PAD.l + CW - TW));
            const ty = PAD.t + 2;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={xOf(tip.ms)} y1={PAD.t} x2={xOf(tip.ms)} y2={PAD.t + CH} stroke="rgba(28,28,30,.2)" strokeWidth={1} />
                <rect x={tx} y={ty} width={TW} height={TH} rx={3} fill="#1c1c1e" opacity={0.92} />
                <text x={tx + TW / 2} y={ty + 7} textAnchor="middle" fontSize={4.5} fill="#aeaeb2">
                  {tip.date.slice(5)}
                </text>
                <text x={tx + TW / 2} y={ty + 16} textAnchor="middle" fontSize={6} fontWeight={700} fill={NET_TIER_COLOR[tip.tier!]}>
                  {Math.round(Math.abs(tip.deviation))} {tip.deviation >= 0 ? 'over' : 'under'}
                </text>
                <text x={tx + TW / 2} y={ty + 23} textAnchor="middle" fontSize={4} fill="#aeaeb2">
                  {Math.round(tip.Calories || 0)} of {Math.round(tip.target!)} cal
                </text>
                {hasExercise && (
                  <text x={tx + TW / 2} y={ty + 29} textAnchor="middle" fontSize={4} fill="#aeaeb2">
                    ({tip.baseTarget} + {Math.round(tip.exercise)} workout)
                  </text>
                )}
                {maintLabel && (
                  <text x={tx + TW / 2} y={ty + TH - 5} textAnchor="middle" fontSize={4.5} fontWeight={600} fill="#c7c7cc">
                    {maintLabel}
                  </text>
                )}
              </g>
            );
          })()}
      </svg>

      <div className="flex gap-3 px-3.5 pt-2 text-xs flex-wrap">
        <Stat
          label="Avg Off Target"
          value={avgDeviation != null ? `${avgDeviation >= 0 ? '+' : ''}${Math.round(avgDeviation)} cal` : '—'}
          color={avgTier != null ? NET_TIER_COLOR[avgTier] : '#3c3c43'}
        />
        <Stat
          label="Predicted Pace"
          note="from TDEE, noisy"
          value={`${predictedLbsPerWeek >= 0 ? '+' : ''}${predictedLbsPerWeek.toFixed(2)} lb/wk`}
          color={predictedLbsPerWeek <= 0 ? '#0ca30c' : '#d03b3b'}
        />
        <Stat
          label="Actual Pace"
          note="from scale"
          value={actualLbsPerWeek != null ? `${actualLbsPerWeek >= 0 ? '+' : ''}${actualLbsPerWeek.toFixed(2)} lb/wk` : '—'}
          color={actualLbsPerWeek == null ? '#3c3c43' : actualLbsPerWeek <= 0 ? '#0ca30c' : '#d03b3b'}
        />
      </div>

      <div className="px-3.5 pt-0.5 pb-1 text-[10px] text-slate-400">
        Bars show consumed vs. target — bumped up on workout days by real logged-activity calories (intervals.icu) or, when unavailable, that
        day's measured Active Energy. TDEE-based pace (above) is a multi-day estimate, not a daily one.
      </div>
      <div className="px-3.5 pt-1.5 pb-3 text-[11px] font-semibold text-slate-600 flex gap-3.5 flex-wrap">
        <Swatch color={NET_TIER_COLOR.good} label="On Plan" />
        <Swatch color={NET_TIER_COLOR.ok} label="Off Plan" />
        <Swatch color={NET_TIER_COLOR.bad} label="Way Off" />
        {maintMarkers.length > 0 && <Swatch color="#8e8e93" label="Maintenance toggle" dashed />}
      </div>
    </div>
  );
}

function Stat({ label, value, note, color }: { label: string; value: string; note?: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      {note && <div className="text-[9px] text-slate-400">{note}</div>}
    </div>
  );
}

function Swatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={12} height={8}>
        <line x1={0} y1={4} x2={12} y2={4} stroke={color} strokeWidth={dashed ? 1.3 : 6} strokeDasharray={dashed ? '2,2' : undefined} />
      </svg>
      {label}
    </span>
  );
}

// Ported from V1's TdeeChart (index.html:1680-1944). Scope note: the
// Maintenance-suggestion accept button and the TDEE-calculator popover
// (TdeeCalculatorModal) are deferred — both depend on `measuredTdee`
// (V1's maintenanceCalorieSuggestion, not yet ported) and BMR-profile entry,
// neither of which this first pass needs. The core chart, stats, and
// admin target editor are fully ported.
import { useState } from 'react';
import { ChartLegendSwatch } from '../shared/ChartLegendSwatch';
import { Stat } from '../shared/Stat';
import { maintToggleLabel, visibleMaintMarkers } from '../../../lib/domain/maintenance';
import { avg } from '../../../lib/domain/math';
import { roundedBarPath } from '../../../lib/domain/format';
import { targetActiveAt } from '../../../lib/domain/tdee';
import { msToLocalDate } from '../../../lib/domain/csv';
import type { MaintenanceHistoryEntry } from '../../../lib/gist/types';
import type { CalorieDayPoint } from './useNutritionWindow';

const VW = 360;
const VH = 150;
const PAD = { t: 10, r: 8, b: 28, l: 34 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;

interface TdeeChartProps {
  periodDaily: CalorieDayPoint[];
  visStartMs: number;
  visEndMs: number;
  calorieTargets: { date: string; target: number }[];
  isAdmin: boolean;
  onSaveCalorieTarget: (n: number) => Promise<boolean>;
  maintenanceHistory: MaintenanceHistoryEntry[];
}

interface TipState extends CalorieDayPoint {
  tdee: number;
  target: number | null;
  maint: 'start' | 'stop' | null;
}

export function TdeeChart({ periodDaily, visStartMs, visEndMs, calorieTargets, isAdmin, onSaveCalorieTarget, maintenanceHistory }: TdeeChartProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTarget, setDraftTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const pts = periodDaily.map((d) => ({
    ...d,
    tdee: (d.BasalEnergy || 0) + (d.ActiveEnergy || 0),
    target: targetActiveAt(calorieTargets, d.date),
  }));
  const maintMarkers = visibleMaintMarkers(maintenanceHistory, visStartMs, visEndMs);

  const maxVal = Math.max(...pts.map((p) => Math.max(p.Calories || 0, p.tdee, p.target || 0)), 100) * 1.15;
  const xOf = (ms: number) => PAD.l + ((ms - visStartMs) / (visEndMs - visStartMs)) * CW;
  const yOf = (v: number) => PAD.t + CH - (v / maxVal) * CH;
  const yBaseline = PAD.t + CH;

  const slotW = CW / pts.length;
  const barW = Math.max(0.5, Math.min(12, slotW * 0.32));
  const GAP = Math.max(0.3, slotW * 0.06);

  const avgConsumed = avg(pts.map((p) => p.Calories || 0));
  const avgTdee = avg(pts.map((p) => p.tdee));
  const withTarget = pts.filter((p) => p.target != null);
  const pctOverTarget = withTarget.length
    ? Math.round((withTarget.filter((p) => (p.Calories || 0) > p.target!).length / withTarget.length) * 100)
    : null;

  const todayStr = msToLocalDate(Date.now());
  const currentTarget = targetActiveAt(calorieTargets, todayStr);

  const startEdit = () => {
    setDraftTarget(String(currentTarget ?? 1500));
    setEditing(true);
    setSaveErr('');
  };
  const saveTarget = async () => {
    const n = parseFloat(draftTarget);
    if (isNaN(n) || n <= 0) {
      setSaveErr('Enter a valid number');
      return;
    }
    setSaving(true);
    setSaveErr('');
    const ok = await onSaveCalorieTarget(n);
    setSaving(false);
    if (ok) setEditing(false);
    else setSaveErr("Couldn't save — try again.");
  };

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
        {pts.map((p) => {
          const cx = xOf(p.ms);
          const xTdee = cx - GAP / 2 - barW;
          const xCons = cx + GAP / 2;
          const yBasalTop = yOf(p.BasalEnergy || 0);
          const stackGap = 1;
          const yActiveBottom = Math.min(yBasalTop, yBaseline) - ((p.BasalEnergy || 0) > 0 ? stackGap : 0);
          const yActiveTop = yOf(p.tdee);
          const rx = Math.min(2, barW * 0.3);
          return (
            <g key={p.date}>
              <rect
                x={xTdee}
                y={Math.min(yBasalTop, yBaseline)}
                width={barW}
                height={Math.max(0, yBaseline - Math.min(yBasalTop, yBaseline))}
                fill="#1baf7a"
              />
              <path d={roundedBarPath(xTdee, barW, yActiveBottom, yActiveTop, rx)} fill="#eb6834" />
              <path d={roundedBarPath(xCons, barW, yBaseline, yOf(p.Calories || 0), rx)} fill="#2a78d6" />
              {p.target != null && (
                <line
                  x1={xCons - barW * 0.2}
                  x2={xCons + barW * 1.2}
                  y1={yOf(p.target)}
                  y2={yOf(p.target)}
                  stroke="#1c1c1e"
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              )}
            </g>
          );
        })}

        <line x1={PAD.l} y1={yBaseline} x2={PAD.l + CW} y2={yBaseline} stroke="rgba(0,0,0,.12)" strokeWidth={0.5} />

        {maintMarkers.map((m) => (
          <line key={m.ms} x1={xOf(m.ms)} y1={PAD.t} x2={xOf(m.ms)} y2={yBaseline} stroke="#8e8e93" strokeWidth={1.3} strokeDasharray="2,2" opacity={0.7} />
        ))}

        {(() => {
          const step = maxVal > 3000 ? 1000 : 500;
          const labels: number[] = [];
          for (let v = 0; v <= maxVal; v += step) labels.push(v);
          return labels.map((v) => (
            <g key={`y-${v}`}>
              <line x1={PAD.l - 2} y1={yOf(v)} x2={PAD.l + CW} y2={yOf(v)} stroke="rgba(0,0,0,.05)" strokeWidth={0.5} />
              <text x={PAD.l - 3} y={yOf(v) + 2} textAnchor="end" fontSize={7} fill="#aeaeb2">
                {v}
              </text>
            </g>
          ));
        })()}

        {pts
          .filter((_, i) => i % Math.max(1, Math.floor(pts.length / 4)) === 0)
          .map((p) => (
            <text key={p.date} x={xOf(p.ms)} y={yBaseline + 10} textAnchor="middle" fontSize={7} fill="#aeaeb2">
              {p.date.slice(5)}
            </text>
          ))}

        {tip &&
          (() => {
            const maintLabel = maintToggleLabel(tip.maint);
            const TW = maintLabel ? 110 : 86;
            const TH = 32 + (maintLabel ? 10 : 0);
            const tx = Math.max(PAD.l, Math.min(xOf(tip.ms) - TW / 2, PAD.l + CW - TW));
            const ty = PAD.t + 2;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={xOf(tip.ms)} y1={PAD.t} x2={xOf(tip.ms)} y2={yBaseline} stroke="rgba(28,28,30,.2)" strokeWidth={1} />
                <rect x={tx} y={ty} width={TW} height={TH} rx={3} fill="#1c1c1e" opacity={0.92} />
                <text x={tx + TW / 2} y={ty + 8} textAnchor="middle" fontSize={4.5} fill="#aeaeb2">
                  {tip.date.slice(5)}
                </text>
                <text x={tx + TW / 2} y={ty + 16} textAnchor="middle" fontSize={5} fontWeight={600}>
                  <tspan fill="#6ba9e8">{Math.round(tip.Calories || 0)} consumed</tspan>
                </text>
                <text x={tx + TW / 2} y={ty + 23} textAnchor="middle" fontSize={4.5} fontWeight={600}>
                  <tspan fill="#5ec99a">{Math.round(tip.BasalEnergy || 0)} basal</tspan>
                  <tspan fill="#48484a"> + </tspan>
                  <tspan fill="#f0a978">{Math.round(tip.ActiveEnergy || 0)} active</tspan>
                </text>
                <text x={tx + TW / 2} y={ty + 29} textAnchor="middle" fontSize={4} fill="#aeaeb2">
                  = {Math.round(tip.tdee)} burned
                </text>
                {maintLabel && (
                  <text x={tx + TW / 2} y={ty + 38} textAnchor="middle" fontSize={4.5} fontWeight={600} fill="#c7c7cc">
                    {maintLabel}
                  </text>
                )}
              </g>
            );
          })()}
      </svg>

      <div className="flex gap-3 px-3.5 pt-2 text-xs flex-wrap">
        <Stat label="Avg Consumed" value={`${Math.round(avgConsumed).toLocaleString()} cal`} color="#2a78d6" />
        <Stat label="Avg TDEE" value={`${Math.round(avgTdee).toLocaleString()} cal`} color="#eb6834" />
        <Stat label="Over Target" value={pctOverTarget != null ? `${pctOverTarget}%` : '—'} note="of days" color="#3c3c43" />
      </div>

      <div className="px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 flex gap-3.5 flex-wrap">
        <ChartLegendSwatch color="#1baf7a" label="Basal" thick />
        <ChartLegendSwatch color="#eb6834" label="Active" thick />
        <ChartLegendSwatch color="#2a78d6" label="Consumed" thick />
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-slate-900 opacity-80" />
          Target
        </span>
        {maintMarkers.length > 0 && <ChartLegendSwatch color="#8e8e93" label="Maintenance toggle" dashed thick />}
      </div>

      <div className="px-3.5 pb-3 flex items-center gap-2 flex-wrap">
        {!editing ? (
          <>
            <span className="text-[11px] text-slate-400">Target: {currentTarget != null ? `${currentTarget} cal` : 'not set'}</span>
            {isAdmin && (
              <button type="button" onClick={startEdit} className="text-[11px] font-semibold text-blue-600">
                Edit
              </button>
            )}
          </>
        ) : (
          <>
            <input
              type="number"
              step={10}
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              className="w-[68px] text-xs px-1.5 py-1 rounded-md border border-slate-300"
            />
            <button
              type="button"
              onClick={saveTarget}
              disabled={saving}
              className="text-[11px] font-semibold text-white bg-blue-600 rounded-md px-2.5 py-1 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setSaveErr('');
              }}
              disabled={saving}
              className="text-[11px] text-slate-400"
            >
              Cancel
            </button>
            {saveErr && <span className="text-[11px] text-red-500">{saveErr}</span>}
          </>
        )}
      </div>
    </div>
  );
}

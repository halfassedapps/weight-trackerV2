// Ported from V1's ProteinChart (index.html:2083-2260). Colored by
// proteinTier — a floor, not a two-sided target, so anything at/above the
// floor is just "good" with no extra credit for going further over.
import { useState } from 'react';
import { maintToggleLabel, visibleMaintMarkers } from '../../../lib/domain/maintenance';
import { avg } from '../../../lib/domain/math';
import { roundedBarPath } from '../../../lib/domain/format';
import { NET_TIER_COLOR, proteinTier, targetActiveAt, type NetTier } from '../../../lib/domain/tdee';
import type { DatedTarget, MaintenanceHistoryEntry } from '../../../lib/gist/types';
import type { CalorieDayPoint } from './useNutritionWindow';

const VW = 360;
const VH = 110;
const PAD = { t: 10, r: 8, b: 26, l: 28 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;

interface ProteinChartProps {
  periodDaily: CalorieDayPoint[];
  visStartMs: number;
  visEndMs: number;
  proteinTargets: DatedTarget[];
  isAdmin: boolean;
  onSaveProteinTarget: (n: number) => Promise<boolean>;
  maintenanceHistory: MaintenanceHistoryEntry[];
}

interface Pt extends CalorieDayPoint {
  target: number | null;
  tier: NetTier | null;
}

interface TipState extends Pt {
  maint: 'start' | 'stop' | null;
}

export function ProteinChart({ periodDaily, visStartMs, visEndMs, proteinTargets, isAdmin, onSaveProteinTarget, maintenanceHistory }: ProteinChartProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTarget, setDraftTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const pts: Pt[] = periodDaily.map((d) => {
    const target = targetActiveAt(proteinTargets, d.date);
    const value = d.Protein || 0;
    return { ...d, target, tier: proteinTier(value, target) };
  });

  const maxVal = Math.max(...pts.map((p) => Math.max(p.Protein || 0, p.target || 0)), 20) * 1.15;
  const xOf = (ms: number) => PAD.l + ((ms - visStartMs) / (visEndMs - visStartMs)) * CW;
  const yOf = (v: number) => PAD.t + CH - (v / maxVal) * CH;
  const yBaseline = PAD.t + CH;
  const barW = Math.max(0.5, Math.min(10, (CW / pts.length) * 0.55));
  const maintMarkers = visibleMaintMarkers(maintenanceHistory, visStartMs, visEndMs);

  const avgProtein = avg(pts.map((p) => p.Protein || 0));
  const withTarget = pts.filter((p) => p.target != null);
  const pctAtFloor = withTarget.length ? Math.round((withTarget.filter((p) => (p.Protein || 0) >= p.target!).length / withTarget.length) * 100) : null;

  const todayStr = new Date().toLocaleDateString('en-CA');
  const currentTarget = targetActiveAt(proteinTargets, todayStr);

  const startEdit = () => {
    setDraftTarget(String(currentTarget ?? 171));
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
    const ok = await onSaveProteinTarget(n);
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
          const x = xOf(p.ms) - barW / 2;
          const rx = Math.min(3, barW * 0.3);
          const fill = p.tier ? NET_TIER_COLOR[p.tier] : '#2a78d6';
          return <path key={p.date} d={roundedBarPath(x, barW, yBaseline, yOf(p.Protein || 0), rx)} fill={fill} opacity={0.9} />;
        })}
        <line x1={PAD.l} y1={yBaseline} x2={PAD.l + CW} y2={yBaseline} stroke="rgba(0,0,0,.12)" strokeWidth={0.5} />

        {maintMarkers.map((m) => (
          <line key={m.ms} x1={xOf(m.ms)} y1={PAD.t} x2={xOf(m.ms)} y2={yBaseline} stroke="#8e8e93" strokeWidth={1.3} strokeDasharray="2,2" opacity={0.7} />
        ))}

        {pts.map(
          (p) =>
            p.target != null && (
              <line
                key={`t-${p.date}`}
                x1={xOf(p.ms) - barW * 0.7}
                x2={xOf(p.ms) + barW * 0.7}
                y1={yOf(p.target)}
                y2={yOf(p.target)}
                stroke="#1c1c1e"
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.7}
              />
            ),
        )}

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
            const TW = maintLabel ? 102 : 58;
            const TH = 24 + (maintLabel ? 9 : 0);
            const tx = Math.max(PAD.l, Math.min(xOf(tip.ms) - TW / 2, PAD.l + CW - TW));
            const ty = PAD.t + 2;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={xOf(tip.ms)} y1={PAD.t} x2={xOf(tip.ms)} y2={yBaseline} stroke="rgba(28,28,30,.2)" strokeWidth={1} />
                <rect x={tx} y={ty} width={TW} height={TH} rx={3} fill="#1c1c1e" opacity={0.92} />
                <text x={tx + TW / 2} y={ty + 7} textAnchor="middle" fontSize={4.5} fill="#aeaeb2">
                  {tip.date.slice(5)}
                </text>
                <text x={tx + TW / 2} y={ty + 16} textAnchor="middle" fontSize={7} fontWeight={700} fill={tip.tier ? NET_TIER_COLOR[tip.tier] : '#6ba9e8'}>
                  {Math.round(tip.Protein || 0)}g
                </text>
                {tip.target != null && (
                  <text x={tx + TW / 2} y={ty + 22} textAnchor="middle" fontSize={4} fill="#aeaeb2">
                    of {tip.target}g floor
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
        <Stat label="Avg Protein" value={`${Math.round(avgProtein)} g/day`} color="#2a78d6" />
        <Stat label="Days at Floor" value={pctAtFloor != null ? `${pctAtFloor}%` : '—'} note="of days" color="#3c3c43" />
      </div>

      <div className="px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 flex gap-3.5 flex-wrap">
        <Swatch color={NET_TIER_COLOR.good} label="At floor" />
        <Swatch color={NET_TIER_COLOR.ok} label="Close (85–99%)" />
        <Swatch color={NET_TIER_COLOR.bad} label="Short (<85%)" />
        {maintMarkers.length > 0 && <Swatch color="#8e8e93" label="Maintenance toggle" dashed />}
      </div>

      <div className="px-3.5 pb-3 flex items-center gap-2 flex-wrap">
        {!editing ? (
          <>
            <span className="text-[11px] text-slate-400">Floor: {currentTarget != null ? `${currentTarget}g` : 'not set'}</span>
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
              step={1}
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

// Ported from V1's maintenance-history table (index.html:5218-5260) — a
// Started/Ended/Dose/Net-change row per maintenance period. Not duplicated
// anywhere else in V2 (the Maintenance Mode *guidance* text lives on the
// Dosing tab's DoseRecommendationCard instead, deliberately not repeated
// here), so this table itself was a pure gap.
import { Card } from './Card';
import { useGistData } from '../hooks/useGistData';
import { getDoseSchedule } from '../lib/domain/dosing';
import { deriveMaintenanceState } from '../lib/domain/maintenance';
import { computeLogbook, lbsAtMs } from '../lib/domain/weightSeries';

function fmtShortMs(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function MaintenanceHistoryCard() {
  const { data: gist, isLoading, error } = useGistData();
  if (isLoading || error || !gist) return null;

  const todayMs = new Date().setHours(12, 0, 0, 0);
  const { maintenancePeriods } = deriveMaintenanceState(gist.maintenanceHistory, todayMs);
  if (maintenancePeriods.length === 0) return null;

  const rows = computeLogbook(gist.entries);
  const points = [...rows].reverse().map((r) => ({ ms: new Date(`${r.date}T12:00:00`).getTime(), lbs: r.lbs }));
  const ds = getDoseSchedule(gist.injections, gist.injSchedule, false);
  const currentDoseMg = ds?.weeklyDose ?? null;

  return (
    <Card title="Maintenance History">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b-[1.5px] border-black/10">
            {['Started', 'Ended', 'Dose', 'Net change'].map((h, i) => (
              <th key={h} className={`py-1.5 px-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 ${i >= 2 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {maintenancePeriods.map((p, i) => {
            const endMsForCalc = p.ongoing ? todayMs : p.endMs;
            const startW = lbsAtMs(points, p.startMs);
            const endW = lbsAtMs(points, endMsForCalc);
            const net = startW != null && endW != null ? endW - startW : null;
            const endDose = p.ongoing ? currentDoseMg : p.endDoseMg;
            return (
              <tr key={i} className="border-b border-black/[.06] last:border-b-0">
                <td className="py-1.5 px-2.5">{fmtShortMs(p.startMs)}</td>
                <td className="py-1.5 px-2.5">
                  {p.ongoing ? <span className="font-semibold text-blue-600">Ongoing</span> : fmtShortMs(p.endMs)}
                </td>
                <td className="py-1.5 px-2.5 text-right tabular-nums">
                  {round2(p.startDoseMg)}
                  {endDose != null && round2(endDose) !== round2(p.startDoseMg) ? ` → ${round2(endDose)}` : ''} mg
                </td>
                <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums" style={{ color: net != null && net > 0 ? '#dc2626' : '#0f172a' }}>
                  {net != null ? `${net >= 0 ? '+' : ''}${net.toFixed(1)}` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

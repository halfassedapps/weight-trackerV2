// Ported from V1's weight logbook table + Summary footer
// (index.html:10218-10463, 10754-10782) — date-by-date log with injection
// markers interleaved, plus the days-tracked/total-change/current-rate
// summary tiles. V2 had the chart but no row-level log at all.
import { Card } from './Card';
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { useGistWrite } from '../hooks/useGistWrite';
import { doseGuidance } from '../lib/domain/dosing';
import { buildItems, computeLogbook } from '../lib/domain/weightSeries';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEADERS = ["DATE", "REC'D", '7D AVG', '2WK LOSS', 'BMI', '% LOST'];

export function WeightLogbookCard() {
  const { data: gist, isLoading, error } = useGistData();
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();

  if (isLoading) return null;
  if (error) return null;
  if (!gist || gist.entries.length === 0) return null;

  const rows = computeLogbook(gist.entries);
  const items = buildItems(rows, gist.injections);
  const baselineLbs = rows.length ? rows[rows.length - 1].lbs : null;
  const heightIn = gist.heightIn;

  const deleteRow = (date: string) => {
    gistWrite.mutate((current) => ({ ...current, entries: current.entries.filter((e) => e.date !== date) }));
  };
  const deleteInjection = (date: string) => {
    gistWrite.mutate((current) => ({ ...current, injections: current.injections.filter((i) => i.date !== date) }));
  };

  const change = rows.length >= 2 ? rows[0].lbs - rows[rows.length - 1].lbs : null;
  const rate = rows.find((r) => r.rate != null)?.rate ?? null;

  return (
    <>
      <Card>
        <div className="grid grid-cols-[2fr_1.1fr_1.1fr_1.5fr_1.1fr_1fr] gap-1 px-3.5 py-2 bg-slate-50 border-b border-black/10">
          {HEADERS.map((h, i) => (
            <div key={h} className={`text-[10px] font-bold tracking-wide text-slate-400 ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </div>
          ))}
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {items.map((item) => {
            if (item.type === 'injection') {
              return (
                <div key={`inj-${item.date}`} className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border-b border-black/[.06]">
                  <span className="text-[13px] font-bold text-blue-600 whitespace-nowrap">💉 Tirz {item.doseMg} mg</span>
                  <span className="text-[13px] text-blue-300">·</span>
                  <span className="text-[13px] text-blue-400">{fmtShort(item.date)}</span>
                  <div className="flex-1 h-px bg-blue-200/50" />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteInjection(item.date)}
                      disabled={gistWrite.isPending}
                      className="text-[13px] text-blue-200 px-0.5 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            }

            const g = doseGuidance(item.twoWeekLoss, null, null, null, false);
            const bmi = heightIn > 0 ? (703 * item.lbs) / (heightIn * heightIn) : null;
            const pctLost = baselineLbs != null ? ((baselineLbs - item.lbs) / baselineLbs) * 100 : null;

            return (
              <div
                key={item.date}
                className="grid grid-cols-[2fr_1.1fr_1.1fr_1.5fr_1.1fr_1fr] gap-1 items-center px-3.5 py-2.5 border-b border-black/[.06] last:border-b-0"
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[15px] font-semibold text-slate-900">{fmtShort(item.date)}</span>
                  <span className="text-xs text-slate-400">{WD[new Date(`${item.date}T12:00:00`).getDay()]}</span>
                  {item.isInjDay && <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1 rounded">inj</span>}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteRow(item.date)}
                      disabled={gistWrite.isPending}
                      className="ml-0.5 text-xs text-slate-300 px-0.5 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="text-right text-[15px] font-medium text-slate-900 tabular-nums">{item.lbs.toFixed(1)}</div>
                <div className="text-right text-[15px] text-slate-600 tabular-nums">{item.movAvg.toFixed(1)}</div>
                <div className="text-right">
                  {g ? (
                    <span className="inline-block text-[13px] font-semibold tabular-nums px-1.5 py-0.5 rounded" style={{ color: g.color, background: g.bg }}>
                      {item.twoWeekLoss! >= 0 ? '↓' : '↑'}
                      {Math.abs(item.twoWeekLoss!).toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-300">—</span>
                  )}
                </div>
                <div className="text-right text-[15px] text-slate-600 tabular-nums">{bmi != null ? bmi.toFixed(1) : '—'}</div>
                <div className="text-right">
                  {pctLost != null && (
                    <span className={`text-sm font-semibold tabular-nums ${pctLost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pctLost >= 0 ? '↓' : '↑'}
                      {Math.abs(pctLost).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {change != null && (
        <Card>
          <div className="grid grid-cols-3 gap-2 px-4 py-3.5">
            <Tile label="Days Tracked" value={String(rows.length)} />
            <Tile
              label="Total Change"
              value={`${change >= 0 ? '+' : ''}${change.toFixed(1)} lbs`}
              accent={change < -0.1 ? '#16a34a' : change > 0.1 ? '#dc2626' : undefined}
            />
            <Tile
              label="Cur. Rate/wk"
              value={rate != null ? `${rate >= 0 ? '+' : ''}${rate.toFixed(2)}` : '—'}
              accent={rate != null ? (rate < -0.01 ? '#16a34a' : rate > 0.01 ? '#dc2626' : undefined) : undefined}
            />
          </div>
        </Card>
      )}
    </>
  );
}

function fmtShort(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-base font-semibold tabular-nums" style={{ color: accent ?? '#1c1c1e' }}>
        {value}
      </div>
    </div>
  );
}

// Ported from V1's BpChart table view (index.html:2501-2547) — flattens
// each day's readings into one row per reading, newest-first, with
// maintenance-toggle dividers. Extended with a NOTE column (hover/tap for
// the full text if truncated) and, for the admin, inline note editing on
// any existing reading.
import { useState } from 'react';
import { NoteHoverPopover } from '../../NoteHoverPopover';
import { bpCategory } from '../../../lib/domain/bloodPressure';
import { maintToggleLabel } from '../../../lib/domain/maintenance';
import { useAuth } from '../../../hooks/useAuth';
import { useGistWrite } from '../../../hooks/useGistWrite';
import type { MaintenanceHistoryEntry } from '../../../lib/gist/types';
import type { BpSeries } from './useBpSeries';

function fmtDateParts(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return { wd: d.toLocaleDateString('en-US', { weekday: 'short' }), md: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function Table({ series, maintenanceHistory }: { series: BpSeries; maintenanceHistory: MaintenanceHistoryEntry[] | undefined }) {
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();
  const [editingMs, setEditingMs] = useState<number | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const flatRows = [...series.points]
    .flatMap((day) => day.readings.map((r) => ({ date: day.date, ms: r.ms, systolic: r.systolic, diastolic: r.diastolic, note: r.note })))
    .sort((a, b) => b.ms - a.ms);

  if (!flatRows.length) {
    return <p className="p-6 text-center text-sm text-slate-400">No readings in this range.</p>;
  }

  const startEdit = (ms: number, note: string | undefined) => {
    setEditingMs(ms);
    setDraftNote(note ?? '');
  };
  const cancelEdit = () => setEditingMs(null);

  const saveNote = async (ms: number) => {
    const trimmed = draftNote.trim();
    try {
      await gistWrite.mutateAsync((current) => ({
        ...current,
        bloodPressure: current.bloodPressure.map((entry) => {
          if (entry.ms !== ms) return entry;
          const { note: _ignored, ...rest } = entry;
          return trimmed ? { ...rest, note: trimmed } : rest;
        }),
      }));
      setEditingMs(null);
    } catch {
      // Leave the editor open with the draft intact so the user can retry.
    }
  };

  return (
    <div className="max-h-80 overflow-y-auto mx-3 rounded-lg border border-black/[.08]">
      <div className="grid grid-cols-[1.1fr_.9fr_.6fr_.6fr_1.4fr] px-2.5 py-1.5 bg-slate-100 border-b border-black/10 sticky top-0">
        {['DATE', 'TIME', 'SYS', 'DIA', 'NOTE'].map((h) => (
          <div key={h} className="text-[10px] font-bold tracking-wide text-slate-400">
            {h}
          </div>
        ))}
      </div>
      {flatRows.map((r, i) => {
        const { wd, md } = fmtDateParts(r.date);
        const hasBp = r.systolic != null && r.diastolic != null;
        const cat = hasBp ? bpCategory(r.systolic!, r.diastolic!) : null;
        const prevMs = i > 0 ? flatRows[i - 1].ms : Infinity;
        const maintHere = (maintenanceHistory ?? [])
          .filter((h) => {
            const ms = new Date(`${h.date}T12:00:00`).getTime();
            return ms <= prevMs && ms > r.ms;
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        return (
          <div key={r.ms}>
            {maintHere.map((h) => (
              <div key={h.date + h.action} className="px-2.5 py-1 text-[10.5px] font-bold text-blue-600 bg-blue-50 border-b border-black/[.06]">
                {maintToggleLabel(h.action)} · {md}
              </div>
            ))}
            <div
              title={cat?.label}
              className="grid grid-cols-[1.1fr_.9fr_.6fr_.6fr_1.4fr] px-2.5 py-1.5 text-[11px] border-b border-black/[.06] last:border-b-0"
              style={cat ? { background: `${cat.color}1f` } : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat?.color ?? '#c7c7cc' }} />
                <span className="text-slate-900 font-semibold">
                  {wd} {md}
                </span>
              </div>
              <div className="text-slate-400">{fmtTime(r.ms)}</div>
              <div className="font-semibold" style={{ color: '#e05252' }}>
                {hasBp ? Math.round(r.systolic!) : '—'}
              </div>
              <div className="font-semibold" style={{ color: '#4a90d9' }}>
                {hasBp ? Math.round(r.diastolic!) : '—'}
              </div>
              <div className="flex items-center gap-1 min-w-0">
                {r.note ? (
                  <NoteHoverPopover note={r.note} className="flex-1 min-w-0 block truncate text-slate-500">
                    {r.note}
                  </NoteHoverPopover>
                ) : (
                  <span className="text-slate-300">{isAdmin ? '' : '—'}</span>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => startEdit(r.ms, r.note)}
                    aria-label={r.note ? 'Edit note' : 'Add note'}
                    className="shrink-0 text-slate-300 hover:text-slate-500"
                  >
                    <PencilIcon />
                  </button>
                )}
              </div>
            </div>
            {editingMs === r.ms && (
              <div className="px-2.5 pb-2 pt-1.5 bg-slate-50 border-b border-black/[.06] flex gap-2 items-start">
                <textarea
                  autoFocus
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note…"
                  className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border border-slate-300 resize-none"
                />
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => saveNote(r.ms)}
                    disabled={gistWrite.isPending}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-green-600 text-white disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {gistWrite.isPending ? '…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

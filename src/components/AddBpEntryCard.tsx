// New admin form — V1 has no equivalent. Lets the user log a blood-pressure
// reading, a note-only entry (e.g. "stopped taking BP meds today"), or both
// together. Follows AddInjectionCard's pattern.
import { useState } from 'react';
import { Card } from './Card';
import { useAuth } from '../hooks/useAuth';
import { useGistWrite } from '../hooks/useGistWrite';
import { mergeBpByMs, msToLocalDate } from '../lib/domain/csv';
import type { BpReading } from '../lib/gist/types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function nowLocalTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddBpEntryCard() {
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => msToLocalDate(Date.now()));
  const [time, setTime] = useState(nowLocalTime);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!isAdmin) return null;

  const reset = () => {
    setSystolic('');
    setDiastolic('');
    setNote('');
    setError('');
  };

  const hasSys = systolic.trim() !== '';
  const hasDia = diastolic.trim() !== '';
  const hasNote = note.trim() !== '';
  const bothOrNeither = hasSys === hasDia;
  const canSave = !!date && bothOrNeither && (hasSys || hasNote);

  const addEntry = async () => {
    if (!canSave) return;
    const ms = new Date(`${date}T${time || '12:00'}:00`).getTime();
    const entry: BpReading = { date, ms };
    if (hasSys && hasDia) {
      entry.systolic = Number(systolic);
      entry.diastolic = Number(diastolic);
    }
    if (hasNote) entry.note = note.trim();
    setError('');
    try {
      await gistWrite.mutateAsync((current) => ({
        ...current,
        bloodPressure: mergeBpByMs(current.bloodPressure, [entry]),
      }));
      setOpen(false);
      reset();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between px-3.5 py-3">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400">Blood pressure</div>
          <div className="text-[13px] font-semibold text-slate-900">Log a reading or note</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg ${open ? 'bg-slate-100 text-slate-900' : 'bg-blue-600 text-white'}`}
        >
          {open ? 'Cancel' : '+ Log entry'}
        </button>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 flex flex-col gap-2.5 border-t border-black/[.06] pt-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Date</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300"
              />
            </div>
            <div className="w-[110px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Time</div>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Systolic</div>
              <input
                type="number"
                step={1}
                min={0}
                placeholder="optional"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300"
              />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Diastolic</div>
              <input
                type="number"
                step={1}
                min={0}
                placeholder="optional"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300"
              />
            </div>
          </div>
          {!bothOrNeither && <div className="text-[11px] text-red-500 -mt-1.5">Enter both systolic and diastolic, or leave both blank.</div>}

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Note (optional)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Stopped taking BP meds today"
              rows={2}
              className="w-full text-base px-2.5 py-2 rounded-[10px] border border-slate-300 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={addEntry}
            disabled={!canSave || gistWrite.isPending}
            className="text-base font-semibold px-4 py-2 rounded-[10px] bg-green-600 text-white disabled:bg-slate-200 disabled:text-slate-400 self-start"
          >
            {gistWrite.isPending ? 'Saving…' : 'Add'}
          </button>

          {error && <div className="text-[11px] text-red-500">{error}</div>}
        </div>
      )}
    </Card>
  );
}

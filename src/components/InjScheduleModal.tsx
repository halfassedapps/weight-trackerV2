// Ported from V1's InjScheduleModal (index.html:8695-8896).
import { useState } from 'react';
import { isIntervalSchedule, isWeekdaySchedule } from '../lib/gist/guards';
import type { Ampm, InjSchedule, WeekdaySchedule, WeekdayScheduleEntry } from '../lib/gist/types';

const SCHED_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const SCHED_DAYS_LNG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface InjScheduleModalProps {
  schedule: InjSchedule;
  isAdmin: boolean;
  onSave: (next: InjSchedule) => Promise<boolean>;
  onClose: () => void;
}

export function InjScheduleModal({ schedule, isAdmin, onSave, onClose }: InjScheduleModalProps) {
  const [mode, setMode] = useState<'days' | 'interval'>(() => (isIntervalSchedule(schedule) ? 'interval' : 'days'));
  const [draft, setDraft] = useState<WeekdaySchedule>(() =>
    isWeekdaySchedule(schedule) ? [...schedule].sort((a, b) => a.day - b.day) : [],
  );
  const [everyN, setEveryN] = useState(() => (isIntervalSchedule(schedule) ? schedule.everyNDays : 2));
  const [intervalAmpm, setIntervalAmpm] = useState<Ampm>(() => (isIntervalSchedule(schedule) ? schedule.ampm : 'am'));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const setModeIfAdmin = (m: 'days' | 'interval') => {
    if (isAdmin) setMode(m);
  };
  const toggleDay = (i: number) => {
    if (!isAdmin) return;
    const has = draft.find((s) => s.day === i);
    setDraft(has ? draft.filter((s) => s.day !== i) : [...draft, { day: i, ampm: 'am' as Ampm }].sort((a, b) => a.day - b.day));
  };
  const toggleAmPm = (i: number) => {
    if (!isAdmin) return;
    setDraft(draft.map((s) => (s.day === i ? { ...s, ampm: s.ampm === 'am' ? 'pm' : 'am' } : s)));
  };
  const toggleIntervalAmpm = () => {
    if (!isAdmin) return;
    setIntervalAmpm((v) => (v === 'am' ? 'pm' : 'am'));
  };
  const handleEveryN = (v: string) => {
    const n = Math.max(1, Math.min(28, parseInt(v, 10) || 1));
    setEveryN(n);
  };

  const sorted: WeekdayScheduleEntry[] = [...draft].sort((a, b) => a.day - b.day);
  const changed =
    mode === 'days'
      ? JSON.stringify(sorted) !== JSON.stringify(isWeekdaySchedule(schedule) ? [...schedule].sort((a, b) => a.day - b.day) : [])
      : !isIntervalSchedule(schedule) || schedule.everyNDays !== everyN || schedule.ampm !== intervalAmpm;

  const handleSave = async () => {
    const next: InjSchedule = mode === 'days' ? sorted : { mode: 'interval', everyNDays: everyN, ampm: intervalAmpm };
    setSaving(true);
    setSaveError('');
    try {
      const ok = await onSave(next);
      if (ok) {
        onClose();
        return;
      }
      setSaveError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/45 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[22px] px-5 pt-[22px] pb-6 w-full max-w-[380px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <div className="text-lg font-bold text-slate-900">Injection Schedule</div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-lg"
          >
            ✕
          </button>
        </div>

        {isAdmin && (
          <div className="flex gap-1 mb-4 bg-slate-100 rounded-[10px] p-[3px]">
            {(
              [
                ['days', 'Specific days'],
                ['interval', 'Every N days'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeIfAdmin(m)}
                className={`flex-1 py-1.5 rounded-lg text-[12.5px] font-semibold ${
                  mode === m ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'days' ? (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Injection days</div>
            <div className="flex gap-1 mb-4">
              {SCHED_DAYS.map((d, i) => {
                const sel = !!draft.find((s) => s.day === i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex-1 py-2 rounded-[10px] text-[13px] font-semibold ${sel ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {sorted.length > 0 ? (
              <div className="flex gap-2 flex-wrap mb-5">
                {sorted.map((s) => (
                  <div key={s.day} className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-slate-700">{SCHED_DAYS_LNG[s.day]}</span>
                    <button
                      type="button"
                      onClick={() => toggleAmPm(s.day)}
                      className="text-xs font-semibold px-3 py-1 rounded-[10px] bg-slate-100 text-slate-700"
                    >
                      {s.ampm === 'am' ? 'Morning' : 'Evening'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-slate-300 mb-5">{isAdmin ? 'Tap days above to set your injection days.' : 'No schedule configured.'}</div>
            )}
          </>
        ) : (
          <>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Interval</div>
            {isAdmin ? (
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[13px] text-slate-700">Every</span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={everyN}
                  onChange={(e) => handleEveryN(e.target.value)}
                  className="w-[52px] text-sm font-semibold px-2 py-1.5 rounded-lg border border-slate-300 text-center"
                />
                <span className="text-[13px] text-slate-700">days</span>
                <button type="button" onClick={toggleIntervalAmpm} className="text-xs font-semibold px-3 py-1 rounded-[10px] bg-slate-100 text-slate-700 ml-1">
                  {intervalAmpm === 'am' ? 'Morning' : 'Evening'}
                </button>
              </div>
            ) : (
              <div className="text-[13px] text-slate-300 mb-5">
                Every {everyN} days · {intervalAmpm === 'am' ? 'Morning' : 'Evening'}
              </div>
            )}
          </>
        )}

        {!isAdmin && <div className="text-xs text-slate-300 mb-4">Log in to edit the schedule.</div>}
        {saveError && <div className="text-[12.5px] text-red-500 mb-3">{saveError}</div>}

        <div className="flex gap-2">
          {isAdmin && changed && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-[15px] font-semibold py-3 rounded-xl bg-blue-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 text-[15px] font-semibold py-3 rounded-xl bg-slate-100 text-slate-700 disabled:opacity-60"
          >
            {isAdmin && changed ? 'Cancel' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

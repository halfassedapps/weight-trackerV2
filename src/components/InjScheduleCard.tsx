import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { useGistWrite } from '../hooks/useGistWrite';
import { isIntervalSchedule, isWeekdaySchedule } from '../lib/gist/guards';
import type { InjSchedule } from '../lib/gist/types';
import { InjScheduleModal } from './InjScheduleModal';

const SCHED_DAYS_LNG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function summarize(schedule: InjSchedule): string {
  if (isIntervalSchedule(schedule)) return `Every ${schedule.everyNDays} days · ${schedule.ampm === 'am' ? 'Morning' : 'Evening'}`;
  if (isWeekdaySchedule(schedule)) {
    return [...schedule]
      .sort((a, b) => a.day - b.day)
      .map((s) => `${SCHED_DAYS_LNG[s.day]} (${s.ampm === 'am' ? 'AM' : 'PM'})`)
      .join(', ');
  }
  return 'Not configured';
}

/** Small standalone trigger for InjScheduleModal — in V1 this lived inside
 * DosePanel (not yet ported); this card gives schedule editing a home on
 * its own until DosePanel exists. */
export function InjScheduleCard() {
  const { data: gist, isLoading, error } = useGistData();
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();
  const [open, setOpen] = useState(false);

  if (isLoading || error || !gist) return null;

  const saveSchedule = async (next: InjSchedule) => {
    try {
      await gistWrite.mutateAsync((current) => ({ ...current, injSchedule: next }));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden px-3.5 py-3 flex items-center justify-between gap-3">
      <div>
        <div className="text-[9px] uppercase tracking-wide text-slate-400">Injection Schedule</div>
        <div className="text-[13px] font-semibold text-slate-900">{summarize(gist.injSchedule)}</div>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-semibold text-blue-600 shrink-0">
        {isAdmin ? 'Edit' : 'View'}
      </button>
      {open && <InjScheduleModal schedule={gist.injSchedule} isAdmin={isAdmin} onSave={saveSchedule} onClose={() => setOpen(false)} />}
    </div>
  );
}

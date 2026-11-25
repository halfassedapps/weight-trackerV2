import type { DeltaEntry } from '../../../lib/domain/dayOfWeek';
import { WD_FULL } from '../../../lib/domain/dayOfWeek';

interface Props {
  dow: number;
  entries: DeltaEntry[];
  onClose: () => void;
}

export function DayOfWeekDetailModal({ dow, entries, onClose }: Props) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-[22px] bg-white pt-4 pb-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-3.5">
          <div>
            <div className="text-lg font-bold text-slate-900">{WD_FULL[dow]}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {sorted.length} weigh-in{sorted.length === 1 ? '' : 's'} · change vs. day before
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-3.5">
          <div className="sticky top-0 grid grid-cols-2 border-b border-black/[.08] bg-white py-1">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Date</div>
            <div className="text-right text-[10px] font-semibold uppercase text-slate-500">Change</div>
          </div>
          {sorted.map((e) => {
            const loss = e.delta < 0;
            const d = new Date(`${e.date}T12:00:00`);
            return (
              <div key={e.date} className="grid grid-cols-2 border-b border-black/5 py-2">
                <div className="text-sm text-slate-900">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div className={`text-right text-sm font-semibold ${loss ? 'text-green-700' : 'text-red-600'}`}>
                  {e.delta > 0 ? '+' : ''}
                  {e.delta.toFixed(2)} lbs
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

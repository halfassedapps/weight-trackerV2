// Ported from V1's IntervalsPanel (index.html:7962-7988) — admin-only
// visibility into when the watcher last synced intervals.icu ride data.
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';

function fmtSyncedAgo(iso: string | undefined) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function IntervalsSyncStatus() {
  const { isAdmin } = useAuth();
  const { data: gist } = useGistData();
  if (!isAdmin) return null;

  const syncedAt = gist?.intervalsActivities?.syncedAt;
  const connected = !!syncedAt;

  return (
    <div className={`rounded-xl px-4 py-3 bg-white border ${connected ? 'border-green-500/60' : 'border-slate-300'}`}>
      <div className="text-[15px] font-semibold text-slate-900">{connected ? 'intervals.icu synced' : 'intervals.icu not yet synced'}</div>
      <div className="text-xs text-slate-400 mt-0.5">
        {connected
          ? `Ride data powers the Activity tab · synced ${fmtSyncedAgo(syncedAt)}`
          : 'Ride sync runs from the local watcher — see watcher/weight_export_watcher.py for setup'}
      </div>
    </div>
  );
}

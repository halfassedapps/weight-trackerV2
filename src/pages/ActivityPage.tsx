import { RidesChart } from '../components/charts/RidesChart';
import { IntervalsSyncStatus } from '../components/IntervalsSyncStatus';

export function ActivityPage() {
  return (
    <div className="px-3 py-4 flex flex-col gap-2.5">
      <IntervalsSyncStatus />
      <RidesChart />
    </div>
  );
}

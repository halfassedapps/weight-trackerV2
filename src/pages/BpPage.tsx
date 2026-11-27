import { AddBpEntryCard } from '../components/AddBpEntryCard';
import { BpChart } from '../components/charts/BpChart';

export function BpPage() {
  return (
    <div className="px-3 py-4 flex flex-col gap-3">
      <BpChart />
      <AddBpEntryCard />
    </div>
  );
}

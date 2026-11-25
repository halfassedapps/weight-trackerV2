import { DoseChart } from '../components/charts/DoseChart';
import { PkChart } from '../components/charts/PkChart';
import { InjScheduleCard } from '../components/InjScheduleCard';

export function DosingPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 flex flex-col gap-4">
      <InjScheduleCard />
      <PkChart />
      <DoseChart />
    </div>
  );
}

import { DoseChart } from '../components/charts/DoseChart';
import { PkChart } from '../components/charts/PkChart';

export function DosingPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 flex flex-col gap-4">
      <PkChart />
      <DoseChart />
    </div>
  );
}

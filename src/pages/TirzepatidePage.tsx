import { PkChart } from '../components/charts/PkChart';
import { InjScheduleCard } from '../components/InjScheduleCard';

// Matches V1's dedicated "Tirzepatide" tab (index.html:10231-10247) — the
// drug-on-board curve plus schedule editing, kept separate from the Dosing
// tab's dose-recommendation flow, same split V1 uses.
export function TirzepatidePage() {
  return (
    <div className="px-3 py-4 flex flex-col gap-2.5">
      <InjScheduleCard />
      <PkChart />
    </div>
  );
}

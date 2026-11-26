import { DoseChart } from '../components/charts/DoseChart';
import { PkChart } from '../components/charts/PkChart';
import { AddInjectionCard } from '../components/AddInjectionCard';
import { DoseRecommendationCard } from '../components/DoseRecommendationCard';
import { InjScheduleCard } from '../components/InjScheduleCard';
import { InjectionLogCard } from '../components/InjectionLogCard';

export function DosingPage() {
  return (
    <div className="px-3 py-4 flex flex-col gap-2.5">
      <AddInjectionCard />
      <DoseRecommendationCard />
      <InjScheduleCard />
      <PkChart />
      <DoseChart />
      <InjectionLogCard />
    </div>
  );
}

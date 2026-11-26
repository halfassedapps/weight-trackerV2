import { DoseChart } from '../components/charts/DoseChart';
import { AddInjectionCard } from '../components/AddInjectionCard';
import { DoseRecommendationCard } from '../components/DoseRecommendationCard';
import { InjectionLogCard } from '../components/InjectionLogCard';

export function DosingPage() {
  return (
    <div className="px-3 py-4 flex flex-col gap-2.5">
      <AddInjectionCard />
      <DoseRecommendationCard />
      <DoseChart />
      <InjectionLogCard />
    </div>
  );
}

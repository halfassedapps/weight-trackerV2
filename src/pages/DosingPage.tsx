import { AddInjectionCard } from '../components/AddInjectionCard';
import { DoseRecommendationCard } from '../components/DoseRecommendationCard';
import { InjectionsSection } from '../components/InjectionsSection';

export function DosingPage() {
  return (
    <div className="px-3 py-4 flex flex-col gap-2.5">
      <AddInjectionCard />
      <DoseRecommendationCard collapsible={{ storageKey: 'weight-tracker-v2:doseCard:open:dosing', defaultOpen: true }} />
      <InjectionsSection />
    </div>
  );
}

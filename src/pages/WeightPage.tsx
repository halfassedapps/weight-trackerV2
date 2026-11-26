import { WeightChart } from '../components/charts/WeightChart';
import { DailyWeightChart } from '../components/charts/DailyWeightChart';
import { DoseWeightLossChart } from '../components/charts/DoseWeightLossChart';
import { CsvImportCard } from '../components/CsvImportCard';
import { GoalMilestoneBanner } from '../components/GoalMilestoneBanner';
import { MaintenanceHistoryCard } from '../components/MaintenanceHistoryCard';
import { WeightLogbookCard } from '../components/WeightLogbookCard';
import { useAuth } from '../hooks/useAuth';

export function WeightPage() {
  const { isAdmin } = useAuth();
  return (
    <div className="px-3 py-4 flex flex-col gap-2.5">
      {isAdmin && <CsvImportCard />}
      <GoalMilestoneBanner />
      <WeightChart />
      <MaintenanceHistoryCard />
      <DoseWeightLossChart />
      <DailyWeightChart />
      <WeightLogbookCard />
    </div>
  );
}

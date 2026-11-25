import { WeightChart } from '../components/charts/WeightChart';
import { DailyWeightChart } from '../components/charts/DailyWeightChart';
import { DoseWeightLossChart } from '../components/charts/DoseWeightLossChart';
import { CsvImportCard } from '../components/CsvImportCard';
import { useAuth } from '../hooks/useAuth';

export function WeightPage() {
  const { isAdmin } = useAuth();
  return (
    <div className="mx-auto max-w-lg px-4 py-6 flex flex-col gap-4">
      {isAdmin && <CsvImportCard />}
      <WeightChart />
      <DailyWeightChart />
      <DoseWeightLossChart />
    </div>
  );
}

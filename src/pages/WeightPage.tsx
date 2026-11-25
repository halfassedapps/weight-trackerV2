import { WeightChart } from '../components/charts/WeightChart';
import { DailyWeightChart } from '../components/charts/DailyWeightChart';

export function WeightPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 flex flex-col gap-4">
      <WeightChart />
      <DailyWeightChart />
    </div>
  );
}

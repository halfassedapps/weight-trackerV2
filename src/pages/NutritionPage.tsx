import { Card } from '../components/Card';
import { RangePickerSelect } from '../components/charts/shared/RangePickerSelect';
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { useGistWrite } from '../hooks/useGistWrite';
import { useRangePicker } from '../hooks/useRangePicker';
import { CaloriesVsTargetChart } from '../components/charts/NutritionCharts/CaloriesVsTargetChart';
import { ProteinChart } from '../components/charts/NutritionCharts/ProteinChart';
import { TdeeChart } from '../components/charts/NutritionCharts/TdeeChart';
import { useNutritionWindow } from '../components/charts/NutritionCharts/useNutritionWindow';
import { msToLocalDate } from '../lib/domain/csv';
import { upsertDatedTarget } from '../lib/domain/tdee';
import { computeLogbook } from '../lib/domain/weightSeries';

/**
 * Replaces V1's CaloriesActivitySection (index.html:1551-1679) — one shared
 * range picker + visible window feeding all three nutrition cards, so they
 * always show the same date range together.
 */
export function NutritionPage() {
  const { data: gist, isLoading, error } = useGistData();
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();
  const range = useRangePicker('nutrition', 30);
  const win = useNutritionWindow(gist, range);

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist) return null;

  // Shared by saveCalorieTarget/saveProteinTarget below — both set today's
  // dated target, deduped by date, same convention every dated-history field
  // in this app uses.
  const saveDatedTarget = async (field: 'calorieTargets' | 'proteinTargets', n: number): Promise<boolean> => {
    const todayStr = msToLocalDate(Date.now());
    try {
      await gistWrite.mutateAsync((current) => ({ ...current, [field]: upsertDatedTarget(current[field], todayStr, n) }));
      return true;
    } catch {
      return false;
    }
  };
  const saveCalorieTarget = (n: number) => saveDatedTarget('calorieTargets', n);
  const saveProteinTarget = (n: number) => saveDatedTarget('proteinTargets', n);

  return (
    <div className="px-3 py-4 flex flex-col gap-2.5">
      <Card>
        <div className="flex items-center gap-2 px-3 pt-2 pb-2 flex-wrap">
          <RangePickerSelect range={range} />
        </div>
      </Card>

      {!win ? (
        <p className="p-6 text-center text-sm text-slate-400">No calorie data in this range.</p>
      ) : (
        <>
          <Card title="Calories: Intake vs Burn">
            <TdeeChart
              periodDaily={win.periodDaily}
              visStartMs={win.visStartMs}
              visEndMs={win.visEndMs}
              calorieTargets={gist.calorieTargets}
              isAdmin={isAdmin}
              onSaveCalorieTarget={saveCalorieTarget}
              maintenanceHistory={gist.maintenanceHistory}
            />
          </Card>

          <Card title="Calories vs Target">
            <CaloriesVsTargetChart
              periodDaily={win.periodDaily}
              visStartMs={win.visStartMs}
              visEndMs={win.visEndMs}
              todayMs={win.todayMs}
              logbookRows={computeLogbook(gist.entries)}
              calorieTargets={gist.calorieTargets}
              intervalsCalories={gist.intervalsActivities?.calMap}
              maintenanceHistory={gist.maintenanceHistory}
            />
          </Card>

          <Card title="Protein">
            <ProteinChart
              periodDaily={win.periodDaily}
              visStartMs={win.visStartMs}
              visEndMs={win.visEndMs}
              proteinTargets={gist.proteinTargets}
              isAdmin={isAdmin}
              onSaveProteinTarget={saveProteinTarget}
              maintenanceHistory={gist.maintenanceHistory}
            />
          </Card>
        </>
      )}
    </div>
  );
}

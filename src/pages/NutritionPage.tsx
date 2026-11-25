import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { useGistWrite } from '../hooks/useGistWrite';
import { useRangePicker } from '../hooks/useRangePicker';
import { CaloriesVsTargetChart } from '../components/charts/NutritionCharts/CaloriesVsTargetChart';
import { ProteinChart } from '../components/charts/NutritionCharts/ProteinChart';
import { TdeeChart } from '../components/charts/NutritionCharts/TdeeChart';
import { useNutritionWindow } from '../components/charts/NutritionCharts/useNutritionWindow';
import { DATA_RANGE_OPTIONS } from '../lib/domain/ranges';
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

  const saveCalorieTarget = async (n: number) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    try {
      await gistWrite.mutateAsync((current) => ({
        ...current,
        calorieTargets: [...current.calorieTargets.filter((t) => t.date !== todayStr), { date: todayStr, target: n }].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      }));
      return true;
    } catch {
      return false;
    }
  };

  const saveProteinTarget = async (n: number) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    try {
      await gistWrite.mutateAsync((current) => ({
        ...current,
        proteinTargets: [...current.proteinTargets.filter((t) => t.date !== todayStr), { date: todayStr, target: n }].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      }));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6 flex flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-2 pb-2">
          <select
            value={range.days}
            onChange={(e) => range.setDays(Number(e.target.value))}
            className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {DATA_RANGE_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-3.5 pt-2.5 pb-1.5 border-b border-black/[.06]">
        <div className="text-[13px] font-bold text-slate-900">{title}</div>
      </div>
      {children}
    </div>
  );
}

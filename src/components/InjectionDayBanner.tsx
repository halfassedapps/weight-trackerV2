// Ported from V1 (index.html:9051-9176) — a dismissible banner that appears
// on a scheduled injection day, before today's dose is logged, showing the
// syringe draw-up amount and a one-tap symptom survey. V2 had no equivalent
// at all; closing this gap also means getRecommendation finally receives a
// live pendingSurvey instead of the hardcoded null both callers used before.
import { useState } from 'react';
import { SurveySlider } from './SurveySlider';
import { SyringeGraphic } from './SyringeGraphic';
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { usePendingSurvey } from '../hooks/usePendingSurvey';
import {
  DOSE_HOLD_EXPIRE_DAYS,
  DOSE_MAINTENANCE_HOLD_DAYS,
  daysSinceLastDoseChange,
  getDoseSchedule,
  getRecommendation,
  maintenanceDoseGuidance,
} from '../lib/domain/dosing';
import { deriveMaintenanceState } from '../lib/domain/maintenance';
import { msToLocalDate } from '../lib/domain/csv';
import { computeLogbook } from '../lib/domain/weightSeries';
import { safeGetJSON, safeSetItem } from '../lib/storage';

// Must match DoseRecommendationCard's own key — both read/write the same
// hold independently (same as V1's InjectionDayBanner/DosePanel split),
// not through a shared hook, since only DoseRecommendationCard ever sets it.
const LS_DOSE_HOLD_KEY = 'weight-tracker-v2:doseHold';
const LS_POPOVER_DISMISS_KEY = 'weight-tracker-v2:injDayBannerDismiss';

interface DoseHold {
  doseMg: number;
  at: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function InjectionDayBanner() {
  const { data: gist } = useGistData();
  const { isAdmin } = useAuth();
  const { pendingSurvey, savePendingSurvey } = usePendingSurvey();
  const [dismissedDate, setDismissedDate] = useState(() => localStorage.getItem(LS_POPOVER_DISMISS_KEY));
  const [surveyOpen, setSurveyOpen] = useState(false);

  const todayStr = msToLocalDate(Date.now());
  const hasPendingToday = !!pendingSurvey && pendingSurvey.date === todayStr;
  const [surveyNausea, setSurveyNausea] = useState(hasPendingToday && pendingSurvey.nausea != null ? String(pendingSurvey.nausea) : '0');
  const [surveyHunger, setSurveyHunger] = useState(hasPendingToday && pendingSurvey.hunger != null ? String(pendingSurvey.hunger) : '0');
  const [surveyFoodNoise, setSurveyFoodNoise] = useState(hasPendingToday && pendingSurvey.foodNoise != null ? String(pendingSurvey.foodNoise) : '0');

  if (!isAdmin || !gist) return null;

  const ds = getDoseSchedule(gist.injections, gist.injSchedule, false);
  if (!ds || !ds.scheduleActive) return null;

  const isToday = msToLocalDate(ds.nextInjMs) === todayStr;
  const alreadyLogged = gist.injections.some((i) => i.date === todayStr);
  if (!isToday || alreadyLogged || dismissedDate === todayStr) return null;

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const rows = computeLogbook(gist.entries);
  const rec = getRecommendation(rows, ds, gist.calories, gist.calorieTargets, gist.intervalsActivities?.calMap, todayMs, pendingSurvey);
  if (!rec) return null;
  const { g, perInjMg } = rec;
  const currentPerInjMg = ds.lastDose;

  const doseHold = safeGetJSON<DoseHold>(LS_DOSE_HOLD_KEY);
  const doseHoldExpired = !!doseHold && todayMs - doseHold.at >= DOSE_HOLD_EXPIRE_DAYS * 86400000;
  const doseHoldActive = g.action === 'increase' && !!doseHold && !doseHoldExpired && doseHold.doseMg === ds.lastDose;

  const { maintenanceMode, maintenanceSince } = deriveMaintenanceState(gist.maintenanceHistory, todayMs);
  const maintTwoWeekLoss = rows.find((r) => r.twoWeekLoss != null)?.twoWeekLoss ?? null;
  const maintDaysSinceChange = maintenanceMode ? daysSinceLastDoseChange(gist.injections, todayMs) : null;
  const maintDaysSinceStart =
    maintenanceMode && maintenanceSince ? Math.floor((new Date().setHours(12, 0, 0, 0) - new Date(`${maintenanceSince}T12:00:00`).getTime()) / 86400000) : null;
  const maintGuidance = maintenanceMode
    ? maintenanceDoseGuidance(
        maintTwoWeekLoss,
        ds.weeklyDose,
        maintDaysSinceChange != null && maintDaysSinceChange < DOSE_MAINTENANCE_HOLD_DAYS,
        maintDaysSinceChange,
        maintDaysSinceStart,
        gist.maintenanceDriftLbs,
      )
    : null;

  const displayG = maintenanceMode && maintGuidance ? maintGuidance : doseHoldActive ? { action: 'stay' as const, label: 'Holding at your dose', color: '#34c759', bg: '#f0fdf4' } : g;
  const displayPerInjMg =
    maintenanceMode && maintGuidance ? (maintGuidance.suggestedDoseMg ?? ds.weeklyDose) / ds.injPerWeek : doseHoldActive ? currentPerInjMg : perInjMg;
  const changing = round2(displayPerInjMg) !== round2(currentPerInjMg);

  const dismiss = () => {
    safeSetItem(LS_POPOVER_DISMISS_KEY, todayStr);
    setDismissedDate(todayStr);
  };

  const saveSurvey = () => {
    savePendingSurvey(todayStr, { nausea: Number(surveyNausea), hunger: Number(surveyHunger), foodNoise: Number(surveyFoodNoise) });
    setSurveyOpen(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden relative border" style={{ background: displayG.bg, borderColor: `${displayG.color}33` }}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs bg-black/[.08] text-slate-400"
      >
        ✕
      </button>
      <div className="px-4 pr-10 py-3.5 flex items-center gap-4">
        <div className="w-[140px] shrink-0">
          <SyringeGraphic doseMg={displayPerInjMg} color={displayG.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: displayG.color }}>
            Today is injection day
          </div>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-xl font-extrabold text-slate-900">{round2(displayPerInjMg)} mg</span>
            {changing && <span className="text-xs text-slate-400">(was {round2(currentPerInjMg)} mg)</span>}
          </div>
          <div className="text-[12.5px] font-semibold" style={{ color: displayG.color }}>
            {displayG.label}
          </div>
          <button
            type="button"
            onClick={() => setSurveyOpen((v) => !v)}
            className="text-[11.5px] font-semibold mt-1 underline opacity-85"
            style={{ color: displayG.color }}
          >
            {surveyOpen ? 'Cancel' : hasPendingToday ? '✓ Update how you’re feeling' : 'Log how you’re feeling'}
          </button>
        </div>
      </div>
      {surveyOpen && (
        <div className="px-4 pb-3.5">
          <div className="p-2.5 rounded-xl bg-white/55 flex flex-col gap-2.5">
            <div className="text-[11px] text-slate-400 -mt-0.5">Symptoms since last injection</div>
            <SurveySlider label="Nausea" value={surveyNausea} onChange={setSurveyNausea} />
            <SurveySlider label="Hunger" value={surveyHunger} onChange={setSurveyHunger} />
            <SurveySlider label="Food noise" value={surveyFoodNoise} onChange={setSurveyFoodNoise} />
            <button type="button" onClick={saveSurvey} className="text-[13px] font-semibold py-1.5 rounded-lg text-white" style={{ background: displayG.color }}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

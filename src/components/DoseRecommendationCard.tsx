// Ported from V1's DosePanel (index.html:3841-4337) — the trend-based dose
// recommendation box, its Maintenance Mode counterpart, the persistent-GI-
// intolerance warning, and the calorie-suggestion alternative. Scope note:
// the vial/syringe draw-up calculator (SyringeGraphic/DoseCalculatorModal),
// the TDEE-calculator popover (TdeeCalculatorModal/BMR profile), and the
// injection-day survey-prompt banner (InjectionDayBanner) are deferred —
// all three are secondary conveniences layered on top of this core
// guidance, not the guidance itself. Manually overriding a calorie target
// (if "Accept" isn't the number you want) is already possible from the
// Nutrition tab's own Edit controls.
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { useGistWrite } from '../hooks/useGistWrite';
import {
  DOSE_HOLD_EXPIRE_DAYS,
  DOSE_INCREASE_HOLD_DAYS,
  DOSE_MAINTENANCE_HOLD_DAYS,
  daysSinceLastDoseChange,
  getDoseSchedule,
  getRecommendation,
  maintenanceCalorieSuggestion,
  maintenanceDoseGuidance,
  stickyMeasuredTdee,
} from '../lib/domain/dosing';
import { deriveMaintenanceState } from '../lib/domain/maintenance';
import { GI_NAUSEA_BAD, GI_TOLERANCE_WINDOW_DAYS, targetActiveAt } from '../lib/domain/tdee';
import { computeLogbook } from '../lib/domain/weightSeries';

const SCHED_DAYS_LNG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOSE_STEP_MG = 0.5;
const LOSS_PHASE_CAL_STEP = 100;

const LS_DOSE_HOLD_KEY = 'weight-tracker-v2:doseHold';
const LS_STICKY_TDEE_KEY = 'weight-tracker-v2:stickyMeasuredTdee';

interface DoseHold {
  doseMg: number;
  at: number;
}

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage can throw in private-browsing contexts */
  }
}

export function DoseRecommendationCard() {
  const { data: gist, isLoading, error } = useGistData();
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();

  const [doseHold, setDoseHold] = useState<DoseHold | null>(() => loadJSON(LS_DOSE_HOLD_KEY));
  const [rulesOpen, setRulesOpen] = useState(false);
  const [stickyTdee, setStickyTdee] = useState<number | null>(() => loadJSON(LS_STICKY_TDEE_KEY));
  const [calEditing, setCalEditing] = useState(false);
  const [calDraft, setCalDraft] = useState('');
  const [calSaving, setCalSaving] = useState(false);
  const [calErr, setCalErr] = useState('');

  const holdAtDose = (doseMg: number) => {
    const next = { doseMg, at: new Date().setHours(0, 0, 0, 0) };
    setDoseHold(next);
    saveJSON(LS_DOSE_HOLD_KEY, next);
  };
  const clearDoseHold = () => {
    setDoseHold(null);
    saveJSON(LS_DOSE_HOLD_KEY, null);
  };

  // Proactively clear an expired hold so a later visit starts clean.
  useEffect(() => {
    if (doseHold && new Date().setHours(0, 0, 0, 0) - doseHold.at >= DOSE_HOLD_EXPIRE_DAYS * 86400000) clearDoseHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doseHold]);

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const rawMeasuredTdee = gist ? maintenanceCalorieSuggestion(gist.calories, gist.intervalsActivities?.calMap, todayMs) : null;
  useEffect(() => {
    if (!gist) return;
    const next = stickyMeasuredTdee(rawMeasuredTdee, stickyTdee);
    if (next !== stickyTdee) {
      setStickyTdee(next);
      saveJSON(LS_STICKY_TDEE_KEY, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMeasuredTdee]);

  if (isLoading) return <p className="p-6 text-center text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="p-6 text-center text-sm text-red-600">Failed to load: {(error as Error).message}</p>;
  if (!gist || !gist.injections.length) return null;

  const ds = getDoseSchedule(gist.injections, gist.injSchedule, false);
  if (!ds) return null;
  const rows = computeLogbook(gist.entries);
  const recent = rows.find((r) => r.twoWeekLoss != null);
  if (!recent) return null;

  const rec = getRecommendation(rows, ds, gist.calories, gist.calorieTargets, gist.intervalsActivities?.calMap, todayMs, null);
  if (!rec) return null;

  const { g, dose, recWeekly, perInjMg, gi, crossCheck } = rec;
  const { lastInj, intervalActive, injPerWeek, weeklyDose, nextInjMs } = ds;
  const lossSign = recent.twoWeekLoss! >= 0 ? '↓' : '↑';
  const nextInjDate = new Date(nextInjMs);
  const nextInjLabel = `${SCHED_DAYS_LNG[nextInjDate.getDay()]} ${nextInjDate.getHours() < 12 ? 'AM' : 'PM'}`;

  const subtext = g.recentlyIncreased
    ? `Your dose was increased recently — the 2-week trend hasn't had time to reflect it yet, so this holds (reassessing ${DOSE_INCREASE_HOLD_DAYS} days after the increase).`
    : g.giOverride
      ? gi && gi.avgNausea >= GI_NAUSEA_BAD
        ? `You're averaging ${gi.avgNausea.toFixed(1)}/10 nausea over the last ${GI_TOLERANCE_WINDOW_DAYS} days — GI tolerability appears to be the limiting factor, so this holds rather than increasing. Confirm with your prescriber.`
        : `Today's nausea (${gi?.latestNausea}/10) is severe enough on its own to hold this week, even though your recent average is milder. Confirm with your prescriber.`
      : g.overridden
        ? `You're averaging ${Math.round(Math.abs(rec.appetite!.avgDeviation))} cal/day under your exercise-adjusted target over the last ${rec.appetite!.days} days — appetite appears well-suppressed at the current dose, so this holds rather than increasing. Confirm with your prescriber.`
        : g.crossCheckBypassed
          ? `You're averaging ${Math.round(Math.abs(rec.appetite!.avgDeviation))} cal/day under target, but still reporting real hunger/food noise — that deficit may be coming from effort rather than suppressed appetite, so this increases rather than holding.`
          : g.action === 'increase'
            ? recent.twoWeekLoss! < 0
              ? `Weight trending up — increase by ${DOSE_STEP_MG} mg`
              : `Progress below 3 lbs/2wk — increase by ${DOSE_STEP_MG} mg`
            : g.action === 'stay'
              ? 'Weight loss on track — hold current dose'
              : g.action === 'monitor'
                ? 'Strong loss — stay put; drop down if >5 lbs next 2 wks too'
                : 'Unusually rapid loss — consult your prescriber';

  // Only an "increase" can be held. Keyed to ds.lastDose, not just "is there
  // a hold at all", so a hold declared at one dose doesn't keep silently
  // applying after a real injection changes it.
  const doseHoldAgeDays = doseHold ? Math.floor((todayMs - doseHold.at) / 86400000) : null;
  const doseHoldExpired = doseHoldAgeDays != null && doseHoldAgeDays >= DOSE_HOLD_EXPIRE_DAYS;
  const doseHoldActive = g.action === 'increase' && !!doseHold && !doseHoldExpired && doseHold.doseMg === ds.lastDose;
  const doseHoldDaysLeft = doseHoldActive ? DOSE_HOLD_EXPIRE_DAYS - doseHoldAgeDays! : null;

  const maint = deriveMaintenanceState(gist.maintenanceHistory, todayMs);
  const maintDaysSinceChange = maint.maintenanceMode ? daysSinceLastDoseChange(gist.injections, todayMs) : null;
  const maintDoseChangeHold = maintDaysSinceChange != null && maintDaysSinceChange < DOSE_MAINTENANCE_HOLD_DAYS;
  const maintDaysSinceStart = maint.maintenanceMode && maint.maintenanceSince ? Math.floor((todayMs - new Date(`${maint.maintenanceSince}T12:00:00`).getTime()) / 86400000) : null;
  const maintGuidance = maint.maintenanceMode
    ? maintenanceDoseGuidance(recent.twoWeekLoss, weeklyDose, maintDoseChangeHold, maintDaysSinceChange, maintDaysSinceStart, gist.maintenanceDriftLbs)
    : null;

  const todayStr = new Date().toLocaleDateString('en-CA');
  const maintCurrentCalTarget = maint.maintenanceMode ? targetActiveAt(gist.calorieTargets, todayStr) : null;
  const maintSuggestedCalTarget = maint.maintenanceMode ? stickyTdee : null;

  const lossCalDirection = g.action === 'increase' ? -1 : g.action === 'monitor' ? 1 : null;
  const lossCurrentCalTarget = targetActiveAt(gist.calorieTargets, todayStr);
  const lossSuggestedCalTarget =
    !maint.maintenanceMode && lossCalDirection != null && lossCurrentCalTarget != null ? lossCurrentCalTarget + lossCalDirection * LOSS_PHASE_CAL_STEP : null;

  const displayG = maint.maintenanceMode ? maintGuidance! : doseHoldActive ? { action: 'stay' as const, label: 'Holding at your dose', color: '#34c759', bg: '#f0fdf4', note: '' } : g;
  const displayRecWeekly = maint.maintenanceMode ? (maintGuidance!.suggestedDoseMg ?? weeklyDose) : doseHoldActive ? weeklyDose : recWeekly;
  const displayPerInjMg = maint.maintenanceMode ? displayRecWeekly / injPerWeek : doseHoldActive ? weeklyDose / injPerWeek : perInjMg;
  const displaySubtext = maint.maintenanceMode
    ? maintGuidance!.note
    : doseHoldActive
      ? `You chose to hold at ${Math.round(weeklyDose * 10) / 10} mg/wk on ${new Date(doseHold!.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} instead of increasing. This hold auto-expires in ${doseHoldDaysLeft} day${doseHoldDaysLeft === 1 ? '' : 's'}.`
      : subtext;

  const DOSING_RULES = [
    { range: '> 8 lbs / 2 wks', action: 'Contact prescriber', color: '#ff3b30' },
    { range: '> 5–8 lbs / 2 wks', action: `Stay — monitor closely; decrease dose by ${DOSE_STEP_MG} mg if it repeats next 2 wks`, color: '#ff9500' },
    { range: '3–5 lbs / 2 wks', action: 'Stay at current dose', color: '#34c759' },
    { range: '< 3 lbs / 2 wks', action: `Increase by ${DOSE_STEP_MG} mg (incl. weight gain)`, color: '#ff9500' },
  ];

  const saveCalorieTarget = async (n: number) => {
    setCalSaving(true);
    setCalErr('');
    try {
      await gistWrite.mutateAsync((current) => ({
        ...current,
        calorieTargets: [...current.calorieTargets.filter((t) => t.date !== todayStr), { date: todayStr, target: n }].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      setCalSaving(false);
      setCalEditing(false);
    } catch {
      setCalSaving(false);
      setCalErr("Couldn't save — try again.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1.5 relative">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
          {maint.maintenanceMode ? 'Maintenance Dose Guidance' : 'Next Dose Recommendation'}
        </div>
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          aria-label="Dosing increment rules"
          className={`w-3.5 h-3.5 rounded-full border border-slate-300 text-[9px] font-bold flex items-center justify-center ${rulesOpen ? 'bg-slate-400 text-white' : 'bg-white text-slate-400'}`}
        >
          i
        </button>
        {rulesOpen && (
          <div className="absolute top-[18px] left-0 z-20 w-[250px] bg-[#1c1c1e] text-white rounded-[10px] px-3 py-2.5 shadow-xl">
            <div className="text-xs font-bold mb-1.5">Dosing increment rules</div>
            <div className="flex flex-col gap-1.5">
              {DOSING_RULES.map((r) => (
                <div key={r.range} className="flex items-baseline gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ background: r.color }} />
                  <span className="text-[11.5px] leading-tight">
                    <span className="text-white font-semibold">{r.range}</span>
                    <span className="text-white/70"> — {r.action}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 rounded-[10px]" style={{ background: displayG.bg, border: `1px solid ${displayG.color}33` }}>
        <div className="flex items-center gap-3.5">
          <div className="text-center min-w-[72px]">
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: displayG.color }}>
              {displayG.action === 'increase' ? 'Increase to' : displayG.action === 'decrease' ? 'Decrease to' : displayG.action === 'contact' ? 'Hold at' : 'Stay at'}
            </div>
            <div className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: displayG.color }}>
              {maint.maintenanceMode ? Math.round(displayRecWeekly * 100) / 100 : Math.round(displayRecWeekly * 10) / 10} mg
            </div>
            <div className="text-[11px] mt-0.5 opacity-75" style={{ color: displayG.color }}>
              {intervalActive
                ? `${Math.round(displayPerInjMg * 100) / 100} mg every ${(gist.injSchedule as { everyNDays: number }).everyNDays}d`
                : injPerWeek > 1
                  ? `${Math.round(displayPerInjMg * 100) / 100} mg × ${injPerWeek}/wk`
                  : 'per week'}
            </div>
            {!maint.maintenanceMode && displayG.action === 'increase' && dose == null && <div className="text-[11px] text-slate-400 mt-0.5">max reached</div>}
          </div>
          <div className="w-px self-stretch" style={{ background: `${displayG.color}33` }} />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900 mb-1">{displayG.label}</div>
            <div className="text-[13px] text-slate-700 leading-snug">{displaySubtext}</div>
            <div className="text-xs text-slate-400 mt-1.5">
              2-wk loss: {lossSign}
              {Math.abs(recent.twoWeekLoss!).toFixed(1)} lbs &nbsp;·&nbsp; current: ≈{Math.round(weeklyDose * 10) / 10} mg/wk
              {intervalActive ? ` (${lastInj.doseMg} mg every ${(gist.injSchedule as { everyNDays: number }).everyNDays}d)` : injPerWeek > 1 ? ` (${lastInj.doseMg} mg × ${injPerWeek})` : ''}
            </div>
            <div className="text-xs text-slate-400 mt-1">Your next injection is planned for {nextInjLabel}.</div>
            {!maint.maintenanceMode && !doseHoldActive && (g.overridden || g.crossCheckBypassed) && crossCheck && (
              <div className="text-[11.5px] text-slate-400 mt-1.5 italic">
                {crossCheck.type === 'corroborated' ? '✓ ' : '⚠ '}
                {crossCheck.note}
              </div>
            )}
            {!maint.maintenanceMode && isAdmin && g.action === 'increase' && !doseHoldActive && (
              <button type="button" onClick={() => holdAtDose(ds.lastDose)} className="text-[11px] font-semibold text-blue-600 underline mt-1.5 block">
                Stay at {Math.round(weeklyDose * 10) / 10} mg instead →
              </button>
            )}
            {!maint.maintenanceMode && isAdmin && doseHoldActive && (
              <button type="button" onClick={clearDoseHold} className="text-[11px] font-semibold text-blue-600 underline mt-1.5 block">
                Reconsider — show increase guidance →
              </button>
            )}
          </div>
        </div>

        {maint.maintenanceMode && (
          <CalorieSuggestionRow
            label={displayG.action === 'decrease' || displayG.action === 'increase' ? 'Or adjust calories instead' : 'Calorie target'}
            suggested={maintSuggestedCalTarget}
            alreadySet={displayG.action !== 'decrease' && displayG.action !== 'increase' && maintCurrentCalTarget != null && maintCurrentCalTarget === maintSuggestedCalTarget}
            description="Your measured TDEE, less exercise — the base number that should hold weight on its own."
            isAdmin={isAdmin}
            calEditing={calEditing}
            calDraft={calDraft}
            calSaving={calSaving}
            calErr={calErr}
            setCalDraft={setCalDraft}
            setCalEditing={setCalEditing}
            setCalErr={setCalErr}
            onAccept={() => maintSuggestedCalTarget != null && saveCalorieTarget(maintSuggestedCalTarget)}
            onSave={() => saveCalorieTarget(parseFloat(calDraft))}
            borderColor={displayG.color}
          />
        )}

        {lossSuggestedCalTarget != null && (
          <CalorieSuggestionRow
            label="Or adjust calories instead"
            suggested={lossSuggestedCalTarget}
            alreadySet={false}
            description={`${LOSS_PHASE_CAL_STEP} cal/day ${lossCalDirection! < 0 ? 'less' : 'more'} than your current target — ${
              lossCalDirection! < 0 ? 'an alternative to increasing dose.' : 'an alternative to waiting out the next 2 weeks at this dose.'
            }`}
            isAdmin={isAdmin}
            calEditing={calEditing}
            calDraft={calDraft}
            calSaving={calSaving}
            calErr={calErr}
            setCalDraft={setCalDraft}
            setCalEditing={setCalEditing}
            setCalErr={setCalErr}
            onAccept={() => saveCalorieTarget(lossSuggestedCalTarget)}
            onSave={() => saveCalorieTarget(parseFloat(calDraft))}
            borderColor={displayG.color}
          />
        )}

        {gi?.persistent && (
          <div className="mt-2.5 p-2.5 rounded-[10px] bg-[#fff8ee] border border-[#ff950055]">
            <div className="text-[12.5px] font-semibold text-[#b8720a]">
              ⚠ Nausea ≥{GI_NAUSEA_BAD}/10 at your last two injections at {gi.persistentDoseMg} mg
            </div>
            <div className="text-[11.5px] text-slate-400 mt-0.5">Consider discussing stepping back down to your prior dose with your prescriber.</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CalorieSuggestionRowProps {
  label: string;
  suggested: number | null;
  alreadySet: boolean;
  description: string;
  isAdmin: boolean;
  calEditing: boolean;
  calDraft: string;
  calSaving: boolean;
  calErr: string;
  setCalDraft: (v: string) => void;
  setCalEditing: (v: boolean) => void;
  setCalErr: (v: string) => void;
  onAccept: () => void;
  onSave: () => void;
  borderColor: string;
}

function CalorieSuggestionRow({
  label,
  suggested,
  alreadySet,
  description,
  isAdmin,
  calEditing,
  calDraft,
  calSaving,
  calErr,
  setCalDraft,
  setCalEditing,
  setCalErr,
  onAccept,
  onSave,
  borderColor,
}: CalorieSuggestionRowProps) {
  return (
    <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${borderColor}33` }}>
      <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">{label}</div>
      <div className="flex items-center gap-3 p-2.5 rounded-[10px] bg-white border border-[rgba(74,144,217,.3)]">
        <div className="text-center min-w-[60px] shrink-0">
          <div className="text-lg font-extrabold leading-none text-blue-600 tabular-nums">{suggested ?? '—'}</div>
          <div className="text-[9.5px] text-blue-600 opacity-75">cal/day</div>
        </div>
        <div className="flex-1 min-w-0">
          {alreadySet ? (
            <div className="text-[12.5px] font-semibold text-slate-900 leading-snug">Automatically set to this.</div>
          ) : (
            <div className="text-[11px] text-slate-400">{description}</div>
          )}
          {suggested != null && alreadySet ? (
            <div className="text-[11px] font-semibold text-green-600 mt-1.5">✓ Already set to this</div>
          ) : (
            isAdmin &&
            suggested != null &&
            !calEditing && (
              <button type="button" onClick={onAccept} className="text-[11px] font-semibold text-blue-600 underline mt-1.5 block">
                Accept — set target to {suggested} →
              </button>
            )
          )}
          {isAdmin && calEditing && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                value={calDraft}
                onChange={(e) => setCalDraft(e.target.value)}
                className="w-[70px] text-xs px-1.5 py-1 rounded-md border border-slate-300"
              />
              <button type="button" onClick={onSave} disabled={calSaving} className="text-[11px] font-semibold text-blue-600">
                {calSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalEditing(false);
                  setCalErr('');
                }}
                className="text-[11px] text-slate-400"
              >
                Cancel
              </button>
            </div>
          )}
          {calErr && <div className="text-[11px] text-red-500 mt-1">{calErr}</div>}
        </div>
      </div>
    </div>
  );
}

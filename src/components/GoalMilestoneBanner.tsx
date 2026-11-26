// Ported from V1's GoalBanner (index.html:4747-5295) — the goal-reached
// milestone celebration (confetti, escalating tiers for continued loss
// beyond goal) and the Start/Stop Maintenance Mode toggle, which otherwise
// had no UI anywhere in V2 at all. Deliberately narrower than V1's version:
// the ongoing Maintenance Mode *trend guidance* text (settling-in /
// stay-at-dose messaging) isn't repeated here since it already lives on the
// Dosing tab's DoseRecommendationCard; this just covers what's unique to
// the Weight tab — the milestone celebration and the mode toggle itself.
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGistData } from '../hooks/useGistData';
import { useGistWrite } from '../hooks/useGistWrite';
import { msToLocalDate } from '../lib/domain/csv';
import { getDoseSchedule, maintenanceCalorieSuggestion } from '../lib/domain/dosing';
import { computeGoalStatus } from '../lib/domain/goal';
import { deriveMaintenanceState } from '../lib/domain/maintenance';
import { upsertDatedTarget } from '../lib/domain/tdee';
import { computeLogbook } from '../lib/domain/weightSeries';
import { safeGetJSON, safeSetJSON } from '../lib/storage';

const LS_DISMISS_KEY = 'weight-tracker-goal-banner-dismiss';
const LS_CELEBRATED_KEY = 'weight-tracker-goal-celebrated';

interface DismissState {
  goal: number;
  at: number;
}

const CONFETTI_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#5856d6', '#ff2d55', '#bf5af2'];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.4,
        duration: 2.2 + Math.random() * 1.4,
        rotate: 180 + Math.random() * 540,
        drift: Math.round((Math.random() - 0.5) * 120),
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 6,
      })),
    [],
  );
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[9999]">
      {pieces.map((p) => (
        <div
          key={p.id}
          style={
            {
              position: 'absolute',
              top: -24,
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: 1,
              animation: `confettiFall ${p.duration}s cubic-bezier(.35,0,.65,1) ${p.delay}s forwards`,
              '--drift': `${p.drift}px`,
              '--rot': `${p.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function GoalMilestoneBanner() {
  const { data: gist } = useGistData();
  const { isAdmin } = useAuth();
  const gistWrite = useGistWrite();
  const [dismissed, setDismissed] = useState<DismissState | null>(() => safeGetJSON<DismissState>(LS_DISMISS_KEY));
  const [celebrated, setCelebrated] = useState<DismissState | null>(() => safeGetJSON<DismissState>(LS_CELEBRATED_KEY));
  const [showConfetti, setShowConfetti] = useState(false);

  const todayMs = new Date().setHours(12, 0, 0, 0);
  const rows = gist ? computeLogbook(gist.entries) : [];
  const status = gist ? computeGoalStatus(rows, gist.goalLbs) : null;
  const { maintenanceMode, maintenanceSince } = deriveMaintenanceState(gist?.maintenanceHistory, todayMs);
  const ds = gist ? getDoseSchedule(gist.injections, gist.injSchedule, false) : null;
  const currentDoseMg = ds?.weeklyDose ?? null;
  const milestoneAt = status?.milestone?.at ?? null;

  useEffect(() => {
    if (milestoneAt == null || !gist) return;
    const isNew = !celebrated || celebrated.goal !== gist.goalLbs || celebrated.at < milestoneAt;
    if (!isNew) return;
    const next = { goal: gist.goalLbs, at: milestoneAt };
    safeSetJSON(LS_CELEBRATED_KEY, next);
    setCelebrated(next);
    setShowConfetti(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneAt, gist?.goalLbs]);

  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 3200);
    return () => clearTimeout(t);
  }, [showConfetti]);

  if (!gist || !status) return null;
  if (!maintenanceMode && !status.nearGoalToday) return null;

  const toggleMaintenanceMode = (action: 'start' | 'stop') => {
    if (currentDoseMg == null) return;
    const todayStr = msToLocalDate(Date.now());
    gistWrite.mutate((current) => {
      const nextHistory = [...current.maintenanceHistory, { date: todayStr, action, doseMg: currentDoseMg }];
      let nextTargets = current.calorieTargets;
      if (action === 'start') {
        const auto = maintenanceCalorieSuggestion(current.calories, current.intervalsActivities?.calMap, Date.now());
        if (auto != null) nextTargets = upsertDatedTarget(current.calorieTargets, todayStr, auto);
      }
      return { ...current, maintenanceHistory: nextHistory, calorieTargets: nextTargets };
    });
  };

  if (maintenanceMode) {
    return (
      <div className="rounded-2xl bg-blue-50 border border-blue-200/60 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold text-slate-900">
          <span className="text-[11px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded mr-1.5 uppercase tracking-wide">Maintenance</span>
          since {maintenanceSince}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => toggleMaintenanceMode('stop')}
            disabled={gistWrite.isPending || currentDoseMg == null}
            className="text-[12px] font-semibold text-slate-600 bg-white border border-slate-300 rounded-full px-3 py-1 disabled:opacity-50"
          >
            Stop Maintenance Mode
          </button>
        )}
      </div>
    );
  }

  if (!status.atGoal) {
    const avgBeyond = Math.round((status.windowAvg - gist.goalLbs) * 10) / 10;
    return (
      <div className="rounded-2xl bg-blue-50 border border-blue-200/60 px-4 py-3 flex items-center gap-2.5">
        <div className="text-xl leading-none shrink-0">🎯</div>
        <div className="text-[13px] font-semibold text-slate-900">
          {rows.slice(0, 14).length}-day avg is {status.windowAvg.toFixed(1)} lbs — {avgBeyond} lbs to go to lock in your goal!
        </div>
      </div>
    );
  }

  const milestone = status.milestone;
  if (!milestone) return null;
  const roundedBeyond = Math.round(status.beyond * 10) / 10;
  const tierSilenced = !!dismissed && dismissed.goal === gist.goalLbs && dismissed.at >= milestone.at;
  if (tierSilenced) return null;

  const silence = () => {
    const next = { goal: gist.goalLbs, at: milestone.at };
    safeSetJSON(LS_DISMISS_KEY, next);
    setDismissed(next);
  };

  return (
    <>
      {showConfetti && <ConfettiBurst />}
      <div
        className="rounded-2xl overflow-hidden relative text-center px-4.5 py-4"
        style={{ background: 'linear-gradient(135deg, #ffd60a, #ff9500)', boxShadow: '0 4px 14px rgba(255,149,0,.25)', animation: 'goalPop .5s cubic-bezier(.34,1.56,.64,1)' }}
      >
        <button
          type="button"
          onClick={silence}
          aria-label="Silence"
          className="absolute top-2.5 right-2.5 w-5.5 h-5.5 rounded-full flex items-center justify-center text-xs"
          style={{ background: 'rgba(28,28,30,.18)', color: 'rgba(28,28,30,.65)' }}
        >
          ✕
        </button>
        <div className="text-[32px] leading-none mb-1 pointer-events-none" style={{ animation: 'goalFloat 2.2s ease-in-out infinite' }}>
          {milestone.emoji}
        </div>
        <div className="text-lg font-extrabold text-slate-900">{milestone.at === 0 ? 'Goal Reached!' : `${roundedBeyond} lbs Past Goal!`}</div>
        <div className="text-[13px] font-semibold mt-0.5" style={{ color: 'rgba(28,28,30,.65)' }}>
          {milestone.tag} — {status.currentLbs.toFixed(1)} lbs now, goal was {gist.goalLbs}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => toggleMaintenanceMode('start')}
            disabled={gistWrite.isPending || currentDoseMg == null}
            className="mt-2.5 text-[12.5px] font-bold text-slate-900 rounded-full px-3.5 py-1.5 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,.4)', border: '1px solid rgba(28,28,30,.25)' }}
          >
            Start Maintenance Mode →
          </button>
        )}
      </div>
    </>
  );
}

// Ported from V1's GoalBanner milestone math (index.html:4697-4795).
import { avg } from './math';

export interface GoalMilestone {
  at: number;
  emoji: string;
  tag: string;
}

export const GOAL_MILESTONES: GoalMilestone[] = [
  { at: 25, emoji: '🏆', tag: 'Legendary' },
  { at: 20, emoji: '💎', tag: 'Phenomenal' },
  { at: 15, emoji: '🚀', tag: 'Incredible' },
  { at: 10, emoji: '🌟', tag: 'Amazing progress' },
  { at: 5, emoji: '🔥', tag: 'Still crushing it' },
  { at: 0, emoji: '🎉', tag: 'Goal reached' },
];

export const GOAL_AVG_WINDOW_DAYS = 14;
export const GOAL_BANNER_NOISE_TOLERANCE_LBS = 0.5;

export interface GoalStatus {
  currentLbs: number;
  windowAvg: number;
  /** lbs under goal; negative = not there yet */
  beyond: number;
  nearGoalToday: boolean;
  atGoal: boolean;
  milestone: GoalMilestone | null;
}

/** `rows` must be newest-first (computeLogbook's own order). */
export function computeGoalStatus(rows: { lbs: number }[], goalLbs: number): GoalStatus | null {
  if (!rows.length) return null;
  const currentLbs = rows[0].lbs;
  const beyond = goalLbs - currentLbs;
  const windowRows = rows.slice(0, GOAL_AVG_WINDOW_DAYS);
  const windowAvg = avg(windowRows.map((r) => r.lbs));
  const nearGoalToday = beyond >= -GOAL_BANNER_NOISE_TOLERANCE_LBS;
  const atGoal = nearGoalToday && windowAvg <= goalLbs;
  const milestone = atGoal ? (GOAL_MILESTONES.find((m) => Math.max(beyond, 0) >= m.at) ?? null) : null;
  return { currentLbs, windowAvg, beyond, nearGoalToday, atGoal, milestone };
}

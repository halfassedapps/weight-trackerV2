// A symptom survey saved from InjectionDayBanner before today's dose has
// actually been logged yet — folded into getRecommendation's GI/appetite
// signals as a synthetic same-day entry (see dosing.ts), same as V1's
// pendingSurvey state lifted to App. Shared (not owned by the banner alone)
// because DoseRecommendationCard's own recommendation needs to see it too.
import { useState } from 'react';
import type { PendingSurvey } from '../lib/domain/dosing';
import { safeGetJSON, safeSetJSON } from '../lib/storage';

const LS_PENDING_SURVEY_KEY = 'weight-tracker-v2:pendingSurvey';

export function usePendingSurvey() {
  const [pendingSurvey, setPendingSurvey] = useState<PendingSurvey | null>(() => safeGetJSON(LS_PENDING_SURVEY_KEY));

  const savePendingSurvey = (date: string, vals: { nausea: number; hunger: number; foodNoise: number }) => {
    const next: PendingSurvey = { date, ...vals };
    setPendingSurvey(next);
    safeSetJSON(LS_PENDING_SURVEY_KEY, next);
  };

  return { pendingSurvey, savePendingSurvey };
}

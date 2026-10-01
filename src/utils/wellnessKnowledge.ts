import { ActionFeedbackRecord, ActivityId, DailyActivityCheckIn, DailyStats, MonthlyStats } from '../types';

export interface VerifiedWellnessAction {
  id: string;
  triggers: ActivityId[];
  action: string;
  rationale: string;
}

export const VERIFIED_WELLNESS_ACTIONS: VerifiedWellnessAction[] = [
  { id: 'caffeine-cutoff', triggers: ['caffeine'], action: 'Move your final caffeinated drink to at least 8 hours before bedtime tomorrow.', rationale: 'Suggested because your check-in reported late caffeine.' },
  { id: 'screen-winddown', triggers: ['screen_time'], action: 'Dim screens and use audio-only content for the final 30 minutes before bedtime tonight.', rationale: 'Suggested because your check-in reported late screen use.' },
  { id: 'stress-reset', triggers: ['stress'], action: 'Write tomorrow’s first task on paper, then practice slow breathing for 5 minutes before bed.', rationale: 'Suggested because your check-in reported stress.' },
  { id: 'late-meal-buffer', triggers: ['late_meal'], action: 'Finish tomorrow’s final full meal at least 3 hours before bedtime.', rationale: 'Suggested because your check-in reported a late meal.' },
  { id: 'alcohol-buffer', triggers: ['alcohol'], action: 'Avoid alcohol during the final 4 hours before bedtime tonight and choose water instead.', rationale: 'Suggested because your check-in reported alcohol.' },
  { id: 'congestion-saline', triggers: ['congested'], action: 'Use plain saline 20 minutes before bed and keep the bedroom air comfortably humid tonight.', rationale: 'Suggested because your check-in reported congestion.' },
  { id: 'side-sleep', triggers: ['back_sleeper'], action: 'Begin tonight on your side and place a pillow behind your back to reduce rolling over.', rationale: 'Suggested because your check-in reported back sleeping.' },
  { id: 'schedule-anchor', triggers: ['irregular_schedule'], action: 'Choose one wake time for tomorrow and keep it within a 30-minute window for the next 3 days.', rationale: 'Suggested because your check-in reported an irregular schedule.' },
  { id: 'hydration-early', triggers: ['dehydrated'], action: 'Drink water steadily tomorrow, then reduce large drinks during the final hour before bed.', rationale: 'Suggested because your check-in reported dehydration.' },
  { id: 'exercise-downshift', triggers: ['exercise'], action: 'Keep vigorous exercise at least 2 hours before bedtime and use a 5-minute stretch afterward.', rationale: 'Suggested because exercise timing can affect your wind-down.' },
  { id: 'pillow-placement', triggers: [], action: 'Check that the Hagokiller pillow is centered under your neck before sleep tonight.', rationale: 'Suggested because pillow positioning supports consistent intervention response.' },
  { id: 'bedtime-anchor', triggers: [], action: 'Start a 30-minute wind-down at the same time tonight and keep the room cool and dim.', rationale: 'Suggested from your recorded sleep pattern.' },
];

export const actionKey = (action: string): string => action
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, '')
  .split(/\s+/)
  .filter((word) => word.length > 2)
  .slice(0, 12)
  .join('-');

const words = (action: string): Set<string> => new Set(actionKey(action).split('-').filter(Boolean));

export const actionsAreSimilar = (first: string, second: string): boolean => {
  const a = words(first);
  const b = words(second);
  if (a.size === 0 || b.size === 0) return false;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.min(a.size, b.size) >= 0.55;
};

export const selectVerifiedActions = (
  checkIn: DailyActivityCheckIn | null,
  feedback: ActionFeedbackRecord[],
  limit = 5,
): VerifiedWellnessAction[] => {
  const activities = checkIn?.activities ?? [];
  const negative = feedback.filter((item) => item.feedback !== 'helpful');
  const positive = feedback.filter((item) => item.feedback === 'helpful');
  return VERIFIED_WELLNESS_ACTIONS
    .filter((entry) => !negative.some((item) => actionsAreSimilar(entry.action, item.actionText)))
    .sort((a, b) => {
      const score = (entry: VerifiedWellnessAction) => (
        entry.triggers.some((trigger) => activities.includes(trigger)) ? 10 : 0
      ) + (positive.some((item) => actionsAreSimilar(entry.action, item.actionText)) ? 3 : 0);
      return score(b) - score(a);
    })
    .slice(0, limit);
};

const UNSAFE_PATTERN = /mouth\s*tap|(?:stop|skip|increase|decrease|change)\s+(?:your\s+)?(?:medicine|medication|dose|prescription)|\b(?:diagnose|cure|guarantee)\b/i;
const VAGUE_PATTERN = /^(?:improve sleep hygiene|be healthier|relax more|sleep better|adjust your habits)[.!]?$/i;
const TIMING_PATTERN = /\b(?:minutes?|hours?|before|after|tonight|tomorrow|bedtime|wake time|for the next|each night|at \d)/i;

export const qualityCheckActions = (actions: string[], safeFallbacks: string[]): string[] => {
  const accepted: string[] = [];
  for (const action of actions) {
    const clean = action.trim().replace(/\s+/g, ' ');
    if (clean.length < 20 || clean.length > 420 || UNSAFE_PATTERN.test(clean) || VAGUE_PATTERN.test(clean)) continue;
    if (!TIMING_PATTERN.test(clean)) continue;
    if (accepted.some((existing) => actionsAreSimilar(existing, clean))) continue;
    accepted.push(clean);
  }
  for (const fallback of safeFallbacks) {
    if (accepted.length >= 4) break;
    if (!accepted.some((existing) => actionsAreSimilar(existing, fallback))) accepted.push(fallback);
  }
  return accepted.slice(0, 4);
};

export const explainWellnessAction = (
  action: string,
  daily: DailyStats,
  monthly: MonthlyStats,
  checkIn: DailyActivityCheckIn | null,
  verified: VerifiedWellnessAction[],
): string => {
  const libraryMatch = verified.find((entry) => actionsAreSimilar(entry.action, action));
  if (libraryMatch) return libraryMatch.rationale;
  if (/pillow|side|position/i.test(action) && daily.interventionCount > 0) {
    return `Suggested because the pillow recorded ${daily.interventionCount} intervention${daily.interventionCount === 1 ? '' : 's'}.`;
  }
  if (checkIn?.otherActivityNote) return 'Suggested from the detail in your daily check-in.';
  if (daily.totalSnoreEvents > 0) return `Suggested because snoring peaked around ${daily.peakHour % 12 || 12}:00 ${daily.peakHour < 12 ? 'AM' : 'PM'}.`;
  return monthly.trend === 'improving'
    ? 'Suggested to help preserve the habits associated with your improving trend.'
    : 'Suggested from your current sleep pattern and recent trend.';
};

export const buildFeedbackMemory = (feedback: ActionFeedbackRecord[]) => ({
  helpfulActions: feedback.filter((item) => item.feedback === 'helpful').slice(0, 8).map((item) => item.actionText),
  avoidActions: feedback.filter((item) => item.feedback === 'not_helpful').slice(0, 8).map((item) => item.actionText),
  difficultActions: feedback.filter((item) => item.feedback === 'couldnt_do').slice(0, 8).map((item) => item.actionText),
});

import {
  DailyActivityCheckIn,
  DailyStats,
  MonthlyStats,
  RecommendationData,
} from '../types';

// Local CPU inference can take longer than a hosted model.
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ACTION_ITEMS = 5;

interface AssessmentAdviceRequest {
  dailyStats: DailyStats;
  monthlyStats: MonthlyStats;
  trend: MonthlyStats['trend'];
  checkIn: Pick<
    DailyActivityCheckIn,
    'date' | 'activities' | 'sleepFeeling' | 'sleepHours' | 'mouthBreathing'
  > | null;
  fallback: Pick<RecommendationData, 'recommendation' | 'actionItems' | 'activityContext'>;
}

interface AssessmentAdviceResponse {
  recommendation: string;
  actionItems: string[];
  activityContext?: string;
}

const getEndpoint = (): string =>
  (process.env.EXPO_PUBLIC_ASSESSMENT_API_URL ?? '').trim();

export const isAiAssessmentConfigured = (): boolean => getEndpoint().length > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseAdvice = (value: unknown): AssessmentAdviceResponse | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (!isNonEmptyString(candidate.recommendation) || !Array.isArray(candidate.actionItems)) {
    return null;
  }

  const actionItems = candidate.actionItems
    .filter(isNonEmptyString)
    .map((item) => item.trim())
    .slice(0, MAX_ACTION_ITEMS);
  if (actionItems.length === 0) return null;

  return {
    recommendation: candidate.recommendation.trim(),
    actionItems,
    ...(isNonEmptyString(candidate.activityContext)
      ? { activityContext: candidate.activityContext.trim() }
      : {}),
  };
};

/**
 * Requests wellness guidance from the app's backend. The OpenAI key must live on
 * that backend, never in an EXPO_PUBLIC variable or in the mobile bundle.
 */
export const requestAiAssessmentAdvice = async (
  dailyStats: DailyStats,
  monthlyStats: MonthlyStats,
  checkIn: DailyActivityCheckIn | null,
  fallback: RecommendationData,
  signal?: AbortSignal,
  endpointOverride?: string,
): Promise<RecommendationData | null> => {
  const endpoint = endpointOverride?.trim() || getEndpoint();
  // Critical guidance stays deterministic and clinician-directed.
  if (!endpoint || dailyStats.severity === 'danger') return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });

  const payload: AssessmentAdviceRequest = {
    dailyStats,
    monthlyStats,
    trend: monthlyStats.trend,
    checkIn: checkIn
      ? {
          date: checkIn.date,
          activities: checkIn.activities,
          sleepFeeling: checkIn.sleepFeeling,
          sleepHours: checkIn.sleepHours,
          mouthBreathing: checkIn.mouthBreathing,
        }
      : null,
    fallback: {
      recommendation: fallback.recommendation,
      actionItems: fallback.actionItems,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Assessment API returned ${response.status}`);
    const advice = parseAdvice(await response.json());
    if (!advice) throw new Error('Assessment API returned invalid advice');

    return {
      ...fallback,
      ...advice,
      source: 'ai',
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
};

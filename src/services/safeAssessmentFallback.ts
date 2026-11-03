import { DailyStats, RecommendationData } from '../types';

/**
 * Safety boundary for optional AI personalization.
 *
 * Critical results never invoke the model. For every other severity, any model
 * availability, initialization, inference, timeout, or output-validation error
 * falls back to a fresh copy of the deterministic rule-based recommendation.
 */
export const withSafeAssessmentFallback = async (
  severity: DailyStats['severity'],
  fallback: RecommendationData,
  personalize: () => Promise<RecommendationData>,
): Promise<RecommendationData> => {
  const deterministicFallback: RecommendationData = {
    ...fallback,
    source: 'rules',
  };

  if (severity === 'danger') return deterministicFallback;

  try {
    return await personalize();
  } catch {
    return deterministicFallback;
  }
};

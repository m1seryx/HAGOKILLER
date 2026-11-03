import { RecommendationData } from '../types';
import { withSafeAssessmentFallback } from './safeAssessmentFallback';

const fallback: RecommendationData = {
  severityLevel: 'bad',
  recommendation: 'Deterministic recommendation',
  actionItems: ['Deterministic action'],
  trendMessage: 'Stable trend',
  source: 'rules',
};

it('uses generated advice when non-critical personalization succeeds', async () => {
  const personalized = { ...fallback, recommendation: 'Personalized advice', source: 'on_device' as const };

  await expect(withSafeAssessmentFallback('bad', fallback, async () => personalized))
    .resolves.toBe(personalized);
});

it('uses deterministic advice when the model is unavailable or inference fails', async () => {
  const personalize = jest.fn(async () => {
    throw new Error('AI model is not downloaded.');
  });

  await expect(withSafeAssessmentFallback('bad', fallback, personalize)).resolves.toEqual(fallback);
  expect(personalize).toHaveBeenCalledTimes(1);
});

it('never invokes AI for critical results', async () => {
  const personalize = jest.fn(async () => ({ ...fallback, source: 'on_device' as const }));
  const criticalFallback: RecommendationData = {
    ...fallback,
    severityLevel: 'danger',
    source: 'on_device',
  };

  await expect(withSafeAssessmentFallback('danger', criticalFallback, personalize)).resolves.toMatchObject({
    severityLevel: 'danger',
    source: 'rules',
  });
  expect(personalize).not.toHaveBeenCalled();
});

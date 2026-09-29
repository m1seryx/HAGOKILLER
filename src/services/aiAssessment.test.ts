import { requestAiAssessmentAdvice } from './aiAssessment';
import { DailyStats, MonthlyStats, RecommendationData } from '../types';

const daily: DailyStats = {
  date: '2026-09-29',
  totalSnoreEvents: 12,
  averageDuration: 4,
  interventionCount: 3,
  peakHour: 2,
  severity: 'bad',
};
const monthly: MonthlyStats = {
  month: '2026-09',
  totalSnoreEvents: 120,
  averageDuration: 4,
  interventionCount: 30,
  trend: 'stable',
  severity: 'bad',
};
const fallback: RecommendationData = {
  severityLevel: 'bad',
  recommendation: 'Local recommendation',
  actionItems: ['Local action'],
  trendMessage: 'Stable trend',
  source: 'rules',
};

afterEach(() => {
  jest.restoreAllMocks();
});

it('merges validated AI copy while preserving deterministic assessment fields', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      recommendation: 'Personalized recommendation',
      actionItems: ['First action', 'Second action', 'Third action'],
      activityContext: 'Based on the selected activity.',
    }),
  } as Response);

  const result = await requestAiAssessmentAdvice(
    daily,
    monthly,
    null,
    fallback,
    undefined,
    'https://example.test/assessment-advice',
  );

  expect(result).toMatchObject({
    severityLevel: 'bad',
    trendMessage: 'Stable trend',
    recommendation: 'Personalized recommendation',
    source: 'ai',
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('never sends a critical assessment to the AI service', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch');

  const result = await requestAiAssessmentAdvice(
    { ...daily, severity: 'danger' },
    monthly,
    null,
    { ...fallback, severityLevel: 'danger' },
    undefined,
    'https://example.test/assessment-advice',
  );

  expect(result).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
});

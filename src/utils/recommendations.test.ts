import { getRecommendations } from './recommendations';
import { DailyActivityCheckIn, DailyStats, MonthlyStats } from '../types';

const daily: DailyStats = {
  date: '2026-10-01',
  totalSnoreEvents: 7,
  averageDuration: 3,
  interventionCount: 1,
  peakHour: 22,
  severity: 'normal',
};

const monthly: MonthlyStats = {
  month: '2026-10',
  totalSnoreEvents: 81,
  averageDuration: 3,
  interventionCount: 12,
  trend: 'stable',
  severity: 'normal',
};

it('turns a paperwork stress note into concrete bedtime actions', () => {
  const checkIn: DailyActivityCheckIn = {
    date: daily.date,
    activities: [],
    otherActivityNote: 'I am so stressed doing paperwork',
    updatedAt: Date.now(),
  };

  const result = getRecommendations(daily, monthly, 'stable', checkIn, daily.date);

  expect(result.actionItems[0]).toContain('10-minute shutdown routine');
  expect(result.actionItems[0]).toContain('paperwork out of sight');
  expect(result.actionItems[1]).toContain('inhale for 4 seconds');
  expect(result.activityContext).toContain('Stress and muscle tension');
});

it('infers congestion support from a free-text note', () => {
  const checkIn: DailyActivityCheckIn = {
    date: daily.date,
    activities: [],
    otherActivityNote: 'My nose feels congested tonight',
    updatedAt: Date.now(),
  };

  const result = getRecommendations(daily, monthly, 'stable', checkIn, daily.date);

  expect(result.actionItems[0]).toContain('saline rinse');
  expect(result.activityContext).toContain('Nasal congestion');
});

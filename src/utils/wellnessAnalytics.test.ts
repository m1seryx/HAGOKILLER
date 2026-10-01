import moment from 'moment';
import { analyzeInterventionOutcomes, calculateHabitCorrelations } from './wellnessAnalytics';

describe('wellness analytics', () => {
  test('marks a quieter post-inflation event as an effective response', () => {
    const start = moment('2026-09-30T23:00:00').valueOf();
    const outcomes = analyzeInterventionOutcomes([
      { id: 'a', timestamp: start, duration: 50, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
      { id: 'b', timestamp: start + 10 * 60_000, duration: 25, severity: 'medium', interventionTriggered: false, interventionDuration: 0 },
    ] as any);
    expect(outcomes[0].appearedEffective).toBe(true);
    expect(outcomes[0].minutesToNext).toBe(10);
  });

  test('requires enough habit and comparison samples before showing a correlation', () => {
    const checkIns = Array.from({ length: 6 }, (_, index) => ({
      date: moment('2026-09-20').add(index, 'days').format('YYYY-MM-DD'),
      activities: index < 3 ? ['caffeine'] : [],
      updatedAt: index,
    })) as any;
    const events = checkIns.flatMap((entry: any, index: number) => (
      Array.from({ length: index < 3 ? 4 : 2 }, (_, eventIndex) => ({
        id: `${index}-${eventIndex}`,
        timestamp: moment(entry.date).hour(2).add(eventIndex, 'minute').valueOf(),
        duration: 20,
        severity: 'low',
        interventionTriggered: false,
        interventionDuration: 0,
      }))
    )) as any;
    const correlations = calculateHabitCorrelations(checkIns, events);
    expect(correlations[0].activity).toBe('caffeine');
    expect(correlations[0].percentDifference).toBe(100);
  });
});

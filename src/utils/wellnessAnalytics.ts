import moment from 'moment';
import { ActivityId, DailyActivityCheckIn, SleepEvent } from '../types';
import { getNightKey } from './statsCalculator';

const ACTIVITY_LABELS: Partial<Record<ActivityId, string>> = {
  alcohol: 'Alcohol',
  late_meal: 'Late meals',
  exercise: 'Exercise',
  stress: 'Stress',
  caffeine: 'Late caffeine',
  screen_time: 'Late screens',
  congested: 'Congestion',
  back_sleeper: 'Back sleeping',
  irregular_schedule: 'Irregular schedule',
};

const SEVERITY_RANK: Record<SleepEvent['severity'], number> = { low: 1, medium: 2, high: 3 };

export interface InterventionOutcome {
  event: SleepEvent;
  nextEvent: SleepEvent | null;
  minutesToNext: number | null;
  appearedEffective: boolean;
  explanation: string;
}

export const analyzeInterventionOutcomes = (events: SleepEvent[]): InterventionOutcome[] => {
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
  return ordered
    .filter((event) => event.interventionTriggered)
    .map((event) => {
      const nextEvent = ordered.find((candidate) => (
        candidate.timestamp > event.timestamp
        && getNightKey(candidate.timestamp) === getNightKey(event.timestamp)
      )) ?? null;
      const minutesToNext = nextEvent
        ? Math.round(((nextEvent.timestamp - event.timestamp) / 60_000) * 10) / 10
        : null;
      const quietWindow = nextEvent === null || (minutesToNext ?? 0) >= 30;
      const durationReduced = !!nextEvent && nextEvent.duration < event.duration * 0.9;
      const severityReduced = !!nextEvent
        && SEVERITY_RANK[nextEvent.severity] < SEVERITY_RANK[event.severity];
      const appearedEffective = quietWindow || durationReduced || severityReduced;

      let explanation = 'Another event followed without a clear reduction.';
      if (nextEvent === null) explanation = 'No later snoring event was recorded that night.';
      else if (quietWindow) explanation = `${minutesToNext} quiet minutes followed the inflation.`;
      else if (durationReduced) explanation = `The next event was ${event.duration - nextEvent.duration}s shorter.`;
      else if (severityReduced) explanation = `The next event dropped to ${nextEvent.severity} severity.`;

      return { event, nextEvent, minutesToNext, appearedEffective, explanation };
    });
};

export interface HabitCorrelation {
  activity: ActivityId;
  label: string;
  sampleCount: number;
  baselineCount: number;
  percentDifference: number;
  direction: 'more' | 'fewer' | 'similar';
  message: string;
}

export const calculateHabitCorrelations = (
  checkIns: DailyActivityCheckIn[],
  events: SleepEvent[],
  minimumSamples = 3,
): HabitCorrelation[] => {
  const eventsByNight = new Map<string, number>();
  events.forEach((event) => {
    const date = getNightKey(event.timestamp);
    eventsByNight.set(date, (eventsByNight.get(date) ?? 0) + 1);
  });
  const dated = checkIns.map((checkIn) => ({
    checkIn,
    count: eventsByNight.get(checkIn.date) ?? 0,
  }));

  return (Object.keys(ACTIVITY_LABELS) as ActivityId[])
    .map((activity): HabitCorrelation | null => {
      const withHabit = dated.filter(({ checkIn }) => checkIn.activities.includes(activity));
      const withoutHabit = dated.filter(({ checkIn }) => !checkIn.activities.includes(activity));
      if (withHabit.length < minimumSamples || withoutHabit.length < minimumSamples) return null;
      const habitAverage = withHabit.reduce((sum, item) => sum + item.count, 0) / withHabit.length;
      const baselineAverage = withoutHabit.reduce((sum, item) => sum + item.count, 0) / withoutHabit.length;
      const percentDifference = baselineAverage > 0
        ? Math.round(((habitAverage - baselineAverage) / baselineAverage) * 100)
        : 0;
      const direction = Math.abs(percentDifference) < 8
        ? 'similar'
        : percentDifference > 0 ? 'more' : 'fewer';
      const label = ACTIVITY_LABELS[activity] ?? activity;
      const message = direction === 'similar'
        ? `${label} nights currently look similar to your other checked-in nights.`
        : `${label} nights averaged ${Math.abs(percentDifference)}% ${direction} snoring events.`;
      return {
        activity,
        label,
        sampleCount: withHabit.length,
        baselineCount: withoutHabit.length,
        percentDifference,
        direction,
        message,
      };
    })
    .filter((item): item is HabitCorrelation => item !== null)
    .sort((a, b) => Math.abs(b.percentDifference) - Math.abs(a.percentDifference));
};

export interface WeeklyRecap {
  currentEvents: number;
  previousEvents: number;
  percentChange: number | null;
  trend: 'improving' | 'stable' | 'worsening';
  message: string;
  goals: string[];
}

export const buildWeeklyRecap = (events: SleepEvent[]): WeeklyRecap => {
  const today = moment().endOf('day');
  const currentStart = today.clone().subtract(6, 'days').startOf('day');
  const previousStart = currentStart.clone().subtract(7, 'days');
  const previousEnd = currentStart.clone().subtract(1, 'millisecond');
  const currentEvents = events.filter((event) => moment(event.timestamp).isBetween(currentStart, today, undefined, '[]')).length;
  const previousEvents = events.filter((event) => moment(event.timestamp).isBetween(previousStart, previousEnd, undefined, '[]')).length;
  const percentChange = previousEvents > 0
    ? Math.round(((currentEvents - previousEvents) / previousEvents) * 100)
    : null;
  const trend = percentChange === null || Math.abs(percentChange) < 8
    ? 'stable'
    : percentChange < 0 ? 'improving' : 'worsening';
  const message = trend === 'improving'
    ? `Snoring events are down ${Math.abs(percentChange ?? 0)}% from the previous week. Keep it up.`
    : trend === 'worsening'
      ? `Snoring events are up ${Math.abs(percentChange ?? 0)}% from the previous week. Let’s make tonight calmer.`
      : 'Your weekly pattern is steady. Small, repeatable habits can move it in the right direction.';
  const goals = trend === 'worsening'
    ? ['Keep a consistent bedtime on 4 nights', 'Avoid late caffeine on 3 nights', 'Check pillow placement before sleep']
    : ['Complete 3 daily check-ins', 'Keep the pillow paired overnight', 'Protect a 30-minute wind-down'];
  return { currentEvents, previousEvents, percentChange, trend, message, goals };
};

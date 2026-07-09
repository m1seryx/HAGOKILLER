import moment from 'moment';
import { SleepEvent, DailyStats, MonthlyStats } from '../types';

// Severity thresholds
const SEVERITY_THRESHOLDS = {
  normal: { max: 3, maxDuration: 30 }, // <= 3 events, avg <= 30s
  bad: { max: 10, maxDuration: 60 }, // <= 10 events, avg <= 60s
  danger: { max: Infinity, maxDuration: Infinity }, // > 10 events or avg > 60s
};

export const calculateDailySeverity = (
  totalEvents: number,
  averageDuration: number
): 'normal' | 'bad' | 'danger' => {
  if (
    totalEvents <= SEVERITY_THRESHOLDS.normal.max &&
    averageDuration <= SEVERITY_THRESHOLDS.normal.maxDuration
  ) {
    return 'normal';
  }
  if (
    totalEvents <= SEVERITY_THRESHOLDS.bad.max &&
    averageDuration <= SEVERITY_THRESHOLDS.bad.maxDuration
  ) {
    return 'bad';
  }
  return 'danger';
};

export const calculateDailyStats = (events: SleepEvent[], date: string): DailyStats => {
  const dayEvents = events.filter((e) => moment(e.timestamp).format('YYYY-MM-DD') === date);

  const totalSnoreEvents = dayEvents.length;
  const averageDuration =
    totalSnoreEvents > 0
      ? dayEvents.reduce((sum, e) => sum + e.duration, 0) / totalSnoreEvents
      : 0;
  const interventionCount = dayEvents.filter((e) => e.interventionTriggered).length;

  // Calculate peak hour
  let peakHour = 0;
  if (dayEvents.length > 0) {
    const hourCounts: Record<number, number> = {};
    dayEvents.forEach((e) => {
      const hour = moment(e.timestamp).hour();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    peakHour = parseInt(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '0', 10);
  }

  const severity = calculateDailySeverity(totalSnoreEvents, averageDuration);

  return {
    date,
    totalSnoreEvents,
    averageDuration: Math.round(averageDuration),
    interventionCount,
    peakHour: parseInt(peakHour.toString()),
    severity,
  };
};

export const calculateMonthlySeverity = (
  dailyStats: DailyStats[]
): 'normal' | 'bad' | 'danger' => {
  if (dailyStats.length === 0) return 'normal';

  const avgEvents = dailyStats.reduce((sum, d) => sum + d.totalSnoreEvents, 0) / dailyStats.length;
  const avgDuration = dailyStats.reduce((sum, d) => sum + d.averageDuration, 0) / dailyStats.length;

  return calculateDailySeverity(avgEvents, avgDuration);
};

export const calculateTrend = (monthlyStats: MonthlyStats[]): 'improving' | 'stable' | 'worsening' => {
  if (monthlyStats.length < 2) return 'stable';

  const recent = monthlyStats.slice(-2);
  const currentMonth = recent[1];
  const previousMonth = recent[0];

  const currentAvg = currentMonth.totalSnoreEvents / 30; // Average per day
  const previousAvg = previousMonth.totalSnoreEvents / 30;

  const changePercent = ((currentAvg - previousAvg) / previousAvg) * 100;

  if (changePercent < -10) return 'improving';
  if (changePercent > 10) return 'worsening';
  return 'stable';
};

export const calculateMonthlyStats = (events: SleepEvent[], month: string): MonthlyStats => {
  const monthStart = moment(month, 'YYYY-MM').startOf('month');
  const monthEnd = moment(month, 'YYYY-MM').endOf('month');

  const monthEvents = events.filter(
    (e) =>
      moment(e.timestamp).isSameOrAfter(monthStart) &&
      moment(e.timestamp).isSameOrBefore(monthEnd)
  );

  const totalSnoreEvents = monthEvents.length;
  const averageDuration =
    totalSnoreEvents > 0
      ? monthEvents.reduce((sum, e) => sum + e.duration, 0) / totalSnoreEvents
      : 0;
  const interventionCount = monthEvents.filter((e) => e.interventionTriggered).length;

  const severity = calculateMonthlySeverity([
    calculateDailyStats(monthEvents, month.split('-').slice(0, 2).join('-')),
  ]);

  return {
    month,
    totalSnoreEvents,
    averageDuration: Math.round(averageDuration),
    interventionCount,
    trend: 'stable', // Will be calculated separately when comparing months
    severity,
  };
};

export const getHourLabel = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`;
};

export const getDateLabel = (dateStr: string): string => {
  return moment(dateStr).format('ddd, MMM D');
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

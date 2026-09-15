import moment from 'moment';
import { SleepEvent, DailyStats, MonthlyStats, NightDetail, NightHourBucket } from '../types';

/** Sleep night starts at 18:00; evening events roll into the next morning's night key. */
export const NIGHT_START_HOUR = 18;

/** Ordered hour axis for a night timeline (evening → morning). */
export const NIGHT_HOUR_ORDER: number[] = [
  18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
];

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

  // Avoid divide-by-zero when previous month had no events
  if (previousAvg === 0) {
    if (currentAvg === 0) return 'stable';
    return 'worsening';
  }

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

  // Build real per-day stats for the month (YYYY-MM alone is not a valid day key)
  const dailyStats: DailyStats[] = [];
  const cursor = monthStart.clone();
  while (cursor.isSameOrBefore(monthEnd, 'day')) {
    dailyStats.push(calculateDailyStats(monthEvents, cursor.format('YYYY-MM-DD')));
    cursor.add(1, 'day');
  }

  const activeDays = dailyStats.filter((d) => d.totalSnoreEvents > 0);
  const severity = calculateMonthlySeverity(activeDays.length > 0 ? activeDays : dailyStats);

  return {
    month,
    totalSnoreEvents,
    averageDuration: Math.round(averageDuration),
    interventionCount,
    trend: 'stable', // Will be calculated separately when comparing months
    severity,
  };
};

export interface InterventionEffectiveness {
  totalTriggers: number;
  successfulAdjustments: number;
  successRatio: number;
  trend: 'improving' | 'stable' | 'worsening';
}

export const calculateInterventionEffectiveness = (events: SleepEvent[]): InterventionEffectiveness => {
  const triggeredEvents = events.filter((event) => event.interventionTriggered);
  const totalTriggers = triggeredEvents.length;
  const successfulAdjustments = triggeredEvents.filter((event) => {
    const shorterDuration = event.duration <= 45;
    const lowerSeverity = event.severity !== 'high';
    return shorterDuration || lowerSeverity;
  }).length;
  const successRatio = totalTriggers > 0 ? successfulAdjustments / totalTriggers : 0;
  let trend: 'improving' | 'stable' | 'worsening' = 'stable';

  if (successRatio >= 0.6) {
    trend = 'improving';
  } else if (successRatio <= 0.25) {
    trend = 'worsening';
  }

  return {
    totalTriggers,
    successfulAdjustments,
    successRatio,
    trend,
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

export const formatPeakWindow = (hour: number): string => {
  const start = moment().hour(hour).minute(0);
  const end = start.clone().add(1, 'hour');
  return `${start.format('h:mm A')} – ${end.format('h:mm A')}`;
};

/**
 * Night key = wake morning date (YYYY-MM-DD).
 * 10pm Mon → Tue night; 3am Tue → Tue night.
 */
export const getNightKey = (timestamp: number): string => {
  const m = moment(timestamp);
  if (m.hour() >= NIGHT_START_HOUR) {
    return m.clone().add(1, 'day').format('YYYY-MM-DD');
  }
  return m.format('YYYY-MM-DD');
};

export const getNightLabel = (nightKey: string): string => {
  const wake = moment(nightKey, 'YYYY-MM-DD');
  const today = moment().format('YYYY-MM-DD');
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  if (nightKey === today) return 'Last night / tonight';
  if (nightKey === yesterday) return 'Yesterday night';
  return wake.format('ddd, MMM D');
};

export const calculateNightDetail = (events: SleepEvent[], nightKey: string): NightDetail => {
  const nightEvents = events
    .filter((e) => getNightKey(e.timestamp) === nightKey)
    .sort((a, b) => a.timestamp - b.timestamp);

  const hourCounts: Record<number, { count: number; interventions: number }> = {};
  NIGHT_HOUR_ORDER.forEach((h) => {
    hourCounts[h] = { count: 0, interventions: 0 };
  });

  nightEvents.forEach((e) => {
    const hour = moment(e.timestamp).hour();
    if (!hourCounts[hour]) hourCounts[hour] = { count: 0, interventions: 0 };
    hourCounts[hour].count += 1;
    if (e.interventionTriggered) hourCounts[hour].interventions += 1;
  });

  const hourly: NightHourBucket[] = NIGHT_HOUR_ORDER.map((hour) => ({
    hour,
    count: hourCounts[hour]?.count ?? 0,
    interventions: hourCounts[hour]?.interventions ?? 0,
  }));

  const ranked = [...hourly].sort((a, b) => b.count - a.count || a.hour - b.hour);
  const peakHour = ranked[0]?.count > 0 ? ranked[0].hour : NIGHT_START_HOUR;
  const topPeakHours = ranked.filter((b) => b.count > 0).slice(0, 3).map((b) => b.hour);

  const totalSnoreEvents = nightEvents.length;
  const averageDuration =
    totalSnoreEvents > 0
      ? Math.round(nightEvents.reduce((sum, e) => sum + e.duration, 0) / totalSnoreEvents)
      : 0;
  const interventionCount = nightEvents.filter((e) => e.interventionTriggered).length;

  return {
    nightKey,
    label: getNightLabel(nightKey),
    totalSnoreEvents,
    averageDuration,
    interventionCount,
    peakHour,
    peakWindowLabel: formatPeakWindow(peakHour),
    topPeakHours,
    firstSnoreAt: nightEvents[0]?.timestamp ?? null,
    lastSnoreAt: nightEvents[nightEvents.length - 1]?.timestamp ?? null,
    hourly,
    severity: calculateDailySeverity(totalSnoreEvents, averageDuration),
  };
};

/** Recent sleep nights (newest first), including empty nights up to `limit`. */
export const listRecentNightKeys = (events: SleepEvent[], limit = 7): string[] => {
  const keys = new Set<string>();
  events.forEach((e) => keys.add(getNightKey(e.timestamp)));

  const result: string[] = [];
  for (let i = 0; i < limit; i++) {
    const key = moment().subtract(i, 'days').format('YYYY-MM-DD');
    result.push(key);
  }

  // Prefer nights that have data, then fill with calendar nights
  const withData = result.filter((k) => keys.has(k));
  const without = result.filter((k) => !keys.has(k));
  return [...withData, ...without].slice(0, limit);
};

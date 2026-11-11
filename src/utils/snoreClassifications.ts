import moment from 'moment';
import { SleepEvent } from '../types';

export type ConsecutiveLevel = 'low' | 'mild' | 'high';
export type SnoreLengthLevel = 'low' | 'mid' | 'high' | 'severe';
export type RmsLevel = 'low' | 'mid' | 'high' | 'severe';

export interface ConsecutiveLevelInfo {
  level: ConsecutiveLevel;
  label: string;
  category: string;
  countThreshold: number;
  description: string;
  color: string;
  bg: string;
  border: string;
}

export interface SnoreLengthInfo {
  level: SnoreLengthLevel;
  label: string;
  category: string;
  range: string;
  minSec: number;
  maxSec: number;
  description: string;
  color: string;
  bg: string;
  border: string;
}

export interface RmsLevelInfo {
  level: RmsLevel;
  label: string;
  category: string;
  range: string;
  minRms: number;
  maxRms: number;
  description: string;
  color: string;
  bg: string;
  border: string;
}

/** 1 Snore - Low, 2 Snores - Mild, 3 Snore - High */
export function getConsecutiveLevelInfo(streak: number = 1): ConsecutiveLevelInfo {
  const s = Math.max(1, Math.round(streak));
  if (s <= 1) {
    return {
      level: 'low',
      label: 'Low',
      category: '1 Snore - Low',
      countThreshold: 1,
      description: 'Single isolated snore',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd',
    };
  }
  if (s === 2) {
    return {
      level: 'mild',
      label: 'Mild',
      category: '2 Snores - Mild',
      countThreshold: 2,
      description: 'Double snore cluster',
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
    };
  }
  return {
    level: 'high',
    label: 'High',
    category: '3+ Snores - High',
    countThreshold: 3,
    description: 'Consecutive streak (pillow trigger)',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca',
  };
}

/**
 * 0-5 secs - single breath snore: low
 * 6-15 secs - short cluster snore: mid
 * 16-30 secs - heavy sustained snore: high
 * 31-60 secs - continous chain snoring: severe
 */
export function getSnoreLengthInfo(durationSec: number = 0): SnoreLengthInfo {
  const d = Math.max(0, Math.round(durationSec));
  if (d <= 5) {
    return {
      level: 'low',
      label: 'Low',
      category: 'Single breath snore',
      range: '0-5s',
      minSec: 0,
      maxSec: 5,
      description: '0-5 secs - single breath snore: low',
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
    };
  }
  if (d <= 15) {
    return {
      level: 'mid',
      label: 'Mid',
      category: 'Short cluster snore',
      range: '6-15s',
      minSec: 6,
      maxSec: 15,
      description: '6-15 secs - short cluster snore: mid',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd',
    };
  }
  if (d <= 30) {
    return {
      level: 'high',
      label: 'High',
      category: 'Heavy sustained snore',
      range: '16-30s',
      minSec: 16,
      maxSec: 30,
      description: '16-30 secs - heavy sustained snore: high',
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
    };
  }
  return {
    level: 'severe',
    label: 'Severe',
    category: 'Continuous chain snoring',
    range: '31-60s',
    minSec: 31,
    maxSec: 60,
    description: '31-60 secs - continous chain snoring: severe',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  };
}

/**
 * 0-1000 RMS: Ambient noise/quiet breathing: low
 * 1000-2000 RMS: baseline snoring: mid
 * 2000-3500 rms: heavy snoring: high
 * 3500-4500 rms: severe snoring: severe
 */
export function getRmsLevelInfo(rmsVal: number = 0): RmsLevelInfo {
  const r = Math.max(0, Math.round(rmsVal));
  if (r <= 1000) {
    return {
      level: 'low',
      label: 'Low',
      category: 'Ambient noise / quiet breathing',
      range: '0-1000 RMS',
      minRms: 0,
      maxRms: 1000,
      description: '0-1000 RMS: Ambient noise/quiet breathing: low',
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
    };
  }
  if (r <= 2000) {
    return {
      level: 'mid',
      label: 'Mid',
      category: 'Baseline snoring',
      range: '1000-2000 RMS',
      minRms: 1000,
      maxRms: 2000,
      description: '1000-2000 RMS: baseline snoring: mid',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd',
    };
  }
  if (r <= 3500) {
    return {
      level: 'high',
      label: 'High',
      category: 'Heavy snoring',
      range: '2000-3500 RMS',
      minRms: 2000,
      maxRms: 3500,
      description: '2000-3500 rms: heavy snoring: high',
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
    };
  }
  return {
    level: 'severe',
    label: 'Severe',
    category: 'Severe snoring',
    range: '3500-4500 RMS',
    minRms: 3500,
    maxRms: 4500,
    description: '3500-4500 rms: severe snoring: severe',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  };
}

// -------------------------------------------------------------
// Data Aggregations for the 4 Visualizations
// -------------------------------------------------------------

export interface DailySnoreCountRow {
  date: string;
  displayDate: string;
  count: number;
  diffFromAvg: number;
  percentageOfPeak: number;
}

export interface DateRangeSnoreStats {
  rows: DailySnoreCountRow[];
  totalCount: number;
  averageCount: number;
  peakCount: number;
  peakDate: string | null;
  lowestCount: number;
  lowestDate: string | null;
  daysInRange: number;
}

export function computeSnoreCountByDateRange(
  events: SleepEvent[],
  startDate: string,
  endDate: string,
): DateRangeSnoreStats {
  const start = moment(startDate).startOf('day');
  const end = moment(endDate).endOf('day');
  const countsByDate = new Map<string, number>();

  // Filter events within date range
  events.forEach((e) => {
    const m = moment(e.timestamp);
    if (m.isBetween(start, end, undefined, '[]')) {
      const dStr = m.format('YYYY-MM-DD');
      countsByDate.set(dStr, (countsByDate.get(dStr) ?? 0) + 1);
    }
  });

  const daysDiff = Math.max(1, end.diff(start, 'days') + 1);
  const rows: DailySnoreCountRow[] = [];
  let totalCount = 0;
  let peakCount = 0;
  let peakDate: string | null = null;
  let lowestCount = Infinity;
  let lowestDate: string | null = null;

  for (let i = 0; i < daysDiff; i++) {
    const curr = start.clone().add(i, 'days');
    const dStr = curr.format('YYYY-MM-DD');
    const count = countsByDate.get(dStr) ?? 0;
    totalCount += count;

    if (count > peakCount) {
      peakCount = count;
      peakDate = dStr;
    }
    if (count < lowestCount) {
      lowestCount = count;
      lowestDate = dStr;
    }

    rows.push({
      date: dStr,
      displayDate: curr.format('MMM D'),
      count,
      diffFromAvg: 0, // computed below
      percentageOfPeak: 0, // computed below
    });
  }

  if (lowestCount === Infinity) lowestCount = 0;

  const averageCount = rows.length > 0 ? Math.round((totalCount / rows.length) * 10) / 10 : 0;
  const safePeak = Math.max(1, peakCount);

  rows.forEach((r) => {
    r.diffFromAvg = Math.round((r.count - averageCount) * 10) / 10;
    r.percentageOfPeak = Math.min(100, Math.round((r.count / safePeak) * 100));
  });

  return {
    rows,
    totalCount,
    averageCount,
    peakCount,
    peakDate,
    lowestCount,
    lowestDate,
    daysInRange: rows.length,
  };
}

export interface ConsecutiveLevelRow {
  streakLevel: ConsecutiveLevel;
  streakName: string;
  label: string;
  color: string;
  bg: string;
  eventCount: number;
  percentage: number;
  avgDuration: number;
  avgRms: number;
}

export interface SessionConsecutiveStats {
  rows: ConsecutiveLevelRow[];
  totalEvents: number;
  peakStreakReached: number;
  peakStreakInfo: ConsecutiveLevelInfo;
  averagePeakStreakAcrossNights: number;
  averagePeakStreakLabel: string;
  streakSessionAverage: number;
}

export function computeSessionConsecutiveStats(events: SleepEvent[]): SessionConsecutiveStats {
  const buckets: Record<ConsecutiveLevel, { count: number; totalDur: number; totalRms: number }> = {
    low: { count: 0, totalDur: 0, totalRms: 0 },
    mild: { count: 0, totalDur: 0, totalRms: 0 },
    high: { count: 0, totalDur: 0, totalRms: 0 },
  };

  const nightPeaks = new Map<string, number>();
  let overallPeak = 1;
  let totalStreakSum = 0;

  events.forEach((e) => {
    const s = Math.max(1, e.snoreStreak ?? 1);
    totalStreakSum += s;
    if (s > overallPeak) overallPeak = s;

    const dStr = moment(e.timestamp).format('YYYY-MM-DD');
    const prevPeak = nightPeaks.get(dStr) ?? 0;
    if (s > prevPeak) nightPeaks.set(dStr, s);

    const info = getConsecutiveLevelInfo(s);
    buckets[info.level].count += 1;
    buckets[info.level].totalDur += e.duration || 0;
    buckets[info.level].totalRms += e.rms || 0;
  });

  const total = Math.max(1, events.length);
  const rows: ConsecutiveLevelRow[] = [
    {
      streakLevel: 'low',
      streakName: '1 Snore',
      label: 'Low',
      color: '#0284c7',
      bg: '#f0f9ff',
      eventCount: buckets.low.count,
      percentage: Math.round((buckets.low.count / total) * 100),
      avgDuration: buckets.low.count ? Math.round(buckets.low.totalDur / buckets.low.count) : 0,
      avgRms: buckets.low.count ? Math.round(buckets.low.totalRms / buckets.low.count) : 0,
    },
    {
      streakLevel: 'mild',
      streakName: '2 Snores',
      label: 'Mild',
      color: '#f59e0b',
      bg: '#fffbeb',
      eventCount: buckets.mild.count,
      percentage: Math.round((buckets.mild.count / total) * 100),
      avgDuration: buckets.mild.count ? Math.round(buckets.mild.totalDur / buckets.mild.count) : 0,
      avgRms: buckets.mild.count ? Math.round(buckets.mild.totalRms / buckets.mild.count) : 0,
    },
    {
      streakLevel: 'high',
      streakName: '3+ Snores',
      label: 'High',
      color: '#ef4444',
      bg: '#fef2f2',
      eventCount: buckets.high.count,
      percentage: Math.round((buckets.high.count / total) * 100),
      avgDuration: buckets.high.count ? Math.round(buckets.high.totalDur / buckets.high.count) : 0,
      avgRms: buckets.high.count ? Math.round(buckets.high.totalRms / buckets.high.count) : 0,
    },
  ];

  const nightPeakValues = Array.from(nightPeaks.values());
  const avgPeakVal = nightPeakValues.length > 0
    ? Math.round((nightPeakValues.reduce((sum, v) => sum + v, 0) / nightPeakValues.length) * 10) / 10
    : 1;

  const avgPeakInfo = getConsecutiveLevelInfo(Math.round(avgPeakVal));

  return {
    rows,
    totalEvents: events.length,
    peakStreakReached: overallPeak,
    peakStreakInfo: getConsecutiveLevelInfo(overallPeak),
    averagePeakStreakAcrossNights: avgPeakVal,
    averagePeakStreakLabel: avgPeakInfo.label,
    streakSessionAverage: events.length > 0 ? Math.round((totalStreakSum / events.length) * 10) / 10 : 1,
  };
}

export interface SnoreLengthTierRow {
  level: SnoreLengthLevel;
  label: string;
  category: string;
  range: string;
  color: string;
  bg: string;
  eventCount: number;
  percentage: number;
  totalDurationSec: number;
  avgDurationSec: number;
}

export interface SessionLengthStats {
  rows: SnoreLengthTierRow[];
  totalEvents: number;
  totalDurationSec: number;
  avgDurationSec: number;
  longestDurationSec: number;
  dominantLevel: SnoreLengthLevel;
}

export function computeSessionLengthStats(events: SleepEvent[]): SessionLengthStats {
  const buckets: Record<SnoreLengthLevel, { count: number; totalSec: number }> = {
    low: { count: 0, totalSec: 0 },
    mid: { count: 0, totalSec: 0 },
    high: { count: 0, totalSec: 0 },
    severe: { count: 0, totalSec: 0 },
  };

  let maxDur = 0;
  let sumDur = 0;

  events.forEach((e) => {
    const dur = Math.max(1, Math.round(e.duration || 0));
    sumDur += dur;
    if (dur > maxDur) maxDur = dur;

    const info = getSnoreLengthInfo(dur);
    buckets[info.level].count += 1;
    buckets[info.level].totalSec += dur;
  });

  const total = Math.max(1, events.length);
  const rows: SnoreLengthTierRow[] = [
    {
      level: 'low',
      label: 'Low',
      category: 'Single breath snore',
      range: '0-5 secs',
      color: '#059669',
      bg: '#ecfdf5',
      eventCount: buckets.low.count,
      percentage: Math.round((buckets.low.count / total) * 100),
      totalDurationSec: buckets.low.totalSec,
      avgDurationSec: buckets.low.count ? Math.round(buckets.low.totalSec / buckets.low.count) : 0,
    },
    {
      level: 'mid',
      label: 'Mid',
      category: 'Short cluster snore',
      range: '6-15 secs',
      color: '#0284c7',
      bg: '#f0f9ff',
      eventCount: buckets.mid.count,
      percentage: Math.round((buckets.mid.count / total) * 100),
      totalDurationSec: buckets.mid.totalSec,
      avgDurationSec: buckets.mid.count ? Math.round(buckets.mid.totalSec / buckets.mid.count) : 0,
    },
    {
      level: 'high',
      label: 'High',
      category: 'Heavy sustained snore',
      range: '16-30 secs',
      color: '#f59e0b',
      bg: '#fffbeb',
      eventCount: buckets.high.count,
      percentage: Math.round((buckets.high.count / total) * 100),
      totalDurationSec: buckets.high.totalSec,
      avgDurationSec: buckets.high.count ? Math.round(buckets.high.totalSec / buckets.high.count) : 0,
    },
    {
      level: 'severe',
      label: 'Severe',
      category: 'Continuous chain snoring',
      range: '31-60 secs',
      color: '#dc2626',
      bg: '#fef2f2',
      eventCount: buckets.severe.count,
      percentage: Math.round((buckets.severe.count / total) * 100),
      totalDurationSec: buckets.severe.totalSec,
      avgDurationSec: buckets.severe.count ? Math.round(buckets.severe.totalSec / buckets.severe.count) : 0,
    },
  ];

  let dominant: SnoreLengthLevel = 'low';
  let dominantCount = -1;
  rows.forEach((r) => {
    if (r.eventCount > dominantCount) {
      dominantCount = r.eventCount;
      dominant = r.level;
    }
  });

  return {
    rows,
    totalEvents: events.length,
    totalDurationSec: sumDur,
    avgDurationSec: events.length ? Math.round(sumDur / events.length) : 0,
    longestDurationSec: maxDur,
    dominantLevel: dominant,
  };
}

export interface RmsTierRow {
  level: RmsLevel;
  label: string;
  category: string;
  range: string;
  color: string;
  bg: string;
  eventCount: number;
  percentage: number;
  avgRms: number;
  maxRmsInTier: number;
}

export interface SessionRmsStats {
  rows: RmsTierRow[];
  totalEvents: number;
  peakRms: number;
  peakRmsInfo: RmsLevelInfo;
  avgRms: number;
  avgRmsInfo: RmsLevelInfo;
  minRms: number;
  timelinePoints: Array<{
    timestamp: number;
    timeLabel: string;
    rms: number;
    level: RmsLevel;
    color: string;
  }>;
}

export function computeSessionRmsStats(events: SleepEvent[]): SessionRmsStats {
  const buckets: Record<RmsLevel, { count: number; totalRms: number; maxRms: number }> = {
    low: { count: 0, totalRms: 0, maxRms: 0 },
    mid: { count: 0, totalRms: 0, maxRms: 0 },
    high: { count: 0, totalRms: 0, maxRms: 0 },
    severe: { count: 0, totalRms: 0, maxRms: 0 },
  };

  let maxRms = 0;
  let minRms = Infinity;
  let sumRms = 0;

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const timelinePoints: SessionRmsStats['timelinePoints'] = [];

  sorted.forEach((e) => {
    const r = Math.max(0, Math.round(e.rms || 0));
    sumRms += r;
    if (r > maxRms) maxRms = r;
    if (r < minRms) minRms = r;

    const info = getRmsLevelInfo(r);
    buckets[info.level].count += 1;
    buckets[info.level].totalRms += r;
    if (r > buckets[info.level].maxRms) buckets[info.level].maxRms = r;

    timelinePoints.push({
      timestamp: e.timestamp,
      timeLabel: moment(e.timestamp).format('h:mm A'),
      rms: r,
      level: info.level,
      color: info.color,
    });
  });

  if (minRms === Infinity) minRms = 0;
  const total = Math.max(1, events.length);
  const avgRmsVal = events.length ? Math.round(sumRms / events.length) : 0;

  const rows: RmsTierRow[] = [
    {
      level: 'low',
      label: 'Low',
      category: 'Ambient / Quiet breathing',
      range: '0-1000 RMS',
      color: '#059669',
      bg: '#ecfdf5',
      eventCount: buckets.low.count,
      percentage: Math.round((buckets.low.count / total) * 100),
      avgRms: buckets.low.count ? Math.round(buckets.low.totalRms / buckets.low.count) : 0,
      maxRmsInTier: buckets.low.maxRms,
    },
    {
      level: 'mid',
      label: 'Mid',
      category: 'Baseline snoring',
      range: '1000-2000 RMS',
      color: '#0284c7',
      bg: '#f0f9ff',
      eventCount: buckets.mid.count,
      percentage: Math.round((buckets.mid.count / total) * 100),
      avgRms: buckets.mid.count ? Math.round(buckets.mid.totalRms / buckets.mid.count) : 0,
      maxRmsInTier: buckets.mid.maxRms,
    },
    {
      level: 'high',
      label: 'High',
      category: 'Heavy snoring',
      range: '2000-3500 RMS',
      color: '#f59e0b',
      bg: '#fffbeb',
      eventCount: buckets.high.count,
      percentage: Math.round((buckets.high.count / total) * 100),
      avgRms: buckets.high.count ? Math.round(buckets.high.totalRms / buckets.high.count) : 0,
      maxRmsInTier: buckets.high.maxRms,
    },
    {
      level: 'severe',
      label: 'Severe',
      category: 'Severe snoring',
      range: '3500-4500 RMS',
      color: '#dc2626',
      bg: '#fef2f2',
      eventCount: buckets.severe.count,
      percentage: Math.round((buckets.severe.count / total) * 100),
      avgRms: buckets.severe.count ? Math.round(buckets.severe.totalRms / buckets.severe.count) : 0,
      maxRmsInTier: buckets.severe.maxRms,
    },
  ];

  return {
    rows,
    totalEvents: events.length,
    peakRms: maxRms,
    peakRmsInfo: getRmsLevelInfo(maxRms),
    avgRms: avgRmsVal,
    avgRmsInfo: getRmsLevelInfo(avgRmsVal),
    minRms,
    timelinePoints,
  };
}


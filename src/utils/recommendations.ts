import {
  ActivityId,
  DailyActivityCheckIn,
  DailyStats,
  MonthlyStats,
  RecommendationData,
} from '../types';

type Trend = 'improving' | 'stable' | 'worsening';
type Severity = 'normal' | 'bad' | 'danger';

const TREND_MESSAGES: Record<Trend, string[]> = {
  improving: [
    'Your snoring is improving — keep up the habits that are working.',
    'Trending in the right direction. Stay consistent with your sleep routine.',
    'Good progress this period. Small daily choices are adding up.',
  ],
  worsening: [
    'Snoring frequency is rising. Review your recent sleep habits closely.',
    'Patterns are getting worse — today is a good day to reset your routine.',
    'An upward trend detected. Focus on triggers you can control tonight.',
  ],
  stable: [
    'Your snoring patterns are steady. Keep monitoring and fine-tuning.',
    'No major change lately — maintain your current sleep hygiene.',
    'Stable readings today. Use your check-in to target small improvements.',
  ],
};

const RECOMMENDATION_POOL: Record<Severity, string[]> = {
  normal: [
    'Sleep quality looks within a healthy range. Keep building consistent habits.',
    'Your readings are calm today. Protect your routine to stay on track.',
    'Overall patterns look good — small adjustments can still sharpen recovery.',
  ],
  bad: [
    'Snoring is elevated. Lifestyle tweaks tonight may help reduce episodes.',
    'Your airway seems more active than usual — positional and nasal care can help.',
    'Moderate concern today. Focus on side sleeping and a calmer wind-down.',
  ],
  danger: [
    'Snoring is significantly elevated. Please discuss these patterns with a clinician.',
    'Critical-level activity detected. Medical evaluation is strongly recommended.',
    'Severe readings today warrant professional follow-up alongside home measures.',
  ],
};

const ACTION_POOL: Record<Severity, string[]> = {
  normal: [
    'Keep a fixed bedtime and wake time, even on weekends.',
    'Keep the bedroom cool (about 18–20°C) and well ventilated.',
    'Limit screens 30–60 minutes before bed to support deeper sleep.',
    'Stay hydrated during the day, but taper fluids 1–2 hours before sleep.',
    'Use nasal strips or saline rinse if you feel mildly blocked.',
    'Practice 5 minutes of slow breathing before lights out.',
    'Track pillow position — side sleeping often reduces mild snoring.',
    'Avoid heavy dinners within 3 hours of bedtime.',
  ],
  bad: [
    'Sleep on your side with a body pillow or positional aid.',
    'Elevate your head 10–15 cm to ease airway pressure.',
    'Run a humidifier to keep nasal passages from drying out.',
    'Clear nasal congestion with saline spray before bed.',
    'Avoid alcohol and sedatives at least 3–4 hours before sleep.',
    'Walk or stretch lightly in the afternoon — avoid intense workouts late.',
    'Try mouth-taping only if cleared by your doctor for nasal breathing.',
    'Review allergy triggers in the bedroom (dust, pets, fabrics).',
  ],
  danger: [
    'Book a sleep specialist or ENT appointment as soon as possible.',
    'Ask about a sleep study (polysomnography) to rule out sleep apnea.',
    'Share your HAGOKILLER logs with your healthcare provider.',
    'Until evaluated, sleep on your side and elevate your head.',
    'Avoid driving or operating machinery if you feel unrested.',
    'Do not ignore loud snoring with gasping or daytime sleepiness.',
    'Consider a partner or app recording to capture apnea-like pauses.',
  ],
};

const ACTIVITY_ADVICE: Record<
  ActivityId,
  { context: string; tips: string[] }
> = {
  alcohol: {
    context: 'Alcohol relaxes throat muscles and often worsens snoring.',
    tips: [
      'Skip alcohol at least 3–4 hours before bed tonight.',
      'Alternate each drink with water to reduce dehydration.',
      'Choose lighter drinks and stop earlier in the evening.',
    ],
  },
  late_meal: {
    context: 'Late meals can trigger reflux and airway irritation.',
    tips: [
      'Finish dinner 3 hours before bedtime when possible.',
      'Keep late snacks light and low in fat.',
      'Elevate your head slightly if you ate close to bedtime.',
    ],
  },
  exercise: {
    context: 'Exercise helps sleep, but late sessions can keep airways active.',
    tips: [
      'Schedule vigorous workouts earlier in the day.',
      'Cool down and stretch for 10 minutes before bed.',
      'Hydrate after exercise but taper fluids before sleep.',
    ],
  },
  stress: {
    context: 'Stress and muscle tension can disrupt breathing patterns.',
    tips: [
      'Try 5 minutes of box breathing before sleep.',
      'Write down worries on paper to clear your mind.',
      'Keep a consistent wind-down ritual (dim lights, no news).',
    ],
  },
  congested: {
    context: 'Nasal congestion narrows the airway and increases snoring.',
    tips: [
      'Use saline rinse or steam inhalation before bed.',
      'Sleep with a slightly elevated head position.',
      'Consider a bedroom humidifier and allergy-proof bedding.',
    ],
  },
  back_sleeper: {
    context: 'Back sleeping lets the tongue and soft palate collapse backward.',
    tips: [
      'Use a side-sleeping pillow or tennis-ball shirt technique.',
      'Place a pillow behind your back to stay on your side.',
      'Try a wedge pillow if side sleeping is uncomfortable.',
    ],
  },
  caffeine: {
    context: 'Late caffeine can fragment sleep and worsen airway instability.',
    tips: [
      'Cut caffeine after 2 PM (or 8 hours before bed).',
      'Switch evening drinks to herbal tea or water.',
      'Watch hidden caffeine in chocolate, soda, and energy drinks.',
    ],
  },
  irregular_schedule: {
    context: 'Irregular sleep times confuse your body clock.',
    tips: [
      'Anchor wake time daily, even after a short night.',
      'Get morning light exposure within an hour of waking.',
      'Limit naps to 20 minutes before 3 PM.',
    ],
  },
};

const DAILY_TIPS = [
  'A 10-minute walk after dinner can improve sleep quality.',
  'Replace one scroll session with a short stretch routine tonight.',
  'Wash pillowcases weekly — allergens build up quickly.',
  'Try humming exercises to gently strengthen airway muscles.',
  'Keep water by the bed, but sip less in the last hour before sleep.',
  'Consistency beats perfection — pick one habit and repeat it daily.',
  'Side sleeping with knees slightly bent often opens the airway.',
  'A cooler, darker room supports deeper, quieter sleep.',
];

function hashDate(date: string): number {
  return date.split('').reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}

function pickRotated<T>(pool: T[], seed: number, count: number): T[] {
  if (pool.length === 0) return [];
  const limit = Math.min(count, pool.length);
  const start = seed % pool.length;
  const picked: T[] = [];
  for (let i = 0; i < limit; i += 1) {
    picked.push(pool[(start + i) % pool.length]);
  }
  return picked;
}

export const getRecommendations = (
  dailyStats: DailyStats,
  _monthlyStats: MonthlyStats,
  trend: Trend,
  checkIn?: DailyActivityCheckIn | null,
  dateStr: string = dailyStats.date,
): RecommendationData => {
  const seed = hashDate(dateStr);
  const severityLevel = dailyStats.severity;
  const trendPool = TREND_MESSAGES[trend];
  const trendMessage = trendPool[seed % trendPool.length];

  let recommendation = RECOMMENDATION_POOL[severityLevel][seed % RECOMMENDATION_POOL[severityLevel].length];
  let actionItems = pickRotated(ACTION_POOL[severityLevel], seed, 4);

  const activities = checkIn?.activities ?? [];
  const otherNote = checkIn?.otherActivityNote?.trim();
  const contextParts: string[] = [];

  for (const activity of activities) {
    const advice = ACTIVITY_ADVICE[activity];
    if (!advice) continue;
    contextParts.push(advice.context);
    const tipIndex = (seed + activity.charCodeAt(0)) % advice.tips.length;
    actionItems.unshift(advice.tips[tipIndex]);
  }

  if (otherNote) {
    contextParts.push(`You noted: ${otherNote}.`);
    actionItems.unshift(
      'Review whether this activity could affect sleep — adjust timing or habits if it recurs.',
    );
  }

  actionItems = [...new Set(actionItems)].slice(0, 5);

  if (activities.length > 0 || otherNote) {
    recommendation = `${recommendation} Based on today's check-in, we've tailored the tips below to your recent activities.`;
  }

  return {
    severityLevel,
    recommendation,
    actionItems,
    trendMessage,
    dailyTip: DAILY_TIPS[seed % DAILY_TIPS.length],
    activityContext: contextParts.length > 0 ? contextParts.join(' ') : undefined,
    checkInComplete: !!checkIn,
  };
};

export const getSeverityColor = (severity: 'normal' | 'bad' | 'danger'): string => {
  switch (severity) {
    case 'normal':
      return '#10b981';
    case 'bad':
      return '#f59e0b';
    case 'danger':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

export const getSeverityLabel = (severity: 'normal' | 'bad' | 'danger'): string => {
  switch (severity) {
    case 'normal':
      return 'Normal';
    case 'bad':
      return 'Elevated';
    case 'danger':
      return 'Critical';
    default:
      return 'Unknown';
  }
};

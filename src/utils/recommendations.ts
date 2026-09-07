import {
  ActivityId,
  DailyActivityCheckIn,
  DailyStats,
  MonthlyStats,
  RecommendationData,
} from '../types';

type Trend = 'improving' | 'stable' | 'worsening';
type Severity = 'normal' | 'bad' | 'danger';

/** Rule-based daily advice from snoring severity + trend + check-in + date rotation. */

const TREND_MESSAGES: Record<Trend, string> = {
  improving: 'Your snoring is improving — keep up the habits that are working.',
  worsening: 'Snoring frequency is rising. Review your recent sleep habits closely.',
  stable: 'Your snoring patterns are steady. Keep monitoring and fine-tuning.',
};

const RECOMMENDATION_BY_SEVERITY: Record<Severity, string[]> = {
  normal: [
    'Your sleep quality is within a normal range. Keep consistent habits tonight.',
    'Calm readings today. Protect your bedtime routine to stay on track.',
    'Patterns look healthy — small sleep-hygiene choices still help recovery.',
  ],
  bad: [
    'Your snoring is elevated. Focus on side sleeping and a calmer wind-down tonight.',
    'Airway activity is higher than usual — nasal care and head elevation can help.',
    'Moderate concern today. Avoid late alcohol, heavy meals, and back sleeping.',
  ],
  danger: [
    'Snoring is significantly elevated. Seek medical evaluation and use the tips below.',
    'Critical-level activity detected. Talk with a sleep clinician and share your logs.',
    'Severe readings warrant professional follow-up alongside home measures tonight.',
  ],
};

const ACTION_BY_SEVERITY: Record<Severity, string[]> = {
  normal: [
    'Keep a fixed bedtime and wake time, even on weekends.',
    'Keep the bedroom cool and well ventilated.',
    'Avoid heavy meals, alcohol, and sedatives before bed.',
    'Prefer side sleeping when possible.',
    'Limit screens 30–60 minutes before lights out.',
    'Stay hydrated during the day; taper fluids near bedtime.',
    'Use saline rinse if you feel mildly congested.',
    'Practice 5 minutes of slow breathing before sleep.',
  ],
  bad: [
    'Sleep on your side with a body pillow or positional aid.',
    'Elevate your head 10–15 cm to ease airway pressure.',
    'Use a humidifier and clear nasal congestion before bed.',
    'Avoid alcohol and sedatives at least 3–4 hours before sleep.',
    'Finish dinner at least 3 hours before bedtime.',
    'Cut caffeine after mid-afternoon.',
    'Keep a short wind-down ritual with dim lights.',
    'Review bedroom allergens (dust, pets, fabrics).',
  ],
  danger: [
    'Schedule an appointment with a sleep specialist or ENT doctor.',
    'Ask about a sleep study if snoring comes with gasping or daytime sleepiness.',
    'Share your HAGOKILLER logs with your healthcare provider.',
    'Until evaluated, sleep on your side and elevate your head.',
    'Avoid driving if you feel unrested.',
    'Do not ignore loud snoring with pauses or gasping.',
    'Skip alcohol and sedatives tonight.',
    'Keep the bedroom cool, dark, and quiet for recovery.',
  ],
};

const ACTIVITY_ADVICE: Record<ActivityId, { context: string; tips: string[] }> = {
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
      'Cut caffeine after mid-afternoon.',
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
  smoking: {
    context: 'Smoking or vaping irritates airways and increases snoring risk.',
    tips: [
      'Avoid nicotine for several hours before bed.',
      'Rinse your mouth and hydrate after smoking.',
      'Consider cutting back — airways recover as exposure drops.',
    ],
  },
  screen_time: {
    context: 'Late screen time delays sleep and can fragment rest.',
    tips: [
      'Dim screens 30–60 minutes before lights out.',
      'Use night mode or lower brightness in the evening.',
      'Swap the last scroll session for a short stretch or reading.',
    ],
  },
  dry_air: {
    context: 'Dry bedroom air can irritate the throat overnight.',
    tips: [
      'Run a cool-mist humidifier near the bed.',
      'Keep a glass of water nearby for small sips if needed.',
      'Avoid overheating the room — cooler air is usually kinder.',
    ],
  },
  mouth_breathing: {
    context: 'Mouth breathing often worsens snoring and dry throat.',
    tips: [
      'Clear your nose with saline before bed.',
      'Ask a clinician before trying mouth tape.',
      'Side sleeping can reduce mouth opening overnight.',
    ],
  },
  medications: {
    context: 'Some sedating medications relax airway muscles.',
    tips: [
      'Ask your clinician if timing or alternatives are possible.',
      'Avoid stacking alcohol with sedating meds.',
      'Elevate your head and prefer side sleeping tonight.',
    ],
  },
  dehydrated: {
    context: 'Dehydration can dry throat tissues and increase vibration.',
    tips: [
      'Hydrate steadily during the day.',
      'Taper large fluid intake in the last hour before bed.',
      'A humidifier can help if the air is dry.',
    ],
  },
};

const DAILY_TIPS = [
  'Side sleeping with knees slightly bent often opens the airway.',
  'A cooler, darker room supports deeper, quieter sleep.',
  'Wash pillowcases weekly — allergens build up quickly.',
  'A 10-minute walk after dinner can improve sleep quality.',
  'Consistency beats perfection — pick one habit and repeat it daily.',
  'Keep water nearby, but sip less in the last hour before sleep.',
  'Nasal strips or saline can help if your nose feels blocked.',
  'Dim screens earlier to support melatonin before bed.',
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
  const recPool = RECOMMENDATION_BY_SEVERITY[severityLevel];
  let recommendation = recPool[seed % recPool.length];
  let actionItems = pickRotated(ACTION_BY_SEVERITY[severityLevel], seed, 4);
  const dailyTip = DAILY_TIPS[seed % DAILY_TIPS.length];

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
    recommendation = `${recommendation} Based on today's check-in, tips below match what you selected.`;
  }

  return {
    severityLevel,
    recommendation,
    actionItems,
    trendMessage: TREND_MESSAGES[trend],
    dailyTip,
    activityContext: contextParts.length > 0 ? contextParts.join(' ') : undefined,
    checkInComplete: !!checkIn,
  };
};

/** Compact text for daily phone notification. */
export const buildDailyAdviceNotificationBody = (
  severity: Severity,
  trend: Trend,
  dateStr: string,
): { title: string; body: string } => {
  const seed = hashDate(dateStr);
  const recommendation =
    RECOMMENDATION_BY_SEVERITY[severity][seed % RECOMMENDATION_BY_SEVERITY[severity].length];
  const tip = pickRotated(ACTION_BY_SEVERITY[severity], seed, 1)[0];
  const dailyTip = DAILY_TIPS[seed % DAILY_TIPS.length];
  const severityLabel =
    severity === 'normal' ? 'Normal' : severity === 'bad' ? 'Elevated' : 'Critical';

  return {
    title: `Daily sleep tip · ${severityLabel}`,
    body: `${recommendation} Tip: ${tip} (${dailyTip}) Trend: ${TREND_MESSAGES[trend]}`,
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

/** Mood mirror of snoring severity for the dashboard mood card. */
export const getMoodStatus = (
  severity: 'normal' | 'bad' | 'danger',
): { label: string; color: string; background: string; icon: string; caption: string } => {
  switch (severity) {
    case 'normal':
      return {
        label: 'Happy',
        color: '#10b981',
        background: 'rgba(16, 185, 129, 0.12)',
        icon: 'smile',
        caption: 'Sleep patterns look healthy today.',
      };
    case 'bad':
      return {
        label: 'Uneasy',
        color: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.14)',
        icon: 'meh',
        caption: 'Snoring is elevated — small habit changes can help.',
      };
    case 'danger':
      return {
        label: 'Unhappy',
        color: '#ef4444',
        background: 'rgba(239, 68, 68, 0.12)',
        icon: 'frown',
        caption: 'Critical snoring levels — prioritize rest and care.',
      };
    default:
      return {
        label: 'Unknown',
        color: '#6b7280',
        background: 'rgba(107, 114, 128, 0.12)',
        icon: 'question-circle',
        caption: 'Not enough data yet.',
      };
  }
};

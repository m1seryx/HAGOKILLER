import { ActivityId } from '../types';

/** Keyword / phrase map → activity id (case-insensitive substring match). */
const KEYWORD_MAP: Array<{ id: ActivityId; keywords: string[] }> = [
  {
    id: 'alcohol',
    keywords: [
      'alcohol',
      'beer',
      'wine',
      'whiskey',
      'whisky',
      'vodka',
      'cocktail',
      'drank',
      'drinking',
      'drunk',
      'booze',
      'liquor',
    ],
  },
  {
    id: 'late_meal',
    keywords: [
      'late meal',
      'late dinner',
      'heavy meal',
      'ate late',
      'eat late',
      'late food',
      'midnight snack',
      'supper late',
      'dinner late',
      'ate heavy',
      'overeating',
      'overate',
    ],
  },
  {
    id: 'exercise',
    keywords: [
      'exercise',
      'workout',
      'gym',
      'running',
      'jog',
      'jogging',
      'lift',
      'lifting',
      'cardio',
      'training',
      'sports',
      'swim',
      'bike',
      'cycling',
    ],
  },
  {
    id: 'stress',
    keywords: [
      'stress',
      'stressed',
      'anxiety',
      'anxious',
      'worried',
      'worry',
      'panic',
      'overwhelmed',
      'tension',
      'tense',
    ],
  },
  {
    id: 'congested',
    keywords: [
      'congested',
      'congestion',
      'stuffy',
      'blocked nose',
      'runny nose',
      'cold',
      'flu',
      'sick',
      'allergy',
      'allergies',
      'sinus',
      'sneezing',
    ],
  },
  {
    id: 'back_sleeper',
    keywords: [
      'back sleep',
      'slept on my back',
      'sleep on my back',
      'slept on back',
      'sleeping on back',
      'supine',
      'on my back',
    ],
  },
  {
    id: 'caffeine',
    keywords: [
      'caffeine',
      'coffee',
      'espresso',
      'energy drink',
      'red bull',
      'late tea',
      'black tea',
      'soda',
      'cola',
    ],
  },
  {
    id: 'irregular_schedule',
    keywords: [
      'irregular',
      'shift work',
      'night shift',
      'jet lag',
      'travel',
      'stayed up',
      'all nighter',
      'late night',
      'insomnia',
      'couldnt sleep',
      "couldn't sleep",
      'weird schedule',
    ],
  },
  {
    id: 'smoking',
    keywords: ['smoking', 'smoked', 'cigarette', 'vape', 'vaping', 'nicotine', 'tobacco'],
  },
  {
    id: 'screen_time',
    keywords: [
      'screen',
      'phone in bed',
      'scrolling',
      'netflix',
      'youtube',
      'tiktok',
      'gaming',
      'video game',
      'laptop late',
      'tv late',
      'blue light',
    ],
  },
  {
    id: 'dry_air',
    keywords: ['dry air', 'dry room', 'humidifier', 'dry throat', 'dry nose', 'ac on', 'aircon'],
  },
  {
    id: 'mouth_breathing',
    keywords: [
      'mouth breath',
      'mouth breathing',
      'breathe through mouth',
      'breathing through mouth',
      'open mouth',
      'dry mouth',
    ],
  },
  {
    id: 'medications',
    keywords: [
      'medication',
      'medicine',
      'meds',
      'sedative',
      'sleeping pill',
      'antihistamine',
      'pill',
      'pills',
      'tranquilizer',
    ],
  },
  {
    id: 'dehydrated',
    keywords: ['dehydrated', 'dehydration', 'thirsty', 'didnt drink water', "didn't drink water", 'dry'],
  },
];

export interface ParsedCheckIn {
  activities: ActivityId[];
  matchedKeywords: string[];
  freeText: string;
}

/**
 * Rule-based keyword parse of free-text "What did you do today?" answers.
 */
export function parseCheckInText(raw: string): ParsedCheckIn {
  const freeText = raw.trim();
  if (!freeText) {
    return { activities: [], matchedKeywords: [], freeText: '' };
  }

  const haystack = freeText.toLowerCase();
  const activities: ActivityId[] = [];
  const matchedKeywords: string[] = [];

  for (const entry of KEYWORD_MAP) {
    const hit = entry.keywords.find((kw) => haystack.includes(kw.toLowerCase()));
    if (hit) {
      activities.push(entry.id);
      matchedKeywords.push(hit);
    }
  }

  return { activities, matchedKeywords, freeText };
}

export function describeMatchedActivities(activities: ActivityId[]): string[] {
  const labels: Partial<Record<ActivityId, string>> = {
    alcohol: 'Alcohol',
    late_meal: 'Late / heavy meal',
    exercise: 'Exercise',
    stress: 'Stress',
    congested: 'Congestion / illness',
    back_sleeper: 'Back sleeping',
    caffeine: 'Caffeine',
    irregular_schedule: 'Irregular schedule',
    smoking: 'Smoking / vaping',
    screen_time: 'Late screens',
    dry_air: 'Dry air',
    mouth_breathing: 'Mouth breathing',
    medications: 'Medication',
    dehydrated: 'Dehydration',
  };
  return activities.map((id) => labels[id] ?? id);
}

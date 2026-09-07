import {
  ActivityId,
  MouthBreathingAnswer,
  SleepFeeling,
  SleepHoursBucket,
} from '../types';

export interface ActivityOption {
  id: ActivityId;
  label: string;
  icon: string;
  hint: string;
}

export const ACTIVITY_OPTIONS: ActivityOption[] = [
  {
    id: 'alcohol',
    label: 'Alcohol last night',
    icon: 'wine-glass-alt',
    hint: 'Evening drinks can relax throat muscles',
  },
  {
    id: 'late_meal',
    label: 'Late or heavy meal',
    icon: 'utensils',
    hint: 'Eating close to bedtime can worsen reflux and snoring',
  },
  {
    id: 'exercise',
    label: 'Exercise today',
    icon: 'running',
    hint: 'Activity helps sleep, but timing matters',
  },
  {
    id: 'stress',
    label: 'High stress / anxiety',
    icon: 'brain',
    hint: 'Tension can affect breathing during sleep',
  },
  {
    id: 'congested',
    label: 'Congested or sick',
    icon: 'head-side-cough',
    hint: 'Nasal blockage often increases snoring',
  },
  {
    id: 'back_sleeper',
    label: 'Slept on my back',
    icon: 'bed',
    hint: 'Back sleeping lets the tongue block the airway',
  },
  {
    id: 'caffeine',
    label: 'Caffeine late in the day',
    icon: 'coffee',
    hint: 'Stimulants can fragment sleep quality',
  },
  {
    id: 'irregular_schedule',
    label: 'Irregular sleep schedule',
    icon: 'calendar-alt',
    hint: 'Shift work or travel disrupts sleep rhythm',
  },
  {
    id: 'smoking',
    label: 'Smoking / vaping',
    icon: 'smoking',
    hint: 'Irritates airways and increases snoring risk',
  },
  {
    id: 'screen_time',
    label: 'Late screen time',
    icon: 'mobile-alt',
    hint: 'Blue light delays sleep and fragments rest',
  },
  {
    id: 'dry_air',
    label: 'Dry bedroom air',
    icon: 'wind',
    hint: 'Dry air can irritate the throat overnight',
  },
  {
    id: 'mouth_breathing',
    label: 'Mouth breathing',
    icon: 'comment',
    hint: 'Mouth breathing often worsens snoring',
  },
  {
    id: 'medications',
    label: 'Sedating medication',
    icon: 'pills',
    hint: 'Some meds relax airway muscles',
  },
  {
    id: 'dehydrated',
    label: 'Felt dehydrated',
    icon: 'tint',
    hint: 'Dry throat tissues can vibrate more',
  },
];

export const SLEEP_FEELING_OPTIONS: { id: SleepFeeling; label: string }[] = [
  { id: 'rested', label: 'Rested' },
  { id: 'okay', label: 'Okay' },
  { id: 'tired', label: 'Tired' },
  { id: 'exhausted', label: 'Exhausted' },
];

export const SLEEP_HOURS_OPTIONS: { id: SleepHoursBucket; label: string }[] = [
  { id: 'under_5', label: '< 5 hrs' },
  { id: '5_to_6', label: '5–6 hrs' },
  { id: '7_to_8', label: '7–8 hrs' },
  { id: 'over_8', label: '8+ hrs' },
];

export const MOUTH_BREATHING_OPTIONS: { id: MouthBreathingAnswer; label: string }[] = [
  { id: 'no', label: 'No' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'yes', label: 'Yes' },
];

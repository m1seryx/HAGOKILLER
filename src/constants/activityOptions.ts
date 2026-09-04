import { ActivityId } from '../types';

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
];

import { SleepEvent, DashboardData, DailyStats, MonthlyStats } from '../types';
import moment from 'moment';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from '../utils/statsCalculator';

// Realistic mock sleep data — 90 days of hardcoded events
// Story: starts with bad snoring, peaks dangerously mid-period, slowly improves
const MOCK_DAILY_PLAN: { eventsPerDay: number; avgDuration: number; interventionRate: number }[] = [
  // Days 0-6 (today = index 0, most recent first)
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.6 }, // today
  { eventsPerDay: 6,  avgDuration: 45, interventionRate: 0.7 },
  { eventsPerDay: 4,  avgDuration: 38, interventionRate: 0.5 },
  { eventsPerDay: 7,  avgDuration: 50, interventionRate: 0.7 },
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.6 },
  { eventsPerDay: 3,  avgDuration: 30, interventionRate: 0.4 },
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  // Days 7-13
  { eventsPerDay: 8,  avgDuration: 55, interventionRate: 0.8 },
  { eventsPerDay: 9,  avgDuration: 58, interventionRate: 0.8 },
  { eventsPerDay: 7,  avgDuration: 52, interventionRate: 0.7 },
  { eventsPerDay: 11, avgDuration: 70, interventionRate: 0.9 }, // danger
  { eventsPerDay: 12, avgDuration: 75, interventionRate: 0.9 }, // danger
  { eventsPerDay: 10, avgDuration: 65, interventionRate: 0.8 },
  { eventsPerDay: 9,  avgDuration: 60, interventionRate: 0.8 },
  // Days 14-20
  { eventsPerDay: 13, avgDuration: 80, interventionRate: 1.0 }, // peak danger
  { eventsPerDay: 14, avgDuration: 85, interventionRate: 1.0 }, // peak danger
  { eventsPerDay: 12, avgDuration: 78, interventionRate: 0.9 },
  { eventsPerDay: 11, avgDuration: 72, interventionRate: 0.9 },
  { eventsPerDay: 10, avgDuration: 66, interventionRate: 0.8 },
  { eventsPerDay: 8,  avgDuration: 56, interventionRate: 0.7 },
  { eventsPerDay: 7,  avgDuration: 50, interventionRate: 0.7 },
  // Days 21-27
  { eventsPerDay: 6,  avgDuration: 46, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.5 },
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  { eventsPerDay: 4,  avgDuration: 36, interventionRate: 0.5 },
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.5 },
  { eventsPerDay: 3,  avgDuration: 28, interventionRate: 0.4 },
  { eventsPerDay: 4,  avgDuration: 35, interventionRate: 0.4 },
  // Days 28-34
  { eventsPerDay: 2,  avgDuration: 22, interventionRate: 0.3 },
  { eventsPerDay: 3,  avgDuration: 27, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 20, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 15, interventionRate: 0.2 }, // normal
  { eventsPerDay: 2,  avgDuration: 18, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 14, interventionRate: 0.1 },
  { eventsPerDay: 2,  avgDuration: 20, interventionRate: 0.2 },
  // Days 35-41
  { eventsPerDay: 3,  avgDuration: 25, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 19, interventionRate: 0.2 },
  { eventsPerDay: 4,  avgDuration: 33, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 28, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 21, interventionRate: 0.2 },
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 36, interventionRate: 0.4 },
  // Days 42-48
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  { eventsPerDay: 7,  avgDuration: 50, interventionRate: 0.7 },
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.5 },
  { eventsPerDay: 6,  avgDuration: 46, interventionRate: 0.6 },
  { eventsPerDay: 8,  avgDuration: 55, interventionRate: 0.7 },
  { eventsPerDay: 7,  avgDuration: 52, interventionRate: 0.7 },
  { eventsPerDay: 6,  avgDuration: 48, interventionRate: 0.6 },
  // Days 49-55
  { eventsPerDay: 5,  avgDuration: 41, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 35, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 29, interventionRate: 0.3 },
  { eventsPerDay: 4,  avgDuration: 33, interventionRate: 0.4 },
  { eventsPerDay: 5,  avgDuration: 38, interventionRate: 0.5 },
  { eventsPerDay: 3,  avgDuration: 26, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 20, interventionRate: 0.2 },
  // Days 56-62
  { eventsPerDay: 9,  avgDuration: 60, interventionRate: 0.8 },
  { eventsPerDay: 10, avgDuration: 65, interventionRate: 0.8 },
  { eventsPerDay: 8,  avgDuration: 56, interventionRate: 0.7 },
  { eventsPerDay: 7,  avgDuration: 51, interventionRate: 0.7 },
  { eventsPerDay: 9,  avgDuration: 62, interventionRate: 0.8 },
  { eventsPerDay: 6,  avgDuration: 47, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.5 },
  // Days 63-69
  { eventsPerDay: 4,  avgDuration: 36, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 28, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 22, interventionRate: 0.2 },
  { eventsPerDay: 3,  avgDuration: 26, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 19, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 13, interventionRate: 0.1 },
  { eventsPerDay: 2,  avgDuration: 17, interventionRate: 0.2 },
  // Days 70-76
  { eventsPerDay: 3,  avgDuration: 24, interventionRate: 0.3 },
  { eventsPerDay: 4,  avgDuration: 32, interventionRate: 0.4 },
  { eventsPerDay: 5,  avgDuration: 39, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 34, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 27, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 21, interventionRate: 0.2 },
  { eventsPerDay: 4,  avgDuration: 33, interventionRate: 0.4 },
  // Days 77-83
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.5 },
  { eventsPerDay: 7,  avgDuration: 51, interventionRate: 0.7 },
  { eventsPerDay: 6,  avgDuration: 47, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 41, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 37, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 30, interventionRate: 0.3 },
  // Days 84-89
  { eventsPerDay: 2,  avgDuration: 23, interventionRate: 0.2 },
  { eventsPerDay: 3,  avgDuration: 26, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 18, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 12, interventionRate: 0.1 },
  { eventsPerDay: 2,  avgDuration: 16, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 11, interventionRate: 0.1 },
];

// Peak snoring hours — realistic sleep-time distribution
const PEAK_HOURS = [22, 23, 0, 1, 2, 3, 4, 1, 2, 3, 23, 0, 2, 1, 3];

export const generateMockSleepEvents = (days: number = 90): SleepEvent[] => {
  const events: SleepEvent[] = [];
  const now = moment();

  for (let d = 0; d < Math.min(days, MOCK_DAILY_PLAN.length); d++) {
    const plan = MOCK_DAILY_PLAN[d];
    const dayStart = now.clone().subtract(d, 'days').startOf('day');

    for (let i = 0; i < plan.eventsPerDay; i++) {
      const hour = PEAK_HOURS[(d + i) % PEAK_HOURS.length];
      const minute = (i * 13 + d * 7) % 60;
      const second = (i * 11 + d * 3) % 60;
      const eventTime = dayStart.clone().hours(hour).minutes(minute).seconds(second);

      // Duration varies ±20% around avgDuration
      const variance = Math.floor((((i * 7 + d * 3) % 40) - 20) * (plan.avgDuration * 0.2) / 20);
      const duration = Math.max(5, plan.avgDuration + variance);

      const severityVal = (i + d) % 10;
      const severityLevel: 'low' | 'medium' | 'high' =
        severityVal < 5 ? 'low' : severityVal < 8 ? 'medium' : 'high';

      const triggered = (i / plan.eventsPerDay) < plan.interventionRate;

      events.push({
        id: `event-${d}-${i}`,
        timestamp: eventTime.valueOf(),
        duration,
        severity: severityLevel,
        interventionTriggered: triggered,
        interventionDuration: triggered ? 10 + ((i * 5 + d) % 20) : 0,
      });
    }
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
};

// Calculate dashboard data from sleep events
export const calculateDashboardData = (events: SleepEvent[]): DashboardData => {
  const now = moment();
  const todayStr = now.format('YYYY-MM-DD');
  const thisWeekStart = now.clone().subtract(6, 'days').startOf('day');

  // Today's stats
  const today = calculateDailyStats(events, todayStr);

  // This week's stats (last 7 days)
  const thisWeek: DailyStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = now
      .clone()
      .subtract(i, 'days')
      .format('YYYY-MM-DD');
    thisWeek.push(calculateDailyStats(events, date));
  }

  // This month's stats
  const thisMonthStr = now.format('YYYY-MM');
  const thisMonth = calculateMonthlyStats(events, thisMonthStr);

  return {
    today,
    thisWeek,
    thisMonth,
    allData: events,
  };
};

// Simulated BLE service (to be replaced with actual BLE communication)
export class MockBLEService {
  private mockEvents: SleepEvent[] = generateMockSleepEvents();

  async connect(): Promise<boolean> {
    // Simulate connection delay
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000);
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 500);
    });
  }

  async fetchSleepEvents(): Promise<SleepEvent[]> {
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.mockEvents);
      }, 800);
    });
  }

  async addNewEvent(event: SleepEvent): Promise<void> {
    this.mockEvents.push(event);
  }

  getIsConnected(): boolean {
    return true;
  }
}

// Get sample recommendations based on current data
export const getSampleRecommendations = () => {
  return {
    normal: {
      title: 'Sleep Health: Normal',
      description: 'Your sleep quality is within normal range.',
      actions: [
        'Maintain consistent sleep schedule',
        'Keep bedroom cool and dark',
        'Avoid screens before bed',
      ],
    },
    bad: {
      title: 'Sleep Health: Elevated',
      description: 'Your snoring frequency is higher than normal.',
      actions: [
        'Try sleeping on your side',
        'Consider weight management',
        'Use a humidifier in your bedroom',
      ],
    },
    danger: {
      title: 'Sleep Health: Critical',
      description: 'Your snoring frequency requires professional attention.',
      actions: [
        'Schedule appointment with sleep specialist',
        'Consider sleep study evaluation',
        'Track symptoms carefully',
      ],
    },
  };
};

import { SleepEvent, DashboardData, DailyStats, MonthlyStats } from '../types';
import moment from 'moment';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from '../utils/statsCalculator';

// Generate mock data for development and demo
export const generateMockSleepEvents = (days: number = 30): SleepEvent[] => {
  const events: SleepEvent[] = [];
  const now = moment();

  // Fixed seed-like pattern so data is always realistic and non-zero
  const dailyEventCounts = [5, 3, 7, 2, 8, 4, 6, 3, 9, 5, 2, 7, 4, 6, 3, 8, 5, 2, 7, 4, 6, 3, 9, 5, 2, 7, 4, 6, 3, 8];

  for (let d = 0; d < days; d++) {
    const dayStart = now.clone().subtract(d, 'days').startOf('day');
    const eventsPerDay = dailyEventCounts[d % dailyEventCounts.length];

    for (let i = 0; i < eventsPerDay; i++) {
      const hour = (22 + Math.floor((i * 37 + d * 13) % 8)) % 24;
      const minute = (i * 17 + d * 7) % 60;
      const second = (i * 11 + d * 3) % 60;

      const eventTime = dayStart.clone().hours(hour).minutes(minute).seconds(second);
      const severityVal = (i + d) % 10;
      const severityLevel: 'low' | 'medium' | 'high' =
        severityVal < 6 ? 'low' : severityVal < 9 ? 'medium' : 'high';

      events.push({
        id: `event-${d}-${i}`,
        timestamp: eventTime.valueOf(),
        duration: 5 + ((i * 23 + d * 17) % 120),
        severity: severityLevel,
        interventionTriggered: (i + d) % 3 !== 0,
        interventionDuration: (i + d) % 3 !== 0 ? 10 + ((i * 7 + d) % 20) : 0,
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

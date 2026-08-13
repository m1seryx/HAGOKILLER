import { SleepEvent, DashboardData, DailyStats, BLEDevice } from '../types';
import moment from 'moment';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from '../utils/statsCalculator';
import { isValidPairingPin } from '../utils/pinValidation';
import { loadPairedDevice, savePairedDevice, setDevicePaired } from './userStorage';

export interface DeviceSettings {
  snoreThreshold: number;
  pumpDuration: number;
}

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

  // This month's stats + trend vs previous month
  const thisMonthStr = now.format('YYYY-MM');
  const previousMonthStr = now.clone().subtract(1, 'month').format('YYYY-MM');
  const thisMonth = calculateMonthlyStats(events, thisMonthStr);
  const previousMonth = calculateMonthlyStats(events, previousMonthStr);
  thisMonth.trend = calculateTrend([previousMonth, thisMonth]);

  return {
    today,
    thisWeek,
    thisMonth,
    allData: events,
  };
};

/**
 * BLE manager for the smart pillow.
 * React Native supports real Bluetooth via `react-native-ble-plx` in a
 * development/production build (not Expo Go). This prototype uses a mock
 * GATT layer with the same pair / connect / disconnect API.
 */
export class MockBLEService {
  private mockEvents: SleepEvent[] = generateMockSleepEvents();
  private connected = false;
  private pairedDevice: BLEDevice | null = null;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: SleepEvent) => void>();
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private liveTimeout: ReturnType<typeof setTimeout> | null = null;
  private settings: DeviceSettings = {
    snoreThreshold: 3,
    pumpDuration: 12,
  };

  private nearbyDevices: BLEDevice[] = [
    {
      id: 'esp32-pillow-001',
      name: 'SmartPillow-ESP32',
      bleAddress: 'A4:CF:12:8B:44:01',
      isConnected: false,
      signalStrength: -48,
    },
    {
      id: 'esp32-pillow-002',
      name: 'HAGOKILLER Pillow',
      bleAddress: 'A4:CF:12:8B:44:19',
      isConnected: false,
      signalStrength: -62,
    },
  ];

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeEvents(listener: (event: SleepEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private createLiveSnoreEvent(): SleepEvent {
    const roll = Date.now() % 10;
    const severity: SleepEvent['severity'] = roll < 5 ? 'low' : roll < 8 ? 'medium' : 'high';
    const duration = 18 + (Date.now() % 42);
    const triggered = severity !== 'low';
    return {
      id: `live-${Date.now()}`,
      timestamp: Date.now(),
      duration,
      severity,
      interventionTriggered: triggered,
      interventionDuration: triggered ? this.settings.pumpDuration : 0,
    };
  }

  private emitLiveEvent() {
    if (!this.connected) return;
    const event = this.createLiveSnoreEvent();
    this.mockEvents.unshift(event);
    this.eventListeners.forEach((listener) => listener(event));
    this.notify();
  }

  private startLiveMonitoring() {
    this.stopLiveMonitoring();
    this.liveTimeout = setTimeout(() => {
      this.emitLiveEvent();
      this.liveTimer = setInterval(() => this.emitLiveEvent(), 45000);
    }, 8000);
  }

  private stopLiveMonitoring() {
    if (this.liveTimeout) {
      clearTimeout(this.liveTimeout);
      this.liveTimeout = null;
    }
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
  }

  async restoreSession(): Promise<void> {
    const saved = await loadPairedDevice();
    if (saved) {
      this.pairedDevice = {
        ...saved,
        isConnected: this.connected,
      };
      this.notify();
    }
  }

  async scanForDevices(): Promise<BLEDevice[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          this.nearbyDevices.map((device) => ({
            ...device,
            isConnected: this.connected && this.pairedDevice?.id === device.id,
          })),
        );
      }, 900);
    });
  }

  async pair(device: BLEDevice, pin: string): Promise<BLEDevice> {
    if (!isValidPairingPin(pin)) {
      throw new Error('Enter the 7-digit PIN from your pillow label.');
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (pin !== '1234567' && pin !== '0000000') {
          reject(new Error('Incorrect PIN. Check the sticker under the pillow.'));
          return;
        }

        this.connected = true;
        this.pairedDevice = { ...device, isConnected: true };
        savePairedDevice({
          id: device.id,
          name: device.name,
          bleAddress: device.bleAddress,
          signalStrength: device.signalStrength,
        }).catch(() => undefined);
        this.startLiveMonitoring();
        this.notify();
        resolve(this.pairedDevice);
      }, 900);
    });
  }

  async connect(): Promise<boolean> {
    if (!this.pairedDevice) {
      await this.restoreSession();
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!this.pairedDevice) {
          reject(new Error('No paired pillow. Pair a device first.'));
          return;
        }
        this.connected = true;
        this.pairedDevice = { ...this.pairedDevice, isConnected: true };
        this.startLiveMonitoring();
        this.notify();
        resolve(true);
      }, 700);
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.stopLiveMonitoring();
        this.connected = false;
        if (this.pairedDevice) {
          this.pairedDevice = { ...this.pairedDevice, isConnected: false };
        }
        this.notify();
        resolve();
      }, 400);
    });
  }

  async unpair(): Promise<void> {
    await this.disconnect();
    this.pairedDevice = null;
    await setDevicePaired(false);
    this.notify();
  }

  getPairedDevice(): BLEDevice | null {
    return this.pairedDevice ? { ...this.pairedDevice, isConnected: this.connected } : null;
  }

  async fetchSleepEvents(): Promise<SleepEvent[]> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve([...this.mockEvents].sort((a, b) => b.timestamp - a.timestamp));
        } catch (error) {
          reject(error);
        }
      }, 800);
    });
  }

  async addNewEvent(event: SleepEvent): Promise<void> {
    this.mockEvents.push(event);
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    const before = this.mockEvents.length;
    this.mockEvents = this.mockEvents.filter((event) => event.id !== eventId);
    return this.mockEvents.length < before;
  }

  async clearEvents(): Promise<void> {
    this.mockEvents = [];
  }

  async saveDeviceSettings(settings: DeviceSettings): Promise<DeviceSettings> {
    if (
      !Number.isFinite(settings.snoreThreshold) ||
      settings.snoreThreshold < 1 ||
      settings.snoreThreshold > 10
    ) {
      throw new Error('Snore threshold must be between 1 and 10');
    }

    if (
      !Number.isFinite(settings.pumpDuration) ||
      settings.pumpDuration < 5 ||
      settings.pumpDuration > 30
    ) {
      throw new Error('Pump duration must be between 5 and 30 seconds');
    }

    this.settings = {
      snoreThreshold: Math.round(settings.snoreThreshold),
      pumpDuration: Math.round(settings.pumpDuration),
    };

    return { ...this.settings };
  }

  getDeviceSettings(): DeviceSettings {
    return { ...this.settings };
  }

  getIsConnected(): boolean {
    return this.connected;
  }

  isPaired(): boolean {
    return this.pairedDevice !== null;
  }
}

/** Shared BLE session so Settings, Dashboard, and pairing stay in sync. */
export const bleService = new MockBLEService();

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

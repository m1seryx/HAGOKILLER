export type SleepEventSource = 'esp32' | 'mock' | 'seed';

export interface SleepEvent {
  id: string;
  timestamp: number; // Unix timestamp in milliseconds
  duration: number; // Duration in seconds
  severity: 'low' | 'medium' | 'high'; // Based on snoring intensity
  interventionTriggered: boolean;
  interventionDuration: number; // Duration of air pump activation in seconds
  /** Where the event came from. ESP32 BLE notifies use 'esp32'. */
  source?: SleepEventSource;
  /** Firmware PumpMsg.event — 1 = snore/sound */
  eventCode?: number;
  /** Firmware volume 0–10 */
  level?: number;
  /** Firmware microphone RMS */
  rms?: number;
  /** Packed BLE payload as hex, for debug */
  rawPayload?: string | null;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD format
  totalSnoreEvents: number;
  averageDuration: number; // in seconds
  interventionCount: number;
  peakHour: number; // Hour with most snoring (0-23)
  severity: 'normal' | 'bad' | 'danger';
}

export interface MonthlyStats {
  month: string; // YYYY-MM format
  totalSnoreEvents: number;
  averageDuration: number;
  interventionCount: number;
  trend: 'improving' | 'stable' | 'worsening';
  severity: 'normal' | 'bad' | 'danger';
}

export interface DashboardData {
  today: DailyStats;
  thisWeek: DailyStats[];
  thisMonth: MonthlyStats;
  allData: SleepEvent[];
}

export interface RecommendationData {
  severityLevel: 'normal' | 'bad' | 'danger';
  recommendation: string;
  actionItems: string[];
  trendMessage: string;
}

export interface BLEDevice {
  id: string;
  name: string;
  bleAddress: string;
  isConnected: boolean;
  signalStrength: number;
}

export type BLEConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface UserProfile {
  name: string;
  birthdate?: string | null; // YYYY-MM-DD
  sleepGoalHours?: number | null;
  photoUri?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

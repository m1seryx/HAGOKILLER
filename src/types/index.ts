export interface SleepEvent {
  id: string;
  timestamp: number; // Unix timestamp in milliseconds
  duration: number; // Duration in seconds
  severity: 'low' | 'medium' | 'high'; // Based on snoring intensity
  interventionTriggered: boolean;
  interventionDuration: number; // Duration of air pump activation in seconds
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
  isConnected: boolean;
  signalStrength: number;
}

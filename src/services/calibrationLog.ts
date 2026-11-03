import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalibrationLogEntry } from '../types';

const CALIBRATION_LOG_KEY = '@hagokiller_calibration_log';
const MAX_ENTRIES = 100;

type Listener = (entry: CalibrationLogEntry) => void;
const listeners = new Set<Listener>();

export async function loadCalibrationLog(): Promise<CalibrationLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CALIBRATION_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as CalibrationLogEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addCalibrationEntry(
  entry: Omit<CalibrationLogEntry, 'id'>,
): Promise<CalibrationLogEntry> {
  const saved: CalibrationLogEntry = {
    ...entry,
    id: `cal-${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const current = await loadCalibrationLog();
  const next = [saved, ...current].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(CALIBRATION_LOG_KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener(saved));
  return saved;
}

export async function clearCalibrationLog(): Promise<void> {
  await AsyncStorage.removeItem(CALIBRATION_LOG_KEY);
}

export function subscribeCalibrationLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

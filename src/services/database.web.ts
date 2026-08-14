import AsyncStorage from '@react-native-async-storage/async-storage';
import { SleepEvent, UserProfile } from '../types';

const PROFILE_KEY = '@hagokiller_profile';
const PAIRED_KEY = '@hagokiller_paired';
const PAIRED_DEVICE_KEY = '@hagokiller_paired_device';
const NOTIFICATIONS_KEY = '@hagokiller_notifications';
const SETTINGS_KEY = '@hagokiller_device_settings';
const EVENTS_KEY = '@hagokiller_sleep_events';

export interface StoredPairedDevice {
  id: string;
  name: string;
  bleAddress: string;
  signalStrength: number;
}

export interface StoredDeviceSettings {
  snoreThreshold: number;
  pumpDuration: number;
}

const parseJson = async <T,>(key: string): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export async function initDatabase(): Promise<unknown> {
  return true;
}

export async function dbSaveUserProfile(profile: UserProfile): Promise<UserProfile> {
  const payload: UserProfile = {
    ...profile,
    createdAt: profile.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(payload));
  return payload;
}

export async function dbLoadUserProfile(): Promise<UserProfile | null> {
  return parseJson<UserProfile>(PROFILE_KEY);
}

export async function dbSetDevicePaired(paired: boolean): Promise<void> {
  await AsyncStorage.setItem(PAIRED_KEY, paired ? 'true' : 'false');
  if (!paired) {
    await AsyncStorage.removeItem(PAIRED_DEVICE_KEY);
  }
}

export async function dbIsDevicePaired(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PAIRED_KEY);
  if (value === 'true') return true;
  const device = await parseJson<StoredPairedDevice>(PAIRED_DEVICE_KEY);
  return !!device;
}

export async function dbSavePairedDevice(device: StoredPairedDevice): Promise<void> {
  await AsyncStorage.setItem(PAIRED_DEVICE_KEY, JSON.stringify(device));
  await dbSetDevicePaired(true);
}

export async function dbLoadPairedDevice(): Promise<StoredPairedDevice | null> {
  return parseJson<StoredPairedDevice>(PAIRED_DEVICE_KEY);
}

export async function dbLoadNotificationsEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
  return value !== 'false';
}

export async function dbSaveNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
}

export async function dbSaveDeviceSettings(settings: StoredDeviceSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function dbLoadDeviceSettings(): Promise<StoredDeviceSettings | null> {
  return parseJson<StoredDeviceSettings>(SETTINGS_KEY);
}

export async function dbLoadSleepEvents(): Promise<SleepEvent[]> {
  const events = await parseJson<SleepEvent[]>(EVENTS_KEY);
  return Array.isArray(events) ? events.sort((a, b) => b.timestamp - a.timestamp) : [];
}

export async function dbInsertSleepEvent(event: SleepEvent): Promise<void> {
  const events = await dbLoadSleepEvents();
  const next = [event, ...events.filter((item) => item.id !== event.id)];
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(next));
}

export async function persistPillowEvent(event: SleepEvent): Promise<SleepEvent> {
  await dbInsertSleepEvent(event);
  return event;
}

export async function dbReplaceSleepEvents(events: SleepEvent[]): Promise<void> {
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export async function dbDeleteSleepEvent(eventId: string): Promise<boolean> {
  const events = await dbLoadSleepEvents();
  const next = events.filter((event) => event.id !== eventId);
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(next));
  return next.length < events.length;
}

export async function dbClearSleepEvents(): Promise<void> {
  await AsyncStorage.removeItem(EVENTS_KEY);
}

export async function dbClearUserData(): Promise<void> {
  await AsyncStorage.multiRemove([
    PROFILE_KEY,
    PAIRED_KEY,
    PAIRED_DEVICE_KEY,
    NOTIFICATIONS_KEY,
    SETTINGS_KEY,
    EVENTS_KEY,
  ]);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

const PROFILE_KEY = '@hagokiller_profile';
const PAIRED_KEY = '@hagokiller_paired';
const PAIRED_DEVICE_KEY = '@hagokiller_paired_device';
const NOTIFICATIONS_KEY = '@hagokiller_notifications';

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  const payload: UserProfile = {
    ...profile,
    updatedAt: Date.now(),
    createdAt: profile.createdAt ?? Date.now(),
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(payload));
};

export const loadUserProfile = async (): Promise<UserProfile | null> => {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
};

export const setDevicePaired = async (paired: boolean): Promise<void> => {
  await AsyncStorage.setItem(PAIRED_KEY, paired ? 'true' : 'false');
  if (!paired) {
    await AsyncStorage.removeItem(PAIRED_DEVICE_KEY);
  }
};

export const isDevicePaired = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(PAIRED_KEY);
  return value === 'true';
};

export const savePairedDevice = async (device: {
  id: string;
  name: string;
  bleAddress: string;
  signalStrength: number;
}): Promise<void> => {
  await AsyncStorage.setItem(PAIRED_DEVICE_KEY, JSON.stringify(device));
  await setDevicePaired(true);
};

export const loadPairedDevice = async (): Promise<{
  id: string;
  name: string;
  bleAddress: string;
  signalStrength: number;
} | null> => {
  const raw = await AsyncStorage.getItem(PAIRED_DEVICE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const loadNotificationsEnabled = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
  return value !== 'false';
};

export const saveNotificationsEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
};

export const clearUserData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([PROFILE_KEY, PAIRED_KEY, PAIRED_DEVICE_KEY, NOTIFICATIONS_KEY]);
};

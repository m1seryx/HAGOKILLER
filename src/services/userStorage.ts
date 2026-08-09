import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

const PROFILE_KEY = '@hagokiller_profile';
const PAIRED_KEY = '@hagokiller_paired';

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
};

export const isDevicePaired = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(PAIRED_KEY);
  return value === 'true';
};

export const clearUserData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([PROFILE_KEY, PAIRED_KEY]);
};

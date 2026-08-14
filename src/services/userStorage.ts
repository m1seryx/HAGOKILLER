import { UserProfile, SleepEvent } from '../types';
import {
  initDatabase,
  dbSaveUserProfile,
  dbLoadUserProfile,
  dbSetDevicePaired,
  dbIsDevicePaired,
  dbSavePairedDevice,
  dbLoadPairedDevice,
  dbLoadNotificationsEnabled,
  dbSaveNotificationsEnabled,
  dbSaveDeviceSettings,
  dbLoadDeviceSettings,
  dbLoadSleepEvents,
  dbInsertSleepEvent,
  persistPillowEvent as dbPersistPillowEvent,
  dbReplaceSleepEvents,
  dbDeleteSleepEvent,
  dbClearSleepEvents,
  dbClearUserData,
  StoredPairedDevice,
  StoredDeviceSettings,
} from './database';

export { initDatabase };

export const saveUserProfile = (profile: UserProfile) => dbSaveUserProfile(profile);

export const loadUserProfile = () => dbLoadUserProfile();

export const setDevicePaired = (paired: boolean) => dbSetDevicePaired(paired);

export const isDevicePaired = () => dbIsDevicePaired();

export const savePairedDevice = (device: StoredPairedDevice) => dbSavePairedDevice(device);

export const loadPairedDevice = () => dbLoadPairedDevice();

export const loadNotificationsEnabled = () => dbLoadNotificationsEnabled();

export const saveNotificationsEnabled = (enabled: boolean) => dbSaveNotificationsEnabled(enabled);

export const saveDeviceSettings = (settings: StoredDeviceSettings) => dbSaveDeviceSettings(settings);

export const loadDeviceSettings = () => dbLoadDeviceSettings();

export const loadSleepEvents = () => dbLoadSleepEvents();

export const insertSleepEvent = (event: SleepEvent) => dbInsertSleepEvent(event);

export const persistPillowEvent = (event: SleepEvent) => dbPersistPillowEvent(event);

export const replaceSleepEvents = (events: SleepEvent[]) => dbReplaceSleepEvents(events);

export const deleteStoredEvent = (eventId: string) => dbDeleteSleepEvent(eventId);

export const clearStoredEvents = () => dbClearSleepEvents();

export const clearUserData = () => dbClearUserData();

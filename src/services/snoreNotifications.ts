import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SleepEvent } from '../types';
import { loadDeviceSettings, loadNotificationsEnabled, saveNotificationsEnabled } from './userStorage';
import { DEFAULT_DEVICE_SETTINGS } from './deviceSettings';

let notificationsEnabled = true;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function areNotificationsEnabled(): boolean {
  return notificationsEnabled;
}

export async function hydrateNotificationPref(): Promise<boolean> {
  notificationsEnabled = await loadNotificationsEnabled();
  return notificationsEnabled;
}

export async function setupSnoreNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('snore-alerts', {
      name: 'Snore alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c8cff',
      sound: 'default',
    });
  }

  return status === 'granted';
}

export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  if (enabled) {
    const granted = await setupSnoreNotifications();
    if (!granted) {
      notificationsEnabled = false;
      await saveNotificationsEnabled(false);
      return false;
    }
  }

  notificationsEnabled = enabled;
  await saveNotificationsEnabled(enabled);
  return true;
}

async function presentNotification(title: string, body: string, data?: Record<string, string>) {
  if (Platform.OS === 'web') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data,
    },
    trigger: null,
  });
}

/** Only alert when the consecutive threshold is hit or the pump is inflating. */
export function shouldNotifySnoreEvent(event: SleepEvent, snoreThreshold: number): boolean {
  if (event.interventionTriggered) return true;
  if (event.snoreStreak != null && event.snoreStreak >= snoreThreshold) return true;
  return false;
}

export async function notifySnoreDetected(event: SleepEvent): Promise<void> {
  if (!notificationsEnabled) return;

  const settings = await loadDeviceSettings();
  const threshold = settings?.snoreThreshold ?? DEFAULT_DEVICE_SETTINGS.snoreThreshold;
  if (!shouldNotifySnoreEvent(event, threshold)) return;

  const severity = event.severity.charAt(0).toUpperCase() + event.severity.slice(1);
  const streakNote =
    event.snoreStreak != null ? ` (${event.snoreStreak}/${threshold} consecutive snores)` : '';

  const body = event.interventionTriggered
    ? `${severity} snoring threshold reached${streakNote} — pillow inflating for ${event.interventionDuration}s.`
    : `Snoring threshold reached${streakNote}.`;

  await presentNotification('Snoring threshold reached', body, { eventId: event.id });
}

export async function sendTestNotification(): Promise<void> {
  if (!notificationsEnabled) {
    throw new Error('Turn on push notifications first.');
  }

  const granted = await setupSnoreNotifications();
  if (!granted) {
    throw new Error('Notification permission was denied. Enable it in system settings.');
  }

  await presentNotification(
    'Test notification',
    'Snore alerts are working. You will only be notified when your threshold is hit or the pump inflates.',
    { test: 'true' },
  );
}

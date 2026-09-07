import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import moment from 'moment';
import { buildDailyAdviceNotificationBody } from '../utils/recommendations';
import { areNotificationsEnabled, setupSnoreNotifications } from './snoreNotifications';

const DAILY_ADVICE_PREFIX = 'hagokiller-daily-advice-';
const DAILY_ADVICE_CHANNEL = 'daily-advice';
/** Local time for the daily advice notification */
export const DAILY_ADVICE_HOUR = 8;
export const DAILY_ADVICE_MINUTE = 0;
/** How many upcoming days to pre-schedule (unique tip per day) */
const DAYS_AHEAD = 14;

export type AdviceSeverity = 'normal' | 'bad' | 'danger';
export type AdviceTrend = 'improving' | 'stable' | 'worsening';

async function ensureDailyAdviceChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DAILY_ADVICE_CHANNEL, {
    name: 'Daily sleep advice',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#0ea5e9',
    sound: 'default',
  });
}

export async function cancelDailyAdviceNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(DAILY_ADVICE_PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

/**
 * Schedules the next N days of rule-based advice notifications.
 * Works while the app is closed (local Expo notifications).
 * Re-run when the app opens so tips stay aligned with latest severity.
 */
export async function scheduleDailyAdviceNotifications(
  severity: AdviceSeverity = 'normal',
  trend: AdviceTrend = 'stable',
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!areNotificationsEnabled()) {
    await cancelDailyAdviceNotifications();
    return false;
  }

  const granted = await setupSnoreNotifications();
  if (!granted) return false;

  await ensureDailyAdviceChannel();
  await cancelDailyAdviceNotifications();

  const now = moment();

  for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
    const day = now.clone().add(offset, 'days');
    const fireAt = day
      .clone()
      .hour(DAILY_ADVICE_HOUR)
      .minute(DAILY_ADVICE_MINUTE)
      .second(0)
      .millisecond(0);

    // Skip today's slot if it already passed
    if (fireAt.isSameOrBefore(now)) continue;

    const dateStr = day.format('YYYY-MM-DD');
    const { title, body } = buildDailyAdviceNotificationBody(severity, trend, dateStr);
    const truncatedBody = body.length > 220 ? `${body.slice(0, 217)}...` : body;

    await Notifications.scheduleNotificationAsync({
      identifier: `${DAILY_ADVICE_PREFIX}${dateStr}`,
      content: {
        title,
        body: truncatedBody,
        sound: true,
        data: {
          type: 'daily-advice',
          date: dateStr,
          severity,
          trend,
        },
        ...(Platform.OS === 'android' ? { channelId: DAILY_ADVICE_CHANNEL } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt.toDate(),
        channelId: DAILY_ADVICE_CHANNEL,
      },
    });
  }

  return true;
}

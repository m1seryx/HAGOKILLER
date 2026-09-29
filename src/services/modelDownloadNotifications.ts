import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'ai-model-download';
const NOTIFICATION_ID = 'hagokiller-ai-model-download';
const UPDATE_STEP = 10;

let notificationEnabled = false;
let lastQueuedPercent = -1;
let notificationQueue: Promise<void> = Promise.resolve();

const queueNotification = (task: () => Promise<void>): void => {
  notificationQueue = notificationQueue.then(task, task).catch(() => undefined);
};

const showProgress = async (percent: number): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'Downloading on-device AI model',
      body: `${percent}% complete · Keep HAGOKILLER open until the download finishes.`,
      sound: false,
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      data: { type: 'ai-model-download', percent },
    },
    trigger: { channelId: CHANNEL_ID },
  });
};

/** Requests Android notification access and shows the initial model-download status. */
export async function startModelDownloadNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'AI model downloads',
      importance: Notifications.AndroidImportance.LOW,
      lightColor: '#0ea5e9',
    });

    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === 'granted'
      ? existing
      : await Notifications.requestPermissionsAsync();
    notificationEnabled = permission.status === 'granted';
    lastQueuedPercent = notificationEnabled ? 0 : -1;

    if (notificationEnabled) await showProgress(0);
  } catch {
    notificationEnabled = false;
  }
}

/** Updates one quiet notification instead of creating a notification for every byte event. */
export function updateModelDownloadNotification(progress: number): void {
  if (!notificationEnabled) return;
  const rawPercent = Math.max(0, Math.min(99, Math.floor(progress * 100)));
  const percent = Math.floor(rawPercent / UPDATE_STEP) * UPDATE_STEP;
  if (percent <= lastQueuedPercent) return;

  lastQueuedPercent = percent;
  queueNotification(() => showProgress(percent));
}

export async function completeModelDownloadNotification(): Promise<void> {
  if (!notificationEnabled) return;
  await notificationQueue;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'On-device AI model ready',
        body: 'Download complete. Personalized assessments can now run offline.',
        sound: false,
        sticky: false,
        autoDismiss: true,
        data: { type: 'ai-model-download', percent: 100 },
      },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch {
    // A notification failure must never invalidate a completed model download.
  } finally {
    notificationEnabled = false;
    lastQueuedPercent = -1;
  }
}

export async function failModelDownloadNotification(): Promise<void> {
  if (!notificationEnabled) return;
  await notificationQueue;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'AI model download stopped',
        body: 'The model could not be downloaded. Open Assessment to try again.',
        sound: false,
        sticky: false,
        autoDismiss: true,
        data: { type: 'ai-model-download', status: 'failed' },
      },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch {
    // The Assessment screen still displays the download error.
  } finally {
    notificationEnabled = false;
    lastQueuedPercent = -1;
  }
}

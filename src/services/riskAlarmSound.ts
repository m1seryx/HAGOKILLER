import { Platform } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { setupSnoreNotifications } from './snoreNotifications';
import { bleService } from './bleService';

const ALARM = require('../../assets/sounds/risk_alarm.wav');

async function setPillowMicMuted(muted: boolean): Promise<void> {
  try {
    if (!bleService.getIsConnected()) return;
    await bleService.sendDeviceCommand(muted ? 'mute_mic' : 'unmute_mic');
  } catch {
    // Alarm must still ring even if the pillow is offline.
  }
}

/** No hyphens/colons — Android category IDs are picky. */
export const RISK_ALARM_CATEGORY_ID = 'riskalarm';
export const RISK_ALARM_STOP_ACTION = 'STOP_RISK_ALARM';
export const RISK_ALARM_CHANNEL_ID = 'riskalarm';
const NOTIF_ID = 'riskalarmactive';

let playing: Audio.Sound | null = null;
let responseListenerReady = false;
let categoryReady = false;
const listeners = new Set<(active: boolean) => void>();

function notify(active: boolean) {
  listeners.forEach((listener) => listener(active));
}

function finished(status: AVPlaybackStatus): boolean {
  return status.isLoaded && status.didJustFinish === true && status.isLooping !== true;
}

function isRiskAlarmResponse(response: Notifications.NotificationResponse): boolean {
  const content = response.notification.request.content as {
    data?: { type?: string };
    categoryIdentifier?: string;
  };
  if (content.data?.type === 'risk_alarm') return true;
  return content.categoryIdentifier === RISK_ALARM_CATEGORY_ID;
}

export function subscribeRiskAlarm(listener: (active: boolean) => void): () => void {
  listeners.add(listener);
  listener(playing != null);
  return () => {
    listeners.delete(listener);
  };
}

export function isRiskAlarmPlaying(): boolean {
  return playing != null;
}

/** Registers the Android/iOS Stop action used by the ringing alarm notification. */
export async function ensureRiskAlarmCategory(): Promise<void> {
  if (Platform.OS === 'web' || categoryReady) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(RISK_ALARM_CHANNEL_ID, {
      name: 'Risk alarm',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: '#ea580c',
      sound: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }

  await Notifications.setNotificationCategoryAsync(RISK_ALARM_CATEGORY_ID, [
    {
      identifier: RISK_ALARM_STOP_ACTION,
      buttonTitle: 'Stop',
      options: {
        opensAppToForeground: true,
        isDestructive: true,
      },
    },
  ]);
  categoryReady = true;
}

/** Listens for the Stop button / tap on the alarm notification. Call once at app start. */
export function ensureRiskAlarmResponseListener(): () => void {
  if (Platform.OS === 'web' || responseListenerReady) return () => undefined;
  responseListenerReady = true;

  void ensureRiskAlarmCategory().catch(() => undefined);

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (!isRiskAlarmResponse(response)) return;
    if (
      response.actionIdentifier === RISK_ALARM_STOP_ACTION ||
      response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      void stopRiskAlarmSound();
    }
  });

  // App launched from a Stop tap while killed.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response || !isRiskAlarmResponse(response)) return;
      if (
        response.actionIdentifier === RISK_ALARM_STOP_ACTION ||
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        void stopRiskAlarmSound();
      }
    })
    .catch(() => undefined);

  return () => {
    sub.remove();
    responseListenerReady = false;
  };
}

async function showStopNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  const granted = await setupSnoreNotifications();
  if (!granted) return;

  // Re-register every time so Android shows the Stop action on this popup.
  categoryReady = false;
  await ensureRiskAlarmCategory();

  await Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_ID,
    content: {
      title: 'HAGOKILLER ringtone',
      subtitle: 'Risk alarm',
      body: 'Alarm is ringing. Tap Stop below to silence it.',
      categoryIdentifier: RISK_ALARM_CATEGORY_ID,
      sticky: true,
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: 'risk_alarm' },
      ...(Platform.OS === 'android'
        ? {
            channelId: RISK_ALARM_CHANNEL_ID,
            color: '#ea580c',
          }
        : null),
    },
    trigger: null,
  });
}

/** Loops the risk-alert ringtone until stopRiskAlarmSound() is called. */
export async function playRiskAlarmSound(): Promise<void> {
  await stopRiskAlarmSound();

  // Mute pillow listening first so the ringtone is not logged as snoring.
  await setPillowMicMuted(true);

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  const { sound } = await Audio.Sound.createAsync(ALARM, {
    shouldPlay: true,
    isLooping: true,
    volume: 1,
  });
  playing = sound;
  notify(true);
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!finished(status)) return;
    if (playing === sound) {
      playing = null;
      notify(false);
      void setPillowMicMuted(false);
    }
  });

  await showStopNotification();
}

export async function stopRiskAlarmSound(): Promise<void> {
  const sound = playing;
  playing = null;
  notify(false);

  if (sound) {
    await sound.stopAsync().catch(() => undefined);
    await sound.unloadAsync().catch(() => undefined);
  }

  await setPillowMicMuted(false);

  if (Platform.OS !== 'web') {
    await Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => undefined);
  }
}

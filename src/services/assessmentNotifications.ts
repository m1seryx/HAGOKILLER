import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'personalized-wellness';

export const notifyPersonalizedPlanReady = async (): Promise<void> => {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Personalized wellness plans',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hagosaur finished your wellness plan',
        body: 'Your private personalized actions are ready in Assessment.',
        data: { type: 'assessment-ready' },
      },
      trigger: null,
    });
  } catch {
    // Notification failure must not invalidate a completed local assessment.
  }
};

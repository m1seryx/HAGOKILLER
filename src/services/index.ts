export {
  MockBLEService,
  bleService,
  calculateDashboardData,
  generateMockSleepEvents,
} from './mockBLEService';
export type { DeviceSettings } from './mockBLEService';
export {
  setupSnoreNotifications,
  notifySnoreDetected,
  sendTestNotification,
  setNotificationsEnabled,
  hydrateNotificationPref,
  areNotificationsEnabled,
} from './snoreNotifications';
export {
  saveUserProfile,
  loadUserProfile,
  setDevicePaired,
  isDevicePaired,
  savePairedDevice,
  loadPairedDevice,
  clearUserData,
  loadNotificationsEnabled,
  saveNotificationsEnabled,
} from './userStorage';

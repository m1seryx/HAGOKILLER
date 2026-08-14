export {
  MockBLEService,
  calculateDashboardData,
  generateMockSleepEvents,
} from './mockBLEService';
export type { DeviceSettings } from './mockBLEService';
export { bleService } from './bleService';
export {
  PHONE_SERVICE_UUID,
  PIN_CHAR_UUID,
  AUTH_CHAR_UUID,
  EVENT_CHAR_UUID,
} from './realBleService';
export {
  setupSnoreNotifications,
  notifySnoreDetected,
  sendTestNotification,
  setNotificationsEnabled,
  hydrateNotificationPref,
  areNotificationsEnabled,
} from './snoreNotifications';
export {
  initDatabase,
  saveUserProfile,
  loadUserProfile,
  setDevicePaired,
  isDevicePaired,
  savePairedDevice,
  loadPairedDevice,
  clearUserData,
  loadNotificationsEnabled,
  saveNotificationsEnabled,
  persistPillowEvent,
} from './userStorage';
export {
  parseEsp32PillowPacket,
  sleepEventFromEsp32Packet,
  ESP32_MSG_MAGIC,
  ESP32_EVENT_SOUND,
} from './esp32Protocol';

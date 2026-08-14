import { NativeModules } from 'react-native';
import { MockBLEService } from './mockBLEService';

function hasNativeBle(): boolean {
  // react-native-ble-plx 3.x registers as BlePlx (not BleManager).
  return !!(NativeModules.BlePlx || NativeModules.BleManager || NativeModules.BleClientManager);
}

/**
 * Real BLE when the native module is present (EAS APK / dev client).
 * Expo Go uses the mock pillow so the rest of the app still runs.
 */
function createBleService() {
  if (!hasNativeBle()) {
    return new MockBLEService();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RealBleService } = require('./realBleService') as typeof import('./realBleService');
    return new RealBleService();
  } catch {
    return new MockBLEService();
  }
}

export const isMockBle = !hasNativeBle();
export const bleService = createBleService();

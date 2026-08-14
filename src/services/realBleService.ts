/**
 * Real BLE transport for HAGOKILLER pillow (mic ESP32).
 * Requires a development/production build — not Expo Go.
 *
 * Mic advertises as "HAGOKILLER Pillow"
 * Demo PIN: 1234567
 */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Characteristic, Device, State } from 'react-native-ble-plx';
import { BLEDevice, SleepEvent } from '../types';
import { isValidPairingPin } from '../utils/pinValidation';
import { loadPairedDevice, savePairedDevice, setDevicePaired, persistPillowEvent } from './userStorage';
import { DeviceSettings, MockBLEService } from './mockBLEService';
import { parseEsp32PillowPacket, sleepEventFromEsp32Packet } from './esp32Protocol';

export const PHONE_SERVICE_UUID = '6ba1d001-8e2a-4b7c-9f10-22c0a1b2c3d4';
export const PIN_CHAR_UUID = '6ba1d002-8e2a-4b7c-9f10-22c0a1b2c3d4';
export const AUTH_CHAR_UUID = '6ba1d003-8e2a-4b7c-9f10-22c0a1b2c3d4';
export const EVENT_CHAR_UUID = '6ba1d004-8e2a-4b7c-9f10-22c0a1b2c3d4';

const DEVICE_NAME_MATCH = 'HAGOKILLER';
const DEMO_PINS = new Set(['1234567', '0000000']);

const toBase64 = (text: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = Array.from(text).map((c) => c.charCodeAt(0));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
};

const fromBase64 = (value: string): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === '=') break;
    const val = chars.indexOf(c);
    if (val < 0) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(output);
};

export class RealBleService {
  private manager = new BleManager();
  private data = new MockBLEService({ seedIfEmpty: false });
  private connected = false;
  private pairedDevice: BLEDevice | null = null;
  private activeDevice: Device | null = null;
  private listeners = new Set<() => void>();
  private eventMonitor: { remove: () => void } | null = null;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const unsubData = this.data.subscribe(() => this.notify());
    return () => {
      this.listeners.delete(listener);
      unsubData();
    };
  }

  subscribeEvents(listener: (event: SleepEvent) => void): () => void {
    return this.data.subscribeEvents(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private async ensurePermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const api = Platform.Version;
    if (typeof api === 'number' && api >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const denied = Object.values(result).some((v) => v !== PermissionsAndroid.RESULTS.GRANTED);
      if (denied) throw new Error('Bluetooth permission denied.');
    } else {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Location permission is required for Bluetooth scan.');
      }
    }
  }

  private async waitForPoweredOn(timeoutMs = 8000): Promise<void> {
    const state = await this.manager.state();
    if (state === State.PoweredOn) return;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        sub.remove();
        reject(new Error('Turn on Bluetooth and try again.'));
      }, timeoutMs);
      const sub = this.manager.onStateChange((next) => {
        if (next === State.PoweredOn) {
          clearTimeout(timer);
          sub.remove();
          resolve();
        }
      }, true);
    });
  }

  async restoreSession(): Promise<void> {
    await this.data.restoreSession();
    const saved = await loadPairedDevice();
    if (saved?.id?.startsWith('demo-pillow-') || saved?.id?.startsWith('esp32-pillow-')) {
      await setDevicePaired(false);
      this.pairedDevice = null;
      this.notify();
      return;
    }
    if (saved) {
      this.pairedDevice = { ...saved, isConnected: this.connected };
      this.notify();
    }
  }

  async scanForDevices(): Promise<BLEDevice[]> {
    await this.ensurePermissions();
    await this.waitForPoweredOn();

    const found = new Map<string, BLEDevice>();

    return new Promise((resolve, reject) => {
      const finish = (devices: BLEDevice[]) => {
        try {
          this.manager.stopDeviceScan();
        } catch {
          // ignore
        }
        resolve(devices);
      };

      const timer = setTimeout(() => finish(Array.from(found.values())), 6000);

      try {
        // Scan all devices by name. ESP32 128-bit service UUIDs are often missing from adverts.
        this.manager.startDeviceScan(
          null,
          { allowDuplicates: false },
          (error: BleError | null, device: Device | null) => {
            if (error) {
              clearTimeout(timer);
              try {
                this.manager.stopDeviceScan();
              } catch {
                // ignore
              }
              // Fallback: scan without service filter
              this.scanByName(found, resolve, reject);
              return;
            }
            if (!device) return;
            const name = device.name || device.localName || '';
            if (!name.toUpperCase().includes(DEVICE_NAME_MATCH) && !name.includes('SmartPillow')) {
              return;
            }
            found.set(device.id, {
              id: device.id,
              name: name || 'HAGOKILLER Pillow',
              bleAddress: device.id,
              isConnected: false,
              signalStrength: device.rssi ?? -70,
            });
          },
        );
      } catch (err) {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error('Bluetooth scan failed.'));
      }
    });
  }

  private scanByName(
    found: Map<string, BLEDevice>,
    resolve: (devices: BLEDevice[]) => void,
    reject: (err: Error) => void,
  ) {
    const timer = setTimeout(() => {
      try {
        this.manager.stopDeviceScan();
      } catch {
        // ignore
      }
      resolve(Array.from(found.values()));
    }, 5000);

    try {
      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          clearTimeout(timer);
          try {
            this.manager.stopDeviceScan();
          } catch {
            // ignore
          }
          reject(new Error(error.message || 'Bluetooth scan failed.'));
          return;
        }
        if (!device) return;
        const name = device.name || device.localName || '';
        if (!name.toUpperCase().includes(DEVICE_NAME_MATCH) && !name.includes('SmartPillow')) return;
        found.set(device.id, {
          id: device.id,
          name: name || 'HAGOKILLER Pillow',
          bleAddress: device.id,
          isConnected: false,
          signalStrength: device.rssi ?? -70,
        });
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error('Bluetooth scan failed.'));
    }
  }

  async pair(device: BLEDevice, pin: string): Promise<BLEDevice> {
    if (!isValidPairingPin(pin)) {
      throw new Error('Enter the 7-digit PIN from your pillow label.');
    }
    if (!DEMO_PINS.has(pin) && pin !== '1234567') {
      // still send to device — device decides; keep client-side tip for demo pins
    }

    await this.ensurePermissions();
    await this.waitForPoweredOn();

    try {
      this.manager.stopDeviceScan();
    } catch {
      // ignore
    }

    const connected = await this.manager.connectToDevice(device.id, { autoConnect: false });
    await connected.discoverAllServicesAndCharacteristics();
    this.activeDevice = connected;

    await connected.writeCharacteristicWithResponseForService(
      PHONE_SERVICE_UUID,
      PIN_CHAR_UUID,
      toBase64(pin),
    );

    // Read auth flag
    const auth = await connected.readCharacteristicForService(PHONE_SERVICE_UUID, AUTH_CHAR_UUID);
    const bytes = auth.value ? fromBase64(auth.value) : new Uint8Array([0]);
    if (!bytes.length || bytes[0] !== 1) {
      await connected.cancelConnection();
      this.activeDevice = null;
      throw new Error('Incorrect PIN. Check the sticker under the pillow.');
    }

    this.connected = true;
    this.pairedDevice = { ...device, name: device.name || 'HAGOKILLER Pillow', isConnected: true };
    await savePairedDevice({
      id: device.id,
      name: this.pairedDevice.name,
      bleAddress: device.bleAddress || device.id,
      signalStrength: device.signalStrength,
    });
    await setDevicePaired(true);
    this.monitorEvents(connected);
    this.notify();
    return this.pairedDevice;
  }

  private monitorEvents(device: Device) {
    this.eventMonitor?.remove();
    this.eventMonitor = device.monitorCharacteristicForService(
      PHONE_SERVICE_UUID,
      EVENT_CHAR_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        this.handleEventPayload(characteristic);
      },
    );
  }

  private handleEventPayload(characteristic: Characteristic) {
    try {
      const bytes = characteristic.value ? fromBase64(characteristic.value) : null;
      if (!bytes) return;

      const packet = parseEsp32PillowPacket(bytes);
      if (!packet) return;

      const event = sleepEventFromEsp32Packet(packet, this.getDeviceSettings().pumpDuration);

      void persistPillowEvent(event)
        .then(() => this.data.addNewEvent(event))
        .then(() => this.notify())
        .catch(() => undefined);
    } catch {
      // ignore malformed payloads
    }
  }

  async connect(): Promise<boolean> {
    if (!this.pairedDevice) await this.restoreSession();
    if (!this.pairedDevice) throw new Error('No paired pillow. Pair a device first.');

    await this.ensurePermissions();
    await this.waitForPoweredOn();

    const connected = await this.manager.connectToDevice(this.pairedDevice.id, { autoConnect: false });
    await connected.discoverAllServicesAndCharacteristics();
    this.activeDevice = connected;
    this.connected = true;
    this.pairedDevice = { ...this.pairedDevice, isConnected: true };
    this.monitorEvents(connected);
    this.notify();
    return true;
  }

  async disconnect(): Promise<void> {
    this.eventMonitor?.remove();
    this.eventMonitor = null;
    if (this.activeDevice) {
      try {
        await this.activeDevice.cancelConnection();
      } catch {
        // ignore
      }
    }
    this.activeDevice = null;
    this.connected = false;
    if (this.pairedDevice) this.pairedDevice = { ...this.pairedDevice, isConnected: false };
    this.notify();
  }

  async unpair(): Promise<void> {
    await this.disconnect();
    this.pairedDevice = null;
    await setDevicePaired(false);
    this.notify();
  }

  getPairedDevice(): BLEDevice | null {
    return this.pairedDevice ? { ...this.pairedDevice, isConnected: this.connected } : null;
  }

  getIsConnected(): boolean {
    return this.connected;
  }

  isPaired(): boolean {
    return this.pairedDevice !== null;
  }

  fetchSleepEvents() {
    return this.data.fetchSleepEvents();
  }

  addNewEvent(event: SleepEvent) {
    return this.data.addNewEvent(event);
  }

  deleteEvent(eventId: string) {
    return this.data.deleteEvent(eventId);
  }

  clearEvents() {
    return this.data.clearEvents();
  }

  saveDeviceSettings(settings: DeviceSettings) {
    return this.data.saveDeviceSettings(settings);
  }

  getDeviceSettings() {
    return this.data.getDeviceSettings();
  }
}

export const isNativeBleAvailable = (): boolean =>
  !!(NativeModules.BleManager || NativeModules.BleClientManager);

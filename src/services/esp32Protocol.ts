import { SleepEvent } from '../types';
import {
  DeviceSettings,
  PUMP_DURATION_MAX_SEC,
  PUMP_DURATION_MIN_SEC,
} from './deviceSettings';

/**
 * Packed BLE notify / ESP-NOW from firmware `PumpMsg` (little-endian):
 *   uint32 magic 0x48474F4B
 *   uint8  event  (1 = snore/sound)
 *   uint8  level  (0–10)
 *   uint16 rms
 *   uint8  pumpSeconds
 *   uint8  streak
 *   uint8  flags  (bit0 = intervention)
 *   uint8  reserved
 */
export const ESP32_MSG_MAGIC = 0x48474f4b;
export const ESP32_EVENT_SOUND = 1;
export const ESP32_FLAG_INTERVENTION = 0x01;
export const ESP32_SETTINGS_MAGIC = 0x48475354;

export const SETTINGS_CHAR_UUID = '6ba1d005-8e2a-4b7c-9f10-22c0a1b2c3d4';

export interface Esp32PillowPacket {
  magic: number;
  eventCode: number;
  level: number;
  rms: number;
  pumpSeconds: number;
  streak: number;
  flags: number;
  rawHex: string;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const writeU32LE = (out: Uint8Array, offset: number, value: number) => {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >> 8) & 0xff;
  out[offset + 2] = (value >> 16) & 0xff;
  out[offset + 3] = (value >> 24) & 0xff;
};

export function parseEsp32PillowPacket(bytes: Uint8Array): Esp32PillowPacket | null {
  if (bytes.length < 8) return null;

  const magic = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
  if (magic !== ESP32_MSG_MAGIC) return null;

  return {
    magic,
    eventCode: bytes[4],
    level: bytes[5],
    rms: bytes[6] | (bytes[7] << 8),
    pumpSeconds: bytes.length >= 9 ? bytes[8] : 0,
    streak: bytes.length >= 10 ? bytes[9] : 0,
    flags: bytes.length >= 11 ? bytes[10] : 0,
    rawHex: toHex(bytes.slice(0, Math.min(bytes.length, 12))),
  };
}

export function encodePillowSettings(settings: DeviceSettings): Uint8Array {
  const out = new Uint8Array(8);
  writeU32LE(out, 0, ESP32_SETTINGS_MAGIC);
  out[4] = settings.snoreThreshold & 0xff;
  out[5] = settings.pumpDuration & 0xff;
  out[6] = settings.micShift & 0xff;
  out[7] = 0;
  return out;
}

export function sleepEventFromEsp32Packet(
  packet: Esp32PillowPacket,
  fallbackPumpSeconds: number,
): SleepEvent {
  const level = Math.max(0, Math.min(10, packet.level));
  const isSnore = packet.eventCode === ESP32_EVENT_SOUND;
  const severity: SleepEvent['severity'] = level >= 8 ? 'high' : level >= 5 ? 'medium' : 'low';
  const pumpSeconds =
    packet.pumpSeconds >= PUMP_DURATION_MIN_SEC && packet.pumpSeconds <= PUMP_DURATION_MAX_SEC
      ? packet.pumpSeconds
      : Math.max(
          PUMP_DURATION_MIN_SEC,
          Math.min(PUMP_DURATION_MAX_SEC, fallbackPumpSeconds || 12),
        );
  const intervene = (packet.flags & ESP32_FLAG_INTERVENTION) === ESP32_FLAG_INTERVENTION;

  return {
    id: `esp32-${Date.now()}-${packet.rms}-${level}-${packet.streak}`,
    timestamp: Date.now(),
    duration: 12 + level * 4,
    severity,
    interventionTriggered: intervene,
    interventionDuration: intervene ? pumpSeconds : 0,
    source: 'esp32',
    eventCode: packet.eventCode,
    level,
    rms: packet.rms,
    rawPayload: packet.rawHex,
    snoreStreak: packet.streak,
  };
}

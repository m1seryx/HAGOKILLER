import { SleepEvent } from '../types';

/**
 * Packed BLE notify from firmware `PumpMsg` (little-endian):
 *   uint32 magic 0x48474F4B
 *   uint8  event  (1 = snore/sound)
 *   uint8  level  (0–10)
 *   uint16 rms
 */
export const ESP32_MSG_MAGIC = 0x48474f4b;
export const ESP32_EVENT_SOUND = 1;

export interface Esp32PillowPacket {
  magic: number;
  eventCode: number;
  level: number;
  rms: number;
  rawHex: string;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export function parseEsp32PillowPacket(bytes: Uint8Array): Esp32PillowPacket | null {
  if (bytes.length < 8) return null;

  const magic = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
  if (magic !== ESP32_MSG_MAGIC) return null;

  return {
    magic,
    eventCode: bytes[4],
    level: bytes[5],
    rms: bytes[6] | (bytes[7] << 8),
    rawHex: toHex(bytes.slice(0, 8)),
  };
}

export function sleepEventFromEsp32Packet(
  packet: Esp32PillowPacket,
  pumpDuration: number,
): SleepEvent {
  const level = Math.max(0, Math.min(10, packet.level));
  const isSnore = packet.eventCode === ESP32_EVENT_SOUND;
  const severity: SleepEvent['severity'] = level >= 8 ? 'high' : level >= 5 ? 'medium' : 'low';
  const intervene = isSnore && level >= 3;

  return {
    id: `esp32-${Date.now()}-${packet.rms}-${level}`,
    timestamp: Date.now(),
    duration: 12 + level * 4,
    severity,
    interventionTriggered: intervene,
    interventionDuration: intervene ? pumpDuration : 0,
    source: 'esp32',
    eventCode: packet.eventCode,
    level,
    rms: packet.rms,
    rawPayload: packet.rawHex,
  };
}

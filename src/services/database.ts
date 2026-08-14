import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SleepEvent, UserProfile } from '../types';

const DB_NAME = 'hagokiller.db';

const LEGACY_PROFILE_KEY = '@hagokiller_profile';
const LEGACY_PAIRED_KEY = '@hagokiller_paired';
const LEGACY_PAIRED_DEVICE_KEY = '@hagokiller_paired_device';
const LEGACY_NOTIFICATIONS_KEY = '@hagokiller_notifications';

export interface StoredPairedDevice {
  id: string;
  name: string;
  bleAddress: string;
  signalStrength: number;
}

export interface StoredDeviceSettings {
  snoreThreshold: number;
  pumpDuration: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      birthdate TEXT,
      sleep_goal_hours REAL,
      photo_uri TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paired_device (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      ble_address TEXT NOT NULL,
      signal_strength INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      snore_threshold INTEGER NOT NULL,
      pump_duration INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sleep_events (
      id TEXT PRIMARY KEY NOT NULL,
      timestamp INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      severity TEXT NOT NULL,
      intervention_triggered INTEGER NOT NULL,
      intervention_duration INTEGER NOT NULL,
      source TEXT,
      event_code INTEGER,
      level INTEGER,
      rms INTEGER,
      raw_payload TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sleep_events_ts ON sleep_events(timestamp DESC);
  `);

  await ensureSleepEventColumns(db);
  await migrateFromAsyncStorage(db);
  return db;
}

async function ensureSleepEventColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sleep_events)');
  const names = new Set(cols.map((col) => col.name));
  const extras: Array<[string, string]> = [
    ['source', 'TEXT'],
    ['event_code', 'INTEGER'],
    ['level', 'INTEGER'],
    ['rms', 'INTEGER'],
    ['raw_payload', 'TEXT'],
  ];
  for (const [name, type] of extras) {
    if (!names.has(name)) {
      await db.execAsync(`ALTER TABLE sleep_events ADD COLUMN ${name} ${type}`);
    }
  }
}

async function migrateFromAsyncStorage(db: SQLite.SQLiteDatabase): Promise<void> {
  const already = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv WHERE key = ?',
    ['migrated_async_storage'],
  );
  if (already?.value === '1') return;

  try {
    const [profileRaw, pairedRaw, deviceRaw, notifRaw] = await Promise.all([
      AsyncStorage.getItem(LEGACY_PROFILE_KEY),
      AsyncStorage.getItem(LEGACY_PAIRED_KEY),
      AsyncStorage.getItem(LEGACY_PAIRED_DEVICE_KEY),
      AsyncStorage.getItem(LEGACY_NOTIFICATIONS_KEY),
    ]);

    if (profileRaw) {
      const profile = JSON.parse(profileRaw) as UserProfile;
      await upsertProfile(db, profile);
    }

    if (pairedRaw) {
      await setKv(db, 'device_paired', pairedRaw === 'true' ? 'true' : 'false');
    }

    if (deviceRaw) {
      const device = JSON.parse(deviceRaw) as StoredPairedDevice;
      await upsertPairedDevice(db, device);
      await setKv(db, 'device_paired', 'true');
    }

    if (notifRaw != null) {
      await setKv(db, 'notifications_enabled', notifRaw === 'false' ? 'false' : 'true');
    }

    await AsyncStorage.multiRemove([
      LEGACY_PROFILE_KEY,
      LEGACY_PAIRED_KEY,
      LEGACY_PAIRED_DEVICE_KEY,
      LEGACY_NOTIFICATIONS_KEY,
    ]);
  } catch {
    // Keep SQLite usable even if a legacy key is corrupt
  }

  await setKv(db, 'migrated_async_storage', '1');
}

async function setKv(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
    [key, value],
  );
}

async function getKv(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  return row?.value ?? null;
}

async function upsertProfile(db: SQLite.SQLiteDatabase, profile: UserProfile): Promise<UserProfile> {
  const now = Date.now();
  const payload: UserProfile = {
    ...profile,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO profile (id, name, birthdate, sleep_goal_hours, photo_uri, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       birthdate = excluded.birthdate,
       sleep_goal_hours = excluded.sleep_goal_hours,
       photo_uri = excluded.photo_uri,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    [
      payload.name,
      payload.birthdate ?? null,
      payload.sleepGoalHours ?? null,
      payload.photoUri ?? null,
      payload.createdAt ?? now,
      payload.updatedAt ?? now,
    ],
  );

  return payload;
}

async function upsertPairedDevice(db: SQLite.SQLiteDatabase, device: StoredPairedDevice): Promise<void> {
  await db.runAsync(
    `INSERT INTO paired_device (id, device_id, name, ble_address, signal_strength)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       device_id = excluded.device_id,
       name = excluded.name,
       ble_address = excluded.ble_address,
       signal_strength = excluded.signal_strength`,
    [device.id, device.name, device.bleAddress, device.signalStrength],
  );
}

export async function dbSaveUserProfile(profile: UserProfile): Promise<UserProfile> {
  const db = await initDatabase();
  return upsertProfile(db, profile);
}

export async function dbLoadUserProfile(): Promise<UserProfile | null> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{
    name: string;
    birthdate: string | null;
    sleep_goal_hours: number | null;
    photo_uri: string | null;
    created_at: number;
    updated_at: number;
  }>('SELECT name, birthdate, sleep_goal_hours, photo_uri, created_at, updated_at FROM profile WHERE id = 1');

  if (!row) return null;

  return {
    name: row.name,
    birthdate: row.birthdate,
    sleepGoalHours: row.sleep_goal_hours,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function dbSetDevicePaired(paired: boolean): Promise<void> {
  const db = await initDatabase();
  await setKv(db, 'device_paired', paired ? 'true' : 'false');
  if (!paired) {
    await db.runAsync('DELETE FROM paired_device');
  }
}

export async function dbIsDevicePaired(): Promise<boolean> {
  const db = await initDatabase();
  const value = await getKv(db, 'device_paired');
  if (value === 'true') return true;
  const device = await db.getFirstAsync<{ device_id: string }>(
    'SELECT device_id FROM paired_device WHERE id = 1',
  );
  return !!device;
}

export async function dbSavePairedDevice(device: StoredPairedDevice): Promise<void> {
  const db = await initDatabase();
  await upsertPairedDevice(db, device);
  await setKv(db, 'device_paired', 'true');
}

export async function dbLoadPairedDevice(): Promise<StoredPairedDevice | null> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{
    device_id: string;
    name: string;
    ble_address: string;
    signal_strength: number;
  }>('SELECT device_id, name, ble_address, signal_strength FROM paired_device WHERE id = 1');

  if (!row) return null;

  return {
    id: row.device_id,
    name: row.name,
    bleAddress: row.ble_address,
    signalStrength: row.signal_strength,
  };
}

export async function dbLoadNotificationsEnabled(): Promise<boolean> {
  const db = await initDatabase();
  const value = await getKv(db, 'notifications_enabled');
  return value !== 'false';
}

export async function dbSaveNotificationsEnabled(enabled: boolean): Promise<void> {
  const db = await initDatabase();
  await setKv(db, 'notifications_enabled', enabled ? 'true' : 'false');
}

export async function dbSaveDeviceSettings(settings: StoredDeviceSettings): Promise<void> {
  const db = await initDatabase();
  await db.runAsync(
    `INSERT INTO device_settings (id, snore_threshold, pump_duration)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       snore_threshold = excluded.snore_threshold,
       pump_duration = excluded.pump_duration`,
    [settings.snoreThreshold, settings.pumpDuration],
  );
}

export async function dbLoadDeviceSettings(): Promise<StoredDeviceSettings | null> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ snore_threshold: number; pump_duration: number }>(
    'SELECT snore_threshold, pump_duration FROM device_settings WHERE id = 1',
  );
  if (!row) return null;
  return {
    snoreThreshold: row.snore_threshold,
    pumpDuration: row.pump_duration,
  };
}

export async function dbLoadSleepEvents(): Promise<SleepEvent[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    timestamp: number;
    duration: number;
    severity: SleepEvent['severity'];
    intervention_triggered: number;
    intervention_duration: number;
    source: SleepEvent['source'] | null;
    event_code: number | null;
    level: number | null;
    rms: number | null;
    raw_payload: string | null;
  }>(
    `SELECT id, timestamp, duration, severity, intervention_triggered, intervention_duration,
            source, event_code, level, rms, raw_payload
     FROM sleep_events
     ORDER BY timestamp DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    duration: row.duration,
    severity: row.severity,
    interventionTriggered: row.intervention_triggered === 1,
    interventionDuration: row.intervention_duration,
    source: row.source ?? undefined,
    eventCode: row.event_code ?? undefined,
    level: row.level ?? undefined,
    rms: row.rms ?? undefined,
    rawPayload: row.raw_payload,
  }));
}

export async function dbInsertSleepEvent(event: SleepEvent): Promise<void> {
  const db = await initDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO sleep_events
      (id, timestamp, duration, severity, intervention_triggered, intervention_duration,
       source, event_code, level, rms, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.timestamp,
      event.duration,
      event.severity,
      event.interventionTriggered ? 1 : 0,
      event.interventionDuration,
      event.source ?? null,
      event.eventCode ?? null,
      event.level ?? null,
      event.rms ?? null,
      event.rawPayload ?? null,
    ],
  );
}

export async function persistPillowEvent(event: SleepEvent): Promise<SleepEvent> {
  await dbInsertSleepEvent(event);
  return event;
}

export async function dbReplaceSleepEvents(events: SleepEvent[]): Promise<void> {
  const db = await initDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sleep_events');
    for (const event of events) {
      await db.runAsync(
        `INSERT INTO sleep_events
          (id, timestamp, duration, severity, intervention_triggered, intervention_duration,
           source, event_code, level, rms, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.timestamp,
          event.duration,
          event.severity,
          event.interventionTriggered ? 1 : 0,
          event.interventionDuration,
          event.source ?? null,
          event.eventCode ?? null,
          event.level ?? null,
          event.rms ?? null,
          event.rawPayload ?? null,
        ],
      );
    }
  });
}

export async function dbDeleteSleepEvent(eventId: string): Promise<boolean> {
  const db = await initDatabase();
  const result = await db.runAsync('DELETE FROM sleep_events WHERE id = ?', [eventId]);
  return (result.changes ?? 0) > 0;
}

export async function dbClearSleepEvents(): Promise<void> {
  const db = await initDatabase();
  await db.runAsync('DELETE FROM sleep_events');
}

export async function dbClearUserData(): Promise<void> {
  const db = await initDatabase();
  await db.execAsync(`
    DELETE FROM profile;
    DELETE FROM paired_device;
    DELETE FROM device_settings;
    DELETE FROM sleep_events;
    DELETE FROM kv WHERE key != 'migrated_async_storage';
  `);
}

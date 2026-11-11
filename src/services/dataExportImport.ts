import { Platform, Share } from 'react-native';
import moment from 'moment';
import {
  SleepEvent,
  UserProfile,
  DailyActivityCheckIn,
  WellnessPlanRecord,
  ActionFeedbackRecord,
} from '../types';
import {
  loadSleepEvents,
  replaceSleepEvents,
  loadUserProfile,
  saveUserProfile,
  loadDeviceSettings,
  saveDeviceSettings,
  loadDailyActivityCheckIns,
  saveDailyActivityCheckIn,
  loadWellnessPlans,
  saveWellnessPlan,
  loadActionFeedback,
  saveActionFeedback,
  saveIsDataCleared,
  StoredDeviceSettings,
} from './userStorage';
import { bleService } from './bleService';

export interface AppExportEnvelope {
  version: 1;
  appName: string;
  exportedAt: string;
  summary: {
    sleepEventsCount: number;
    dailyCheckInsCount: number;
    wellnessPlansCount: number;
    actionFeedbackCount: number;
    hasProfile: boolean;
    hasDeviceSettings: boolean;
    dateRange?: {
      firstDate: string | null;
      lastDate: string | null;
    };
  };
  data: {
    sleepEvents: SleepEvent[];
    profile?: UserProfile | null;
    deviceSettings?: StoredDeviceSettings | null;
    dailyActivityCheckIns?: DailyActivityCheckIn[];
    wellnessPlans?: WellnessPlanRecord[];
    actionFeedback?: ActionFeedbackRecord[];
  };
}

export interface ImportPreview {
  valid: boolean;
  errorMessage?: string;
  sleepEventsCount: number;
  dailyCheckInsCount: number;
  wellnessPlansCount: number;
  actionFeedbackCount: number;
  hasProfile: boolean;
  hasDeviceSettings: boolean;
  firstEventDate?: string | null;
  lastEventDate?: string | null;
  parsedData: {
    sleepEvents: SleepEvent[];
    profile?: UserProfile | null;
    deviceSettings?: StoredDeviceSettings | null;
    dailyActivityCheckIns?: DailyActivityCheckIn[];
    wellnessPlans?: WellnessPlanRecord[];
    actionFeedback?: ActionFeedbackRecord[];
  };
}

export interface ImportResult {
  success: boolean;
  eventsImported: number;
  checkInsImported: number;
  plansImported: number;
  profileUpdated: boolean;
  settingsUpdated: boolean;
  mode: 'replace' | 'merge';
}

/**
 * Builds the full export envelope object from current app state.
 */
export async function buildAppExportData(): Promise<AppExportEnvelope> {
  const [
    sleepEvents,
    profile,
    deviceSettings,
    dailyActivityCheckIns,
    wellnessPlans,
    actionFeedback,
  ] = await Promise.all([
    loadSleepEvents(),
    loadUserProfile(),
    loadDeviceSettings(),
    loadDailyActivityCheckIns(),
    loadWellnessPlans(),
    loadActionFeedback(),
  ]);

  const sortedEvents = [...sleepEvents].sort((a, b) => a.timestamp - b.timestamp);
  const firstDate = sortedEvents.length > 0 ? moment(sortedEvents[0].timestamp).format('YYYY-MM-DD') : null;
  const lastDate = sortedEvents.length > 0 ? moment(sortedEvents[sortedEvents.length - 1].timestamp).format('YYYY-MM-DD') : null;

  return {
    version: 1,
    appName: 'Hagokiller Smart Pillow',
    exportedAt: new Date().toISOString(),
    summary: {
      sleepEventsCount: sleepEvents.length,
      dailyCheckInsCount: dailyActivityCheckIns.length,
      wellnessPlansCount: wellnessPlans.length,
      actionFeedbackCount: actionFeedback.length,
      hasProfile: profile != null,
      hasDeviceSettings: deviceSettings != null,
      dateRange: {
        firstDate,
        lastDate,
      },
    },
    data: {
      sleepEvents,
      profile: profile ?? null,
      deviceSettings: deviceSettings ?? null,
      dailyActivityCheckIns,
      wellnessPlans,
      actionFeedback,
    },
  };
}

/**
 * Exports data to a downloaded JSON file (web) or opens native share sheet (mobile).
 */
export async function exportDataToFileOrShare(): Promise<{
  success: boolean;
  filename: string;
  method: 'download' | 'share';
}> {
  const exportData = await buildAppExportData();
  const jsonString = JSON.stringify(exportData, null, 2);
  const dateTag = moment().format('YYYY-MM-DD_HHmm');
  const filename = `hagokiller_backup_${dateTag}.json`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true, filename, method: 'download' };
  }

  await Share.share({
    title: 'Hagokiller Sleep Data Export',
    message: jsonString,
  });

  return { success: true, filename, method: 'share' };
}

/**
 * Validates and extracts sleep data from any imported JSON string or object.
 * Supports full AppExportEnvelope, raw SleepEvent[], or partial objects.
 */
export function parseImportPayload(rawInput: string): ImportPreview {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      errorMessage: 'Input is empty. Please paste or choose a valid JSON string.',
      sleepEventsCount: 0,
      dailyCheckInsCount: 0,
      wellnessPlansCount: 0,
      actionFeedbackCount: 0,
      hasProfile: false,
      hasDeviceSettings: false,
      parsedData: { sleepEvents: [] },
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      valid: false,
      errorMessage: 'Invalid JSON format. Check for syntax or trailing commas.',
      sleepEventsCount: 0,
      dailyCheckInsCount: 0,
      wellnessPlansCount: 0,
      actionFeedbackCount: 0,
      hasProfile: false,
      hasDeviceSettings: false,
      parsedData: { sleepEvents: [] },
    };
  }

  let rawEvents: any[] = [];
  let profile: UserProfile | null = null;
  let deviceSettings: StoredDeviceSettings | null = null;
  let dailyCheckIns: DailyActivityCheckIn[] = [];
  let wellnessPlans: WellnessPlanRecord[] = [];
  let actionFeedback: ActionFeedbackRecord[] = [];

  // Case 1: Standard AppExportEnvelope
  if (parsed && typeof parsed === 'object' && parsed.data && Array.isArray(parsed.data.sleepEvents)) {
    rawEvents = parsed.data.sleepEvents;
    profile = parsed.data.profile ?? null;
    deviceSettings = parsed.data.deviceSettings ?? null;
    dailyCheckIns = Array.isArray(parsed.data.dailyActivityCheckIns) ? parsed.data.dailyActivityCheckIns : [];
    wellnessPlans = Array.isArray(parsed.data.wellnessPlans) ? parsed.data.wellnessPlans : [];
    actionFeedback = Array.isArray(parsed.data.actionFeedback) ? parsed.data.actionFeedback : [];
  }
  // Case 2: Direct array of sleep events
  else if (Array.isArray(parsed)) {
    rawEvents = parsed;
  }
  // Case 3: Flat object with sleepEvents or events property
  else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.sleepEvents)) {
      rawEvents = parsed.sleepEvents;
    } else if (Array.isArray(parsed.events)) {
      rawEvents = parsed.events;
    }
    if (parsed.profile && typeof parsed.profile === 'object') profile = parsed.profile;
    if (parsed.deviceSettings && typeof parsed.deviceSettings === 'object') deviceSettings = parsed.deviceSettings;
    if (Array.isArray(parsed.dailyActivityCheckIns)) dailyCheckIns = parsed.dailyActivityCheckIns;
    if (Array.isArray(parsed.wellnessPlans)) wellnessPlans = parsed.wellnessPlans;
    if (Array.isArray(parsed.actionFeedback)) actionFeedback = parsed.actionFeedback;
  }

  // Validate and sanitize sleep events
  const validEvents: SleepEvent[] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const item = rawEvents[i];
    if (!item || typeof item !== 'object') continue;
    const timestamp = Number(item.timestamp);
    if (!timestamp || isNaN(timestamp)) continue;

    const duration = typeof item.duration === 'number' && !isNaN(item.duration) ? item.duration : 15;
    const severity = item.severity === 'high' || item.severity === 'medium' || item.severity === 'low'
      ? item.severity
      : duration > 30 ? 'high' : duration > 15 ? 'medium' : 'low';

    validEvents.push({
      id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `imported-${timestamp}-${i}`,
      timestamp,
      duration,
      severity,
      interventionTriggered: Boolean(item.interventionTriggered),
      interventionDuration: typeof item.interventionDuration === 'number' ? item.interventionDuration : 0,
      source: item.source || 'seed',
      eventCode: typeof item.eventCode === 'number' ? item.eventCode : 1,
      level: typeof item.level === 'number' ? item.level : 3,
      rms: typeof item.rms === 'number' ? item.rms : 800,
      snoreStreak: typeof item.snoreStreak === 'number' ? item.snoreStreak : 1,
      maxElevationHold: Boolean(item.maxElevationHold),
    });
  }

  if (validEvents.length === 0 && !profile && !deviceSettings && dailyCheckIns.length === 0) {
    return {
      valid: false,
      errorMessage: 'No valid sleep events or app settings found in the provided JSON.',
      sleepEventsCount: 0,
      dailyCheckInsCount: 0,
      wellnessPlansCount: 0,
      actionFeedbackCount: 0,
      hasProfile: false,
      hasDeviceSettings: false,
      parsedData: { sleepEvents: [] },
    };
  }

  const sorted = [...validEvents].sort((a, b) => a.timestamp - b.timestamp);
  const firstEventDate = sorted.length > 0 ? moment(sorted[0].timestamp).format('YYYY-MM-DD') : null;
  const lastEventDate = sorted.length > 0 ? moment(sorted[sorted.length - 1].timestamp).format('YYYY-MM-DD') : null;

  return {
    valid: true,
    sleepEventsCount: validEvents.length,
    dailyCheckInsCount: dailyCheckIns.length,
    wellnessPlansCount: wellnessPlans.length,
    actionFeedbackCount: actionFeedback.length,
    hasProfile: profile != null,
    hasDeviceSettings: deviceSettings != null,
    firstEventDate,
    lastEventDate,
    parsedData: {
      sleepEvents: validEvents,
      profile,
      deviceSettings,
      dailyActivityCheckIns: dailyCheckIns,
      wellnessPlans,
      actionFeedback,
    },
  };
}

/**
 * Applies the parsed import payload to persistent storage and reloads services.
 */
export async function applyImportPayload(
  preview: ImportPreview,
  mode: 'replace' | 'merge' = 'replace',
): Promise<ImportResult> {
  if (!preview.valid) {
    throw new Error(preview.errorMessage || 'Invalid import payload');
  }

  const { parsedData } = preview;
  let finalEvents: SleepEvent[] = [];

  if (mode === 'replace') {
    finalEvents = [...parsedData.sleepEvents];
  } else {
    // Merge mode: combine existing events with imported events
    const existing = await loadSleepEvents();
    const existingIds = new Set(existing.map((e) => e.id));
    const merged = [...existing];

    for (const imp of parsedData.sleepEvents) {
      if (!existingIds.has(imp.id)) {
        merged.push(imp);
        existingIds.add(imp.id);
      }
    }
    finalEvents = merged;
  }

  // Sort descending by timestamp for storage consistency
  finalEvents.sort((a, b) => b.timestamp - a.timestamp);

  // 1. Replace sleep events in database
  await replaceSleepEvents(finalEvents);

  // 2. Mark data as NOT cleared so hydration won't wipe or skip
  await saveIsDataCleared(false);

  // 3. Restore profile if present
  let profileUpdated = false;
  if (parsedData.profile) {
    await saveUserProfile(parsedData.profile);
    profileUpdated = true;
  }

  // 4. Restore device settings if present
  let settingsUpdated = false;
  if (parsedData.deviceSettings) {
    await saveDeviceSettings(parsedData.deviceSettings);
    settingsUpdated = true;
  }

  // 5. Restore check-ins
  if (parsedData.dailyActivityCheckIns && parsedData.dailyActivityCheckIns.length > 0) {
    for (const c of parsedData.dailyActivityCheckIns) {
      await saveDailyActivityCheckIn(c);
    }
  }

  // 6. Restore wellness plans
  if (parsedData.wellnessPlans && parsedData.wellnessPlans.length > 0) {
    for (const wp of parsedData.wellnessPlans) {
      await saveWellnessPlan(wp);
    }
  }

  // 7. Restore action feedback
  if (parsedData.actionFeedback && parsedData.actionFeedback.length > 0) {
    for (const af of parsedData.actionFeedback) {
      await saveActionFeedback(af);
    }
  }

  // 8. Trigger BLE service to reload events from storage and notify all screens
  if (typeof (bleService as any).reloadFromStorage === 'function') {
    await (bleService as any).reloadFromStorage();
  }

  return {
    success: true,
    eventsImported: parsedData.sleepEvents.length,
    checkInsImported: parsedData.dailyActivityCheckIns ? parsedData.dailyActivityCheckIns.length : 0,
    plansImported: parsedData.wellnessPlans ? parsedData.wellnessPlans.length : 0,
    profileUpdated,
    settingsUpdated,
    mode,
  };
}


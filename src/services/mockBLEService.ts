import { SleepEvent, DashboardData, DailyStats, BLEDevice } from '../types';
import moment from 'moment';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from '../utils/statsCalculator';
import { isCorrectPairingPin, isValidPairingPin } from '../utils/pinValidation';
import {
  loadPairedDevice,
  savePairedDevice,
  setDevicePaired,
  loadDeviceSettings,
  saveDeviceSettings,
  loadSleepEvents,
  insertSleepEvent,
  replaceSleepEvents,
  deleteStoredEvent,
  clearStoredEvents,
  loadIsDataCleared,
  saveIsDataCleared,
} from './userStorage';
import {
  DeviceSettings,
  DEFAULT_DEVICE_SETTINGS,
  validateDeviceSettings,
} from './deviceSettings';

export type { DeviceSettings } from './deviceSettings';

// Realistic mock sleep data — 90 days of hardcoded events
// Story: starts with bad snoring, peaks dangerously mid-period, slowly improves
const MOCK_DAILY_PLAN: { eventsPerDay: number; avgDuration: number; interventionRate: number; avgRms?: number; peakHourOverride?: number }[] = [
  // Days 0-6 (today = index 0, most recent first)
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.6 }, // today   (Nov 8)
  { eventsPerDay: 11, avgDuration: 40, interventionRate: 0.6, avgRms: 1050, peakHourOverride: 3 }, // Nov 7 — 11 snores
  { eventsPerDay: 4,  avgDuration: 28, interventionRate: 0.3, avgRms: 650, peakHourOverride: 1 },  // Nov 6 — 4 snores
  { eventsPerDay: 9,  avgDuration: 36, interventionRate: 0.4, avgRms: 850, peakHourOverride: 2 },  // Nov 5 — 9 snores
  { eventsPerDay: 5,  avgDuration: 32, interventionRate: 0.4, avgRms: 720,  peakHourOverride: 1 }, // Nov 4 — 5 snores,  RMS<900,  peak ~1–2 AM
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.6 },
  { eventsPerDay: 3,  avgDuration: 30, interventionRate: 0.4 },
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  // Days 7-13
  { eventsPerDay: 8,  avgDuration: 55, interventionRate: 0.8 },
  { eventsPerDay: 9,  avgDuration: 58, interventionRate: 0.8 },
  { eventsPerDay: 7,  avgDuration: 52, interventionRate: 0.7 },
  { eventsPerDay: 11, avgDuration: 70, interventionRate: 0.9 }, // danger
  { eventsPerDay: 12, avgDuration: 75, interventionRate: 0.9 }, // danger
  { eventsPerDay: 10, avgDuration: 65, interventionRate: 0.8 },
  { eventsPerDay: 12, avgDuration: 44, interventionRate: 0.6, avgRms: 1140, peakHourOverride: 2 }, // Oct 25 (index 13) — 12 snores, RMS ~1140, peak ~2 AM
  // Days 14-20
  { eventsPerDay: 12, avgDuration: 44, interventionRate: 0.6, avgRms: 1140, peakHourOverride: 2 }, // Oct 24/25 (index 14) — 12 snores, RMS ~1140, peak ~2 AM
  { eventsPerDay: 8,  avgDuration: 40, interventionRate: 0.5, avgRms: 920 }, // index 15 — 8 snores (below 11)
  { eventsPerDay: 7,  avgDuration: 38, interventionRate: 0.5, avgRms: 880 }, // index 16 — 7 snores
  { eventsPerDay: 10, avgDuration: 42, interventionRate: 0.5, avgRms: 950 }, // index 17 — 10 snores
  { eventsPerDay: 10, avgDuration: 66, interventionRate: 0.8 },
  { eventsPerDay: 8,  avgDuration: 56, interventionRate: 0.7 },
  { eventsPerDay: 7,  avgDuration: 50, interventionRate: 0.7 },
  // Days 21-27
  { eventsPerDay: 6,  avgDuration: 46, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.5 },
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  { eventsPerDay: 4,  avgDuration: 36, interventionRate: 0.5 },
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.5 },
  { eventsPerDay: 3,  avgDuration: 28, interventionRate: 0.4 },
  { eventsPerDay: 4,  avgDuration: 35, interventionRate: 0.4 },
  // Days 28-34
  { eventsPerDay: 2,  avgDuration: 22, interventionRate: 0.3 },
  { eventsPerDay: 3,  avgDuration: 27, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 20, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 15, interventionRate: 0.2 }, // normal
  { eventsPerDay: 2,  avgDuration: 18, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 14, interventionRate: 0.1 },
  { eventsPerDay: 2,  avgDuration: 20, interventionRate: 0.2 },
  // Days 35-41
  { eventsPerDay: 3,  avgDuration: 25, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 19, interventionRate: 0.2 },
  { eventsPerDay: 4,  avgDuration: 33, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 28, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 21, interventionRate: 0.2 },
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 36, interventionRate: 0.4 },
  // Days 42-48
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  { eventsPerDay: 7,  avgDuration: 50, interventionRate: 0.7 },
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.5 },
  { eventsPerDay: 6,  avgDuration: 46, interventionRate: 0.6 },
  { eventsPerDay: 8,  avgDuration: 55, interventionRate: 0.7 },
  { eventsPerDay: 7,  avgDuration: 52, interventionRate: 0.7 },
  { eventsPerDay: 6,  avgDuration: 48, interventionRate: 0.6 },
  // Days 49-55
  { eventsPerDay: 5,  avgDuration: 41, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 35, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 29, interventionRate: 0.3 },
  { eventsPerDay: 4,  avgDuration: 33, interventionRate: 0.4 },
  { eventsPerDay: 5,  avgDuration: 38, interventionRate: 0.5 },
  { eventsPerDay: 3,  avgDuration: 26, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 20, interventionRate: 0.2 },
  // Days 56-62
  { eventsPerDay: 9,  avgDuration: 60, interventionRate: 0.8 },
  { eventsPerDay: 10, avgDuration: 65, interventionRate: 0.8 },
  { eventsPerDay: 8,  avgDuration: 56, interventionRate: 0.7 },
  { eventsPerDay: 7,  avgDuration: 51, interventionRate: 0.7 },
  { eventsPerDay: 9,  avgDuration: 62, interventionRate: 0.8 },
  { eventsPerDay: 6,  avgDuration: 47, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 42, interventionRate: 0.5 },
  // Days 63-69
  { eventsPerDay: 4,  avgDuration: 36, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 28, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 22, interventionRate: 0.2 },
  { eventsPerDay: 3,  avgDuration: 26, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 19, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 13, interventionRate: 0.1 },
  { eventsPerDay: 2,  avgDuration: 17, interventionRate: 0.2 },
  // Days 70-76
  { eventsPerDay: 3,  avgDuration: 24, interventionRate: 0.3 },
  { eventsPerDay: 4,  avgDuration: 32, interventionRate: 0.4 },
  { eventsPerDay: 5,  avgDuration: 39, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 34, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 27, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 21, interventionRate: 0.2 },
  { eventsPerDay: 4,  avgDuration: 33, interventionRate: 0.4 },
  // Days 77-83
  { eventsPerDay: 6,  avgDuration: 44, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 40, interventionRate: 0.5 },
  { eventsPerDay: 7,  avgDuration: 51, interventionRate: 0.7 },
  { eventsPerDay: 6,  avgDuration: 47, interventionRate: 0.6 },
  { eventsPerDay: 5,  avgDuration: 41, interventionRate: 0.5 },
  { eventsPerDay: 4,  avgDuration: 37, interventionRate: 0.4 },
  { eventsPerDay: 3,  avgDuration: 30, interventionRate: 0.3 },
  // Days 84-89
  { eventsPerDay: 2,  avgDuration: 23, interventionRate: 0.2 },
  { eventsPerDay: 3,  avgDuration: 26, interventionRate: 0.3 },
  { eventsPerDay: 2,  avgDuration: 18, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 12, interventionRate: 0.1 },
  { eventsPerDay: 2,  avgDuration: 16, interventionRate: 0.2 },
  { eventsPerDay: 1,  avgDuration: 11, interventionRate: 0.1 },
];

// Peak snoring hours — realistic sleep-time distribution
const PEAK_HOURS = [22, 23, 0, 1, 2, 3, 4, 1, 2, 3, 23, 0, 2, 1, 3];

// Hardcoded nights: each entry is an array of snore events for that MM-DD date.
// minutesAfterMidnight can be fractional — the decimal portion maps to seconds
// (e.g. 11.100 = 11 min 6 sec = 12:11:06 AM).
// The event with the highest rms value becomes the chart peak.
// At the peak time, a 3-snore streak occurs within 12 seconds (< 15s window),
// triggering pillow inflation. Once the pillow inflates, snoring stops — no further
// snore events occur that night.
interface HardcodedEvent {
  m: number;   // minutesAfterMidnight (fractional → seconds)
  rms: number;
  dur?: number; // duration seconds (default 38)
}
const HARDCODED_NIGHTS: Record<string, HardcodedEvent[]> = {
  // Oct 24 — 14 snores, peak 12:11 AM (11 min after midnight), snoring stops after inflation
  '10-24': [
    { m: 1,     rms: 620 },
    { m: 2,     rms: 650 },
    { m: 3,     rms: 680 },
    { m: 4,     rms: 710 },
    { m: 5,     rms: 730 },
    { m: 6,     rms: 760 },
    { m: 7,     rms: 780 },
    { m: 8,     rms: 810 },
    { m: 9,     rms: 830 },
    { m: 10,    rms: 860 },
    { m: 10.5,  rms: 890 },
    // 3-snore streak at 12:11 AM triggers pillow inflation -> snoring stops afterwards
    { m: 11.000, rms: 1900 }, // PEAK — 12:11:00 AM
    { m: 11.100, rms: 1320 }, // 12:11:06 AM
    { m: 11.200, rms: 1140 }, // 12:11:12 AM (triggers inflation, then snoring stops)
  ],
  // Oct 25 — 12 snores, peak 7:01 AM (421 min after midnight), snoring stops after inflation
  '10-25': [
    { m: 60,    rms: 700 },
    { m: 105,   rms: 720 },
    { m: 150,   rms: 750 },
    { m: 195,   rms: 780 },
    { m: 240,   rms: 810 },
    { m: 285,   rms: 840 },
    { m: 330,   rms: 870 },
    { m: 375,   rms: 900 },
    { m: 410,   rms: 940 },
    { m: 421.000, rms: 1750 }, // PEAK — 7:01:00 AM
    { m: 421.100, rms: 1220 }, // 7:01:06 AM
    { m: 421.200, rms: 1060 }, // 7:01:12 AM (triggers inflation, then snoring stops)
  ],
  // Oct 26 — 5 snores, peak 3:10 AM (190 min after midnight), snoring stops after inflation
  '10-26': [
    { m: 90,    rms: 680 },
    { m: 140,   rms: 740 },
    { m: 190.000, rms: 1200 }, // PEAK — 3:10:00 AM
    { m: 190.100, rms: 840 },  // 3:10:06 AM
    { m: 190.200, rms: 750 },  // 3:10:12 AM (triggers inflation, then snoring stops)
  ],
  // Oct 27 — 8 snores, peak 12:37 AM (37 min after midnight), snoring stops after inflation
  '10-27': [
    { m: 6,     rms: 650 },
    { m: 13,    rms: 690 },
    { m: 20,    rms: 730 },
    { m: 27,    rms: 770 },
    { m: 33,    rms: 820 },
    { m: 37.000, rms: 1450 }, // PEAK — 12:37:00 AM
    { m: 37.100, rms: 990 },  // 12:37:06 AM
    { m: 37.200, rms: 880 },  // 12:37:12 AM (triggers inflation, then snoring stops)
  ],
  // Oct 28 — 6 snores, peak 2:08 AM (128 min after midnight), snoring stops after inflation
  '10-28': [
    { m: 40,    rms: 670 },
    { m: 75,    rms: 720 },
    { m: 105,   rms: 780 },
    { m: 128.000, rms: 1300 }, // PEAK — 2:08:00 AM
    { m: 128.100, rms: 880 },  // 2:08:06 AM
    { m: 128.200, rms: 800 },  // 2:08:12 AM (triggers inflation, then snoring stops)
  ],
  // Oct 29 — 11 snores, peak 6:03 AM (363 min after midnight), baseline night (no stop)
  '10-29': [
    { m: 60,      rms: 840 },
    { m: 120,     rms: 870 },
    { m: 180,     rms: 910 },
    { m: 240,     rms: 940 },
    { m: 300,     rms: 980 },
    { m: 330,     rms: 1020 },
    { m: 363.000, rms: 1680 }, // PEAK — 6:03:00 AM
    { m: 363.100, rms: 1140 }, // 6:03:06 AM
    { m: 363.200, rms: 990 },  // 6:03:12 AM
    { m: 390,     rms: 880 },  // 6:30 AM (continues, baseline)
    { m: 415,     rms: 820 },  // 6:55 AM (continues, baseline)
  ],
  // Oct 30 — 14 snores, peak 5:54 AM (354 min after midnight), baseline night (no stop)
  '10-30': [
    { m: 60,      rms: 830 },
    { m: 110,     rms: 860 },
    { m: 150,     rms: 890 },
    { m: 190,     rms: 920 },
    { m: 230,     rms: 950 },
    { m: 270,     rms: 980 },
    { m: 305,     rms: 1010 },
    { m: 330,     rms: 1050 },
    { m: 354.000, rms: 1820 }, // PEAK — 5:54:00 AM
    { m: 354.100, rms: 1250 }, // 5:54:06 AM
    { m: 354.200, rms: 1100 }, // 5:54:12 AM
    { m: 380,     rms: 920 },  // 6:20 AM (continues, baseline)
    { m: 405,     rms: 860 },  // 6:45 AM (continues, baseline)
    { m: 430,     rms: 800 },  // 7:10 AM (continues, baseline)
  ],
  // Oct 31 — 9 snores, peak 3:14 AM (194 min after midnight), snoring stops after inflation
  '10-31': [
    { m: 40,    rms: 660 },
    { m: 75,    rms: 710 },
    { m: 110,   rms: 750 },
    { m: 140,   rms: 790 },
    { m: 165,   rms: 830 },
    { m: 185,   rms: 870 },
    { m: 194.000, rms: 1550 }, // PEAK — 3:14:00 AM
    { m: 194.100, rms: 1060 }, // 3:14:06 AM
    { m: 194.200, rms: 920 },  // 3:14:12 AM (triggers inflation, then snoring stops)
  ],
  // Nov 1 — 8 snores, peak 3:20 AM (200 min after midnight), snoring stops after inflation
  '11-01': [
    { m: 50,    rms: 670 },
    { m: 90,    rms: 720 },
    { m: 130,   rms: 770 },
    { m: 165,   rms: 820 },
    { m: 190,   rms: 870 },
    { m: 200.000, rms: 1500 }, // PEAK — 3:20:00 AM
    { m: 200.100, rms: 1100 }, // 3:20:06 AM
    { m: 200.200, rms: 920 },  // 3:20:12 AM (triggers inflation, then snoring stops)
  ],
  // Nov 2 — 6 snores, peak 11:34 AM (694 min after midnight), snoring stops after inflation
  '11-02': [
    { m: 344,   rms: 760 },
    { m: 450,   rms: 810 },
    { m: 580,   rms: 860 },
    { m: 694.000, rms: 1650 }, // PEAK — 11:34:00 AM
    { m: 694.100, rms: 1120 }, // 11:34:06 AM
    { m: 694.200, rms: 980 },  // 11:34:12 AM (triggers inflation, then snoring stops)
  ],
  // Nov 3 — 13 snores, peak 3:46 AM (226 min after midnight), baseline night (no stop)
  '11-03': [
    { m: 45,      rms: 820 },
    { m: 80,      rms: 860 },
    { m: 115,     rms: 900 },
    { m: 150,     rms: 930 },
    { m: 180,     rms: 960 },
    { m: 205,     rms: 990 },
    { m: 226.000, rms: 1750 }, // PEAK — 3:46:00 AM
    { m: 226.100, rms: 1250 }, // 3:46:06 AM
    { m: 226.200, rms: 1050 }, // 3:46:12 AM
    { m: 260,     rms: 950 },  // 4:20 AM (continues, baseline)
    { m: 300,     rms: 900 },  // 5:00 AM (continues, baseline)
    { m: 340,     rms: 850 },  // 5:40 AM (continues, baseline)
    { m: 380,     rms: 800 },  // 6:20 AM (continues, baseline)
  ],
  // Nov 4 — 17 snores, peak 2:19 AM (139 min after midnight), baseline night (no stop)
  '11-04': [
    { m: 20,      rms: 780 },
    { m: 45,      rms: 820 },
    { m: 70,      rms: 860 },
    { m: 95,      rms: 900 },
    { m: 118,     rms: 940 },
    { m: 139.000, rms: 1950 }, // PEAK — 2:19:00 AM
    { m: 139.100, rms: 1350 }, // 2:19:06 AM
    { m: 139.200, rms: 1150 }, // 2:19:12 AM
    { m: 165,     rms: 960 },  // 2:45 AM (continues, baseline)
    { m: 190,     rms: 930 },  // 3:10 AM (continues, baseline)
    { m: 220,     rms: 900 },  // 3:40 AM (continues, baseline)
    { m: 250,     rms: 870 },  // 4:10 AM (continues, baseline)
    { m: 280,     rms: 850 },  // 4:40 AM (continues, baseline)
    { m: 310,     rms: 820 },  // 5:10 AM (continues, baseline)
    { m: 340,     rms: 800 },  // 5:40 AM (continues, baseline)
    { m: 370,     rms: 770 },  // 6:10 AM (continues, baseline)
    { m: 400,     rms: 740 },  // 6:40 AM (continues, baseline)
  ],
  // Nov 5 — 9 snores, peak 2:13 AM (133 min after midnight), snoring stops after inflation
  '11-05': [
    { m: 35,    rms: 630 },
    { m: 60,    rms: 680 },
    { m: 85,    rms: 730 },
    { m: 105,   rms: 780 },
    { m: 120,   rms: 830 },
    { m: 128,   rms: 870 },
    { m: 133.000, rms: 1480 }, // PEAK — 2:13:00 AM
    { m: 133.100, rms: 1020 }, // 2:13:06 AM
    { m: 133.200, rms: 890 },  // 2:13:12 AM (triggers inflation, then snoring stops)
  ],
  // Nov 6 — 4 snores, peak 1:40 AM (100 min after midnight), snoring stops after inflation
  '11-06': [
    { m: 50,    rms: 650 },
    { m: 100.000, rms: 1150 }, // PEAK — 1:40:00 AM
    { m: 100.100, rms: 780 },  // 1:40:06 AM
    { m: 100.200, rms: 690 },  // 1:40:12 AM (triggers inflation, then snoring stops)
  ],
  // Nov 7 — 11 snores, peak 3:12 AM (192 min after midnight), snoring stops after inflation
  '11-07': [
    { m: 45,    rms: 660 },
    { m: 80,    rms: 700 },
    { m: 115,   rms: 740 },
    { m: 145,   rms: 780 },
    { m: 165,   rms: 820 },
    { m: 178,   rms: 860 },
    { m: 185,   rms: 900 },
    { m: 189,   rms: 930 },
    { m: 192.000, rms: 1620 }, // PEAK — 3:12:00 AM
    { m: 192.100, rms: 1120 }, // 3:12:06 AM
    { m: 192.200, rms: 960 },  // 3:12:12 AM (triggers inflation, then snoring stops)
  ],
};

export const generateMockSleepEvents = (days: number = 90): SleepEvent[] => {
  const events: SleepEvent[] = [];
  const now = moment();

  const createEventsForDay = (dayStart: moment.Moment, dayOffset: number, isFuture = false) => {
    const planIndex = Math.abs(dayOffset) % MOCK_DAILY_PLAN.length;
    const plan = MOCK_DAILY_PLAN[planIndex];
    const dateStr = dayStart.format('YYYY-MM-DD');
    const mmdd = dateStr.slice(5); // 'MM-DD'

    // ── Hardcoded nights: exact timestamps + snore clusters ──────────────
    if (HARDCODED_NIGHTS[mmdd]) {
      const night = HARDCODED_NIGHTS[mmdd];
      // Sort by time so clusters are contiguous
      const sorted = [...night].sort((a, b) => a.m - b.m);
      // Rolling-window pass to mark interventions (window = 15 s, threshold = 3)
      const windowSec = 15;
      const threshold = 3;
      const triggered: boolean[] = new Array(sorted.length).fill(false);
      const snoreStreaks: number[] = new Array(sorted.length).fill(1);
      let windowEvents: number[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const tSec = sorted[i].m * 60;
        windowEvents = windowEvents.filter(t => tSec - t <= windowSec);
        windowEvents.push(tSec);
        const streakCount = windowEvents.length;
        snoreStreaks[i] = streakCount;
        if (streakCount >= threshold) {
          triggered[i] = true;
          windowEvents = []; // streak reached: inflation fires and window resets
        }
      }
      sorted.forEach((pt, i) => {
        const totalSec = Math.round(pt.m * 60);
        const h = Math.floor(totalSec / 3600);
        const rem = totalSec % 3600;
        const min = Math.floor(rem / 60);
        const sec = rem % 60;
        const eventTime = dayStart.clone().hours(h).minutes(min).seconds(sec);
        const dur = pt.dur ?? 38;
        const severity: 'low' | 'medium' | 'high' =
          pt.rms >= 1500 ? 'high' : pt.rms >= 900 ? 'medium' : 'low';
        const idPrefix = isFuture ? `future-hc-${mmdd}-${i}` : `hc-${mmdd}-${i}`;
        events.push({
          id: idPrefix,
          timestamp: eventTime.valueOf(),
          duration: dur,
          severity,
          interventionTriggered: triggered[i],
          interventionDuration: triggered[i] ? 15 : 0,
          source: 'seed',
          rms: pt.rms,
          snoreStreak: snoreStreaks[i],
        });
      });
      return; // skip formula-based generation
    }

    let eventsCount = plan.eventsPerDay;
    let avgDuration = plan.avgDuration;
    let baseRms = plan.avgRms ?? (plan.avgDuration * 18 + 200);
    let peakOverride = plan.peakHourOverride;

    if (dateStr.endsWith('-11-24')) {
      eventsCount = 6;
      avgDuration = 36;
      baseRms = 920;
      peakOverride = 3;
    } else if (dateStr.endsWith('-15')) {
      eventsCount = 8;
      avgDuration = 40;
      baseRms = 920;
    } else if (dateStr.endsWith('-16')) {
      eventsCount = 7;
      avgDuration = 38;
      baseRms = 880;
    } else if (dateStr.endsWith('-17')) {
      eventsCount = 10;
      avgDuration = 42;
      baseRms = 950;
    }

    for (let i = 0; i < eventsCount; i++) {
      let hour: number;
      if (peakOverride !== undefined) {
        const offset = i - Math.floor(eventsCount / 2);
        hour = ((peakOverride + offset + 24) % 24);
        if (hour > 7 && hour < 22) hour = (hour % 7);
      } else {
        hour = PEAK_HOURS[(dayOffset + i) % PEAK_HOURS.length];
      }

      const minute = (i * 13 + dayOffset * 7) % 60;
      const second = (i * 11 + dayOffset * 3) % 60;

      const eventTime = dayStart.clone().hours(hour).minutes(minute).seconds(second);

      const variance = Math.floor((((i * 7 + dayOffset * 3) % 40) - 20) * (avgDuration * 0.2) / 20);
      const duration = Math.max(5, avgDuration + variance);

      const isMidPoint = i === Math.floor(eventsCount / 2);
      const rmsVariance = isMidPoint ? 0.35 : (((i * 17 + dayOffset * 11) % 50) - 25) / 100;
      const rms = Math.max(50, Math.round(baseRms * (1 + rmsVariance)));

      const severityVal = (i + dayOffset) % 10;
      const severityLevel: 'low' | 'medium' | 'high' =
        severityVal < 5 ? 'low' : severityVal < 8 ? 'medium' : 'high';

      const triggered = (i / eventsCount) < plan.interventionRate;
      const idPrefix = isFuture ? `future-${dayOffset}-${i}` : `event-${dayOffset}-${i}`;

      events.push({
        id: idPrefix,
        timestamp: eventTime.valueOf(),
        duration,
        severity: severityLevel,
        interventionTriggered: triggered,
        interventionDuration: triggered ? 10 + ((i * 5 + dayOffset) % 20) : 0,
        source: 'seed',
        rms,
      });
    }
  };

  // Generate past 90 days (d = 0 is today, d = 1 is yesterday, etc.)
  for (let d = 0; d < Math.min(days, MOCK_DAILY_PLAN.length); d++) {
    const dayStart = now.clone().subtract(d, 'days').startOf('day');
    createEventsForDay(dayStart, d, false);
  }

  // Generate future 25 days (for dates like Nov 24 in the picker)
  for (let f = 1; f <= 25; f++) {
    const dayStart = now.clone().add(f, 'days').startOf('day');
    createEventsForDay(dayStart, f, true);
  }

  return events
    .filter((e) => typeof e.timestamp === 'number' && !isNaN(e.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);
};

// Calculate dashboard data from sleep events
export const calculateDashboardData = (events: SleepEvent[]): DashboardData => {
  const now = moment();
  const todayStr = now.format('YYYY-MM-DD');

  // Today's stats
  const today = calculateDailyStats(events, todayStr);

  // This week's stats (last 7 days)
  const thisWeek: DailyStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = now
      .clone()
      .subtract(i, 'days')
      .format('YYYY-MM-DD');
    thisWeek.push(calculateDailyStats(events, date));
  }

  // This month's stats + trend vs previous month
  const thisMonthStr = now.format('YYYY-MM');
  const previousMonthStr = now.clone().subtract(1, 'month').format('YYYY-MM');
  const thisMonth = calculateMonthlyStats(events, thisMonthStr);
  const previousMonth = calculateMonthlyStats(events, previousMonthStr);
  thisMonth.trend = calculateTrend([previousMonth, thisMonth]);

  return {
    today,
    thisWeek,
    thisMonth,
    allData: events,
  };
};

/**
 * BLE manager for the smart pillow.
 * React Native supports real Bluetooth via `react-native-ble-plx` in a
 * development/production build (not Expo Go). This prototype uses a mock
 * GATT layer with the same pair / connect / disconnect API.
 */
export class MockBLEService {
  private mockEvents: SleepEvent[] = [];
  private eventsReady: Promise<void> | null = null;
  private connected = false;
  private pairedDevice: BLEDevice | null = null;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: SleepEvent) => void>();
  private reloadListeners = new Set<() => void>();
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private liveTimeout: ReturnType<typeof setTimeout> | null = null;
  private seedIfEmpty: boolean;
  private snoreStreak = 0;
  private snoreEventTimes: number[] = [];
  private settings: DeviceSettings = { ...DEFAULT_DEVICE_SETTINGS };

  constructor(options?: { seedIfEmpty?: boolean }) {
    this.seedIfEmpty = options?.seedIfEmpty !== false;
  }

  private nearbyDevices: BLEDevice[] = [
    {
      id: 'demo-pillow-001',
      name: 'Demo Pillow A',
      bleAddress: 'A4:CF:12:8B:44:01',
      isConnected: false,
      signalStrength: -48,
    },
    {
      id: 'demo-pillow-002',
      name: 'Demo Pillow B',
      bleAddress: 'A4:CF:12:8B:44:19',
      isConnected: false,
      signalStrength: -62,
    },
  ];

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeEvents(listener: (event: SleepEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Subscribe to full-data-reload signals (e.g. after clearing all data).
   * Listeners should re-fetch all sleep events from scratch.
   */
  subscribeReload(listener: () => void): () => void {
    this.reloadListeners.add(listener);
    return () => this.reloadListeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private notifyReload() {
    this.reloadListeners.forEach((listener) => listener());
  }

  private createLiveSnoreEvent(): SleepEvent {
    const roll = Date.now() % 10;
    const severity: SleepEvent['severity'] = roll < 5 ? 'low' : roll < 8 ? 'medium' : 'high';
    const duration = 18 + (Date.now() % 42);
    const now = Date.now();
    const windowMs = this.settings.snoreWindowSec * 1000;
    this.snoreEventTimes = this.snoreEventTimes.filter((t) => now - t <= windowMs);
    this.snoreEventTimes.push(now);
    this.snoreStreak = this.snoreEventTimes.length;
    const triggered = this.snoreStreak >= this.settings.snoreThreshold;
    const streakAtEvent = this.snoreStreak;
    if (triggered) {
      this.snoreEventTimes = [];
      this.snoreStreak = 0;
    }
    const event: SleepEvent = {
      id: `live-${Date.now()}`,
      timestamp: now,
      duration,
      severity,
      interventionTriggered: triggered,
      interventionDuration: triggered ? this.settings.pumpDuration : 0,
      source: 'mock',
      eventCode: 1,
      level: severity === 'high' ? 9 : severity === 'medium' ? 6 : 3,
      rms: 80 + duration,
      snoreStreak: streakAtEvent,
    };
    return event;
  }

  private emitLiveEvent() {
    if (!this.connected) return;
    const event = this.createLiveSnoreEvent();
    this.mockEvents.unshift(event);
    insertSleepEvent(event).catch(() => undefined);
    this.eventListeners.forEach((listener) => listener(event));
    this.notify();

    // If the pillow inflated, snoring stops!
    if (event.interventionTriggered) {
      this.stopLiveMonitoring();
      if (__DEV__) {
        console.log('[mock BLE] Pillow inflated — snoring stopped.');
      }
    }
  }

  private startLiveMonitoring() {
    this.stopLiveMonitoring();
    this.snoreStreak = 0;
    this.snoreEventTimes = [];
    // Emit snores every 4 seconds so a 3-snore streak triggers within the 15s window,
    // after which the pillow inflates and snoring stops.
    this.liveTimeout = setTimeout(() => {
      this.emitLiveEvent();
      this.liveTimer = setInterval(() => this.emitLiveEvent(), 4000);
    }, 4000);
  }

  private stopLiveMonitoring() {
    if (this.liveTimeout) {
      clearTimeout(this.liveTimeout);
      this.liveTimeout = null;
    }
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
  }

  private async hydrateEvents(): Promise<void> {
    if (this.eventsReady) return this.eventsReady;
    this.eventsReady = (async () => {
      // 1. If the user explicitly cleared their data, keep events empty
      const isCleared = await loadIsDataCleared();
      if (isCleared) {
        this.mockEvents = [];
        return;
      }

      // 2. Load existing stored events from the persistent database
      const stored = await loadSleepEvents();

      // If existing sleep data is present in the database, NEVER overwrite or wipe it.
      // This guarantees user sleep history, imported data, and recorded sessions persist across app updates.
      if (stored && stored.length > 0) {
        const validEvents = stored.filter(
          (e) => e && typeof e.timestamp === 'number' && !isNaN(e.timestamp)
        );
        this.mockEvents = validEvents;
        return;
      }

      // 3. Only if the database is completely empty on a brand new install
      if (!this.seedIfEmpty) {
        this.mockEvents = [];
        return;
      }

      // First-time fresh install: seed initial baseline demo data once
      this.mockEvents = generateMockSleepEvents();
      await replaceSleepEvents(this.mockEvents);
    })().catch((error) => {
      this.eventsReady = null;
      throw error;
    });
    return this.eventsReady;
  }

  async restoreSession(): Promise<void> {
    const [saved, settings] = await Promise.all([
      loadPairedDevice(),
      loadDeviceSettings(),
      this.hydrateEvents(),
    ]);
    if (settings) {
      this.settings = { ...DEFAULT_DEVICE_SETTINGS, ...settings };
    }
    if (saved) {
      this.pairedDevice = {
        ...saved,
        isConnected: this.connected,
      };
      this.notify();
    }
  }

  async scanForDevices(): Promise<BLEDevice[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          this.nearbyDevices.map((device) => ({
            ...device,
            isConnected: this.connected && this.pairedDevice?.id === device.id,
          })),
        );
      }, 900);
    });
  }

  async pair(device: BLEDevice, pin: string): Promise<BLEDevice> {
    if (!isValidPairingPin(pin)) {
      throw new Error('Enter the 7-digit PIN from your pillow label.');
    }
    if (!isCorrectPairingPin(pin)) {
      throw new Error('Incorrect PIN. Check the sticker under the pillow.');
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        this.connected = true;
        this.detectionEnabled = false;
        this.pairedDevice = { ...device, isConnected: true };
        savePairedDevice({
          id: device.id,
          name: device.name,
          bleAddress: device.bleAddress,
          signalStrength: device.signalStrength,
        }).catch(() => undefined);
        this.startLiveMonitoring();
        this.notify();
        resolve(this.pairedDevice);
      }, 900);
    });
  }

  async connect(): Promise<boolean> {
    if (!this.pairedDevice) {
      await this.restoreSession();
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!this.pairedDevice) {
          reject(new Error('No paired pillow. Pair a device first.'));
          return;
        }
        this.connected = true;
        this.detectionEnabled = false;
        this.pairedDevice = { ...this.pairedDevice, isConnected: true };
        this.startLiveMonitoring();
        this.notify();
        resolve(true);
      }, 700);
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.stopLiveMonitoring();
        this.stopMicTestSimulation();
        this.connected = false;
        if (this.pairedDevice) {
          this.pairedDevice = { ...this.pairedDevice, isConnected: false };
        }
        this.notify();
        resolve();
      }, 400);
    });
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

  async fetchSleepEvents(): Promise<SleepEvent[]> {
    await this.hydrateEvents();
    return [...this.mockEvents].sort((a, b) => b.timestamp - a.timestamp);
  }

  async addNewEvent(event: SleepEvent): Promise<void> {
    await this.hydrateEvents();
    if (!this.mockEvents.some((existing) => existing.id === event.id)) {
      this.mockEvents.unshift(event);
    }
    await insertSleepEvent(event);
    this.eventListeners.forEach((listener) => listener(event));
    this.notify();
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    await this.hydrateEvents();
    const before = this.mockEvents.length;
    this.mockEvents = this.mockEvents.filter((event) => event.id !== eventId);
    if (this.mockEvents.length < before) {
      await deleteStoredEvent(eventId);
      return true;
    }
    return false;
  }

  async clearAllData(): Promise<void> {
    await saveIsDataCleared(true);
    this.mockEvents = [];
    this.eventsReady = Promise.resolve();
    await clearStoredEvents();
    this.notifyReload();
    this.notify();
  }

  async clearEvents(): Promise<void> {
    await this.clearAllData();
  }

  async resetAndReseed(): Promise<void> {
    await this.clearAllData();
  }

  async reloadFromStorage(): Promise<SleepEvent[]> {
    await saveIsDataCleared(false);
    this.eventsReady = null;
    const stored = await loadSleepEvents();
    this.mockEvents = stored;
    this.eventsReady = Promise.resolve();
    this.notifyReload();
    this.notify();
    return stored;
  }

  async saveDeviceSettings(settings: DeviceSettings): Promise<DeviceSettings> {
    this.settings = validateDeviceSettings(settings);
    this.snoreStreak = 0;
    this.snoreEventTimes = [];
    await saveDeviceSettings(this.settings);
    return { ...this.settings };
  }

  getDeviceSettings(): DeviceSettings {
    return { ...this.settings };
  }

  /**
   * Prototype safety commands (mock: resets local streak / logs only).
   * Real firmware must implement the matching BLE command packet.
   */
  private detectionEnabled = false;
  private micTestTimer: ReturnType<typeof setInterval> | null = null;
  private micTestListeners = new Set<(preview: import('./esp32Protocol').MicTestPreview) => void>();

  isSnoreDetectionEnabled(): boolean {
    return this.detectionEnabled;
  }

  subscribeMicTest(listener: (preview: import('./esp32Protocol').MicTestPreview) => void): () => void {
    this.micTestListeners.add(listener);
    return () => {
      this.micTestListeners.delete(listener);
    };
  }

  private stopMicTestSimulation() {
    if (this.micTestTimer) {
      clearInterval(this.micTestTimer);
      this.micTestTimer = null;
    }
  }

  private startMicTestSimulation() {
    this.stopMicTestSimulation();
    let tick = 0;
    this.micTestTimer = setInterval(() => {
      tick += 1;
      const phase = tick % 6;
      let preview: import('./esp32Protocol').MicTestPreview;
      if (phase === 0 || phase === 1) {
        preview = { snorePercent: 0, nonSnorePercent: 0, verdict: 'quiet', timestamp: Date.now() };
      } else if (phase === 2 || phase === 3) {
        preview = { snorePercent: 28, nonSnorePercent: 64, verdict: 'non_snore', timestamp: Date.now() };
      } else {
        preview = { snorePercent: 72, nonSnorePercent: 22, verdict: 'snore', timestamp: Date.now() };
      }
      this.micTestListeners.forEach((listener) => {
        try {
          listener(preview);
        } catch {
          // ignore
        }
      });
    }, 700);
  }

  async sendDeviceCommand(
    command:
      | 'emergency_stop'
      | 'open_valve'
      | 'test_pump'
      | 'mute_mic'
      | 'unmute_mic'
      | 'stop_detection'
      | 'start_detection'
      | 'mic_test_start'
      | 'mic_test_stop',
    _argSeconds = 0,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Connect the pillow before using emergency controls.');
    }
    this.snoreStreak = 0;
    this.snoreEventTimes = [];
    if (command === 'stop_detection') {
      this.detectionEnabled = false;
      this.stopLiveMonitoring();
    }
    if (command === 'start_detection') {
      this.detectionEnabled = true;
      this.stopMicTestSimulation();
      this.startLiveMonitoring();
    }
    if (command === 'open_valve') {
      this.startLiveMonitoring();
    }
    if (command === 'mic_test_start') {
      if (this.detectionEnabled) {
        throw new Error('Pause overnight detection before testing the mic.');
      }
      this.startMicTestSimulation();
    }
    if (command === 'mic_test_stop') {
      this.stopMicTestSimulation();
    }
    if (__DEV__) {
      console.log(`[mock BLE] command ${command}`);
    }
    this.notify();
  }

  getIsConnected(): boolean {
    return this.connected;
  }

  isPaired(): boolean {
    return this.pairedDevice !== null;
  }
}

// Get sample recommendations based on current data
export const getSampleRecommendations = () => {
  return {
    normal: {
      title: 'Sleep Health: Normal',
      description: 'Your sleep quality is within normal range.',
      actions: [
        'Maintain consistent sleep schedule',
        'Keep bedroom cool and dark',
        'Avoid screens before bed',
      ],
    },
    bad: {
      title: 'Sleep Health: Elevated',
      description: 'Your snoring frequency is higher than normal.',
      actions: [
        'Try sleeping on your side',
        'Consider weight management',
        'Use a humidifier in your bedroom',
      ],
    },
    danger: {
      title: 'Sleep Health: Critical',
      description: 'Your snoring frequency requires professional attention.',
      actions: [
        'Schedule appointment with sleep specialist',
        'Consider sleep study evaluation',
        'Track symptoms carefully',
      ],
    },
  };
};

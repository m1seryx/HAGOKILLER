export interface DeviceSettings {
  /** Snore events needed inside the window before the pump fires (1–10). */
  snoreThreshold: number;
  /** Rolling window in seconds for counting snore events (5–60). */
  snoreWindowSec: number;
  /** Pump run time in seconds (5–120). */
  pumpDuration: number;
  /** I2S right-shift. Higher = less sensitive (12–16). */
  micShift: number;
}

export const PUMP_DURATION_MIN_SEC = 5;
export const PUMP_DURATION_MAX_SEC = 120;
export const PUMP_DURATION_STEP_SEC = 5;

export const SNORE_WINDOW_MIN_SEC = 5;
export const SNORE_WINDOW_MAX_SEC = 60;
export const SNORE_WINDOW_STEP_SEC = 5;

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  snoreThreshold: 3,
  snoreWindowSec: 15,
  pumpDuration: 12,
  micShift: 15,
};

function snapPumpSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_DEVICE_SETTINGS.pumpDuration;
  const clamped = Math.min(
    PUMP_DURATION_MAX_SEC,
    Math.max(PUMP_DURATION_MIN_SEC, Math.round(raw)),
  );
  const stepped =
    Math.round(clamped / PUMP_DURATION_STEP_SEC) * PUMP_DURATION_STEP_SEC;
  return Math.min(
    PUMP_DURATION_MAX_SEC,
    Math.max(PUMP_DURATION_MIN_SEC, stepped),
  );
}

function snapWindowSeconds(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_DEVICE_SETTINGS.snoreWindowSec;
  const clamped = Math.min(
    SNORE_WINDOW_MAX_SEC,
    Math.max(SNORE_WINDOW_MIN_SEC, Math.round(raw)),
  );
  const stepped =
    Math.round(clamped / SNORE_WINDOW_STEP_SEC) * SNORE_WINDOW_STEP_SEC;
  return Math.min(
    SNORE_WINDOW_MAX_SEC,
    Math.max(SNORE_WINDOW_MIN_SEC, stepped),
  );
}

export function normalizeDeviceSettings(
  raw?: Partial<DeviceSettings> | null,
): DeviceSettings {
  const snore = Math.round(Number(raw?.snoreThreshold ?? DEFAULT_DEVICE_SETTINGS.snoreThreshold));
  const window = snapWindowSeconds(
    Number(raw?.snoreWindowSec ?? DEFAULT_DEVICE_SETTINGS.snoreWindowSec),
  );
  const pump = snapPumpSeconds(Number(raw?.pumpDuration ?? DEFAULT_DEVICE_SETTINGS.pumpDuration));
  const shift = Math.round(Number(raw?.micShift ?? DEFAULT_DEVICE_SETTINGS.micShift));

  return {
    snoreThreshold: Math.min(10, Math.max(1, Number.isFinite(snore) ? snore : 3)),
    snoreWindowSec: window,
    pumpDuration: pump,
    micShift: Math.min(16, Math.max(12, Number.isFinite(shift) ? shift : 14)),
  };
}

export function validateDeviceSettings(settings: DeviceSettings): DeviceSettings {
  if (
    !Number.isFinite(settings.snoreThreshold) ||
    settings.snoreThreshold < 1 ||
    settings.snoreThreshold > 10
  ) {
    throw new Error('Snore threshold must be between 1 and 10 events');
  }
  if (
    !Number.isFinite(settings.snoreWindowSec) ||
    settings.snoreWindowSec < SNORE_WINDOW_MIN_SEC ||
    settings.snoreWindowSec > SNORE_WINDOW_MAX_SEC
  ) {
    throw new Error(
      `Snore window must be between ${SNORE_WINDOW_MIN_SEC} and ${SNORE_WINDOW_MAX_SEC} seconds`,
    );
  }
  if (
    !Number.isFinite(settings.pumpDuration) ||
    settings.pumpDuration < PUMP_DURATION_MIN_SEC ||
    settings.pumpDuration > PUMP_DURATION_MAX_SEC
  ) {
    throw new Error(
      `Pump duration must be between ${PUMP_DURATION_MIN_SEC} and ${PUMP_DURATION_MAX_SEC} seconds`,
    );
  }
  if (
    !Number.isFinite(settings.micShift) ||
    settings.micShift < 12 ||
    settings.micShift > 16
  ) {
    throw new Error('Mic shift must be between 12 and 16');
  }
  return normalizeDeviceSettings(settings);
}

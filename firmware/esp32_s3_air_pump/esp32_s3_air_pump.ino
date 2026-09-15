/*
 * HAGOKILLER - ESP32-S3 air pump + solenoid receiver
 * Board: ESP32S3 Dev Module
 * Serial: 115200
 *
 * BTS7960 wiring (pump on M+, solenoid on M-):
 *   VCC   -> 3.3V
 *   GND   -> ESP32 GND (= B-)
 *   R_EN  -> 3.3V
 *   L_EN  -> 3.3V
 *   RPWM  -> GPIO 18   (air pump -> M+)
 *   LPWM  -> GPIO 17   (solenoid -> M-)
 *   B+    -> jack red (supply +)
 *   B-    -> common GND (jack + pump + solenoid)
 *   M+    -> air pump red (+)
 *   M-    -> solenoid red (+)
 *
 * Never drive pump and solenoid HIGH at the same time.
 *
 * Pillow cycle:
 *   FLAT + intervene     -> full pump (settings seconds) -> ELEVATED
 *   ELEVATED + still snore -> top-up pump 2s
 *                           -> wait 1 min -> solenoid OPEN 3s (partial)
 *                           -> if still snoring: gradual short valve pulses
 *   Quiet while elevated  -> start 10 min hold (5 min checkpoint log)
 *                           -> solenoid OPEN 10s (full deflate) -> FLAT
 *
 * ESP-NOW events from mic:
 *   1 = sound / intervention (full or top-up; pumpSeconds in packet)
 *   2 = heartbeat
 *   3 = manual stop pump
 *   4 = open solenoid valve (manual / full deflate)
 *   5 = snore still active while elevated (no pump)
 */

#include <WiFi.h>
#include <esp_wifi.h>
#include <esp_now.h>
#include <string.h>
#include <ctype.h>
#include "esp32-hal-rgb-led.h"
#include "driver/gpio.h"

#define RPWM_PIN 18
#define LPWM_PIN 17
#define ESPNOW_CHANNEL 1
#define MIC_TIMEOUT_MS 8000

#define PUMP_SEC_MIN 5
#define PUMP_SEC_MAX 120
#define PUMP_SEC_DEFAULT 12

#define TOPUP_SEC 2
#define TOPUP_COOLDOWN_MS 90000UL

#define PARTIAL_VALVE_DELAY_MS 60000UL
#define PARTIAL_VALVE_SEC 3

#define GRADUAL_VALVE_SEC 2
#define GRADUAL_VALVE_INTERVAL_MS 40000UL
#define GRADUAL_VALVE_MAX 8

#define QUIET_CONFIRM_MS 30000UL
#define QUIET_CHECKPOINT_MS (5UL * 60UL * 1000UL)
#define QUIET_HOLD_MS (10UL * 60UL * 1000UL)

#define VALVE_SEC_DEFAULT 10
#define VALVE_SEC_MIN 1
#define VALVE_SEC_MAX 30

#if defined(RGB_BUILTIN)
  #define RGB_LED_PIN RGB_BUILTIN
#else
  #define RGB_LED_PIN 48
#endif

typedef struct __attribute__((packed)) {
  uint32_t magic;
  uint8_t  event;
  uint8_t  level;
  uint16_t rms;
  uint8_t  pumpSeconds;
  uint8_t  streak;
  uint8_t  flags;
  uint8_t  reserved;
} PumpMsg;

static const uint32_t MSG_MAGIC = 0x48474F4B;
static const uint8_t EVENT_SOUND = 1;
static const uint8_t EVENT_HEARTBEAT = 2;
static const uint8_t EVENT_STOP = 3;
static const uint8_t EVENT_OPEN_VALVE = 4;
static const uint8_t EVENT_SNORE_ACTIVE = 5;
static const uint8_t FLAG_INTERVENTION = 0x01;

enum PillowPhase : uint8_t {
  PHASE_FLAT = 0,
  PHASE_FULL_PUMP,
  PHASE_ELEVATED,
  PHASE_TOPUP_PUMP,
  PHASE_WAIT_PARTIAL,
  PHASE_PARTIAL_VALVE,
  PHASE_GRADUAL,
  PHASE_QUIET_HOLD,
  PHASE_FULL_DEFLATE
};

volatile bool gotTrigger = false;
volatile bool gotStop = false;
volatile bool gotValve = false;
volatile bool gotSnoreActive = false;
volatile bool micHeard = false;
volatile uint8_t lastLevel = 0;
volatile uint16_t lastRms = 0;
volatile uint8_t lastSeconds = PUMP_SEC_DEFAULT;
volatile uint8_t lastStreak = 0;
volatile uint8_t lastValveSeconds = VALVE_SEC_DEFAULT;
volatile bool lastTriggerIsTopup = false;

unsigned long lastWaitPrintMs = 0;
unsigned long lastPumpPrintMs = 0;
unsigned long lastMicHeardMs = 0;
unsigned long pumpUntilMs = 0;
unsigned long valveUntilMs = 0;
unsigned long lastSnoreMs = 0;
unsigned long lastTopupMs = 0;
unsigned long partialDueMs = 0;
unsigned long gradualNextMs = 0;
unsigned long quietSinceMs = 0;
unsigned long lastPhasePrintMs = 0;
uint8_t gradualCount = 0;
bool pumping = false;
bool valveOpen = false;
bool printedConnected = false;
bool quietCheckpointDone = false;
PillowPhase phase = PHASE_FLAT;

void setRgb(uint8_t r, uint8_t g, uint8_t b) {
  neopixelWrite(RGB_LED_PIN, r, g, b);
}

void bothOutputsOff() {
  digitalWrite(RPWM_PIN, LOW);
  digitalWrite(LPWM_PIN, LOW);
}

void pumpOn() {
  digitalWrite(LPWM_PIN, LOW);  // never both
  digitalWrite(RPWM_PIN, HIGH);
}

void pumpOffOnly() {
  digitalWrite(RPWM_PIN, LOW);
}

void valveOn() {
  digitalWrite(RPWM_PIN, LOW);  // never both
  digitalWrite(LPWM_PIN, HIGH);
}

void valveOffOnly() {
  digitalWrite(LPWM_PIN, LOW);
}

void initDriverSafe() {
  pinMode(RPWM_PIN, OUTPUT);
  pinMode(LPWM_PIN, OUTPUT);
  bothOutputsOff();
}

__attribute__((constructor)) void bootOutputsOffEarly() {
  pinMode(RPWM_PIN, OUTPUT);
  pinMode(LPWM_PIN, OUTPUT);
  bothOutputsOff();
}

uint8_t clampPumpSeconds(uint8_t seconds) {
  if (seconds < PUMP_SEC_MIN) return PUMP_SEC_DEFAULT;
  if (seconds > PUMP_SEC_MAX) return PUMP_SEC_MAX;
  return seconds;
}

uint8_t clampValveSeconds(uint8_t seconds) {
  if (seconds == 0) return VALVE_SEC_DEFAULT;
  if (seconds < VALVE_SEC_MIN) return VALVE_SEC_MIN;
  if (seconds > VALVE_SEC_MAX) return VALVE_SEC_MAX;
  return seconds;
}

const char *phaseName(PillowPhase p) {
  switch (p) {
    case PHASE_FLAT: return "FLAT";
    case PHASE_FULL_PUMP: return "FULL_PUMP";
    case PHASE_ELEVATED: return "ELEVATED";
    case PHASE_TOPUP_PUMP: return "TOPUP_PUMP";
    case PHASE_WAIT_PARTIAL: return "WAIT_PARTIAL";
    case PHASE_PARTIAL_VALVE: return "PARTIAL_VALVE";
    case PHASE_GRADUAL: return "GRADUAL";
    case PHASE_QUIET_HOLD: return "QUIET_HOLD";
    case PHASE_FULL_DEFLATE: return "FULL_DEFLATE";
    default: return "?";
  }
}

void setPhase(PillowPhase next) {
  if (phase == next) return;
  phase = next;
  Serial.print("phase -> ");
  Serial.println(phaseName(phase));
}

void markMicHeard() {
  lastMicHeardMs = millis();
  micHeard = true;
  if (!printedConnected) {
    printedConnected = true;
    Serial.println("connected to espmic");
  }
}

void noteSnoreActivity(unsigned long now) {
  lastSnoreMs = now;
  if (phase == PHASE_QUIET_HOLD) {
    quietSinceMs = 0;
    quietCheckpointDone = false;
    setPhase(PHASE_GRADUAL);
    gradualNextMs = now;
    Serial.println("snore during quiet hold -> GRADUAL");
  }
}

void printDriverConfig() {
  Serial.println("Driver: BTS7960 (pump M+ / solenoid M-)");
  Serial.println("  VCC  -> 3.3V");
  Serial.println("  GND  -> GND (= B-)");
  Serial.println("  R_EN / L_EN -> 3.3V");
  Serial.print("  RPWM -> GPIO ");
  Serial.print(RPWM_PIN);
  Serial.println("  (air pump)");
  Serial.print("  LPWM -> GPIO ");
  Serial.print(LPWM_PIN);
  Serial.println("  (solenoid)");
  Serial.println("  B+ = jack red | B- = common GND");
  Serial.println("  M+ = pump red | M- = solenoid red");
  Serial.println();
  Serial.println("Cycle: full inflate -> elevated top-up/partial/gradual -> 10min quiet -> 10s deflate");
  Serial.println();
}

void stopValve() {
  if (!valveOpen) {
    valveOffOnly();
    return;
  }
  valveOpen = false;
  valveOffOnly();
  setRgb(0, 40, 0);
  Serial.println("solenoid closed");
}

void stopPumping() {
  if (!pumping) {
    pumpOffOnly();
    return;
  }
  pumping = false;
  pumpOffOnly();
  setRgb(0, 40, 0);
  Serial.println("pump done");
}

void resetToFlat(const char *reason) {
  gotTrigger = false;
  gotValve = false;
  gotSnoreActive = false;
  pumping = false;
  valveOpen = false;
  bothOutputsOff();
  partialDueMs = 0;
  gradualNextMs = 0;
  gradualCount = 0;
  quietSinceMs = 0;
  quietCheckpointDone = false;
  setPhase(PHASE_FLAT);
  setRgb(40, 0, 0);
  Serial.print("RESET FLAT: ");
  Serial.println(reason);
  delay(80);
  setRgb(0, 40, 0);
}

void forceStopAll(const char *reason) {
  resetToFlat(reason);
}

void startPumpingSeconds(unsigned long now, uint8_t seconds, bool isTopup) {
  if (valveOpen) stopValve();
  lastSeconds = seconds;
  unsigned long durationMs = (unsigned long)seconds * 1000UL;
  pumpUntilMs = now + durationMs;
  pumping = true;
  lastPumpPrintMs = now;
  pumpOn();
  setRgb(0, 180, 255);
  Serial.print(isTopup ? "TOP-UP pumping...  " : "air pumping...  ");
  Serial.print(seconds);
  Serial.print(" sec  streak=");
  Serial.print(lastStreak);
  Serial.print("  VOL=");
  Serial.print(lastLevel);
  Serial.print("/10  RMS=");
  Serial.println(lastRms);
}

void startValveSeconds(unsigned long now, uint8_t seconds) {
  if (pumping) stopPumping();
  uint8_t secs = clampValveSeconds(seconds);
  lastValveSeconds = secs;
  valveUntilMs = now + (unsigned long)secs * 1000UL;
  valveOpen = true;
  valveOn();
  setRgb(255, 120, 0);
  Serial.print("solenoid OPEN...  ");
  Serial.print(secs);
  Serial.println(" sec");
}

void beginQuietHold(unsigned long now) {
  if (quietSinceMs == 0) {
    quietSinceMs = now;
    quietCheckpointDone = false;
    Serial.println("quiet while elevated -> start 10 min hold");
  }
  setPhase(PHASE_QUIET_HOLD);
}

void schedulePartialAfterTopup(unsigned long now) {
  partialDueMs = now + PARTIAL_VALVE_DELAY_MS;
  setPhase(PHASE_WAIT_PARTIAL);
  Serial.println("scheduled partial deflate: solenoid 3s after 1 min");
}

void handleIntervention(unsigned long now) {
  noteSnoreActivity(now);

  if (phase == PHASE_FLAT) {
    uint8_t secs = clampPumpSeconds(lastSeconds == 0 ? PUMP_SEC_DEFAULT : lastSeconds);
    startPumpingSeconds(now, secs, false);
    setPhase(PHASE_FULL_PUMP);
    return;
  }

  // Already elevated (or in elevated sub-cycle): short top-up only.
  if (pumping || valveOpen) {
    Serial.println("actuator busy - top-up deferred");
    return;
  }
  if (lastTopupMs != 0 && (now - lastTopupMs) < TOPUP_COOLDOWN_MS) {
    Serial.println("top-up cooldown - snore noted for gradual/quiet only");
    if (phase == PHASE_ELEVATED || phase == PHASE_QUIET_HOLD) {
      setPhase(PHASE_GRADUAL);
      gradualNextMs = now;
    }
    return;
  }

  lastTopupMs = now;
  startPumpingSeconds(now, TOPUP_SEC, true);
  setPhase(PHASE_TOPUP_PUMP);
}

void printSerialHelp() {
  Serial.println();
  Serial.println("Serial commands:");
  Serial.println("  p / pump   = pump ON 5s");
  Serial.println("  v / valve  = solenoid OPEN 5s");
  Serial.println("  o / off / s / stop = stop + reset FLAT");
  Serial.println("  help       = this list");
  Serial.println();
}

void handleSerialCommands() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();
  line.toLowerCase();
  if (line.length() == 0) return;

  unsigned long now = millis();

  if (line == "p" || line == "pump" || line == "t" || line == "test" || line == "on" || line == "1") {
    lastSeconds = 5;
    lastStreak = 0;
    lastLevel = 0;
    lastRms = 0;
    Serial.println("manual test: pump ON for 5 sec");
    startPumpingSeconds(now, 5, false);
    setPhase(PHASE_FULL_PUMP);
  } else if (line == "v" || line == "valve" || line == "solenoid") {
    Serial.println("manual test: solenoid OPEN for 5 sec");
    startValveSeconds(now, 5);
    setPhase(PHASE_FULL_DEFLATE);
  } else if (line == "off" || line == "0" || line == "s" || line == "stop" || line == "o") {
    forceStopAll("manual serial stop");
  } else if (line == "help" || line == "h" || line == "?") {
    printSerialHelp();
  } else {
    Serial.print("unknown command: ");
    Serial.println(line);
    printSerialHelp();
  }
}

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
#else
void onDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
#endif
  if (len < 8) return;

  PumpMsg msg;
  memset(&msg, 0, sizeof(msg));
  memcpy(&msg, data, len < (int)sizeof(msg) ? len : sizeof(msg));

  if (msg.magic != MSG_MAGIC) return;

  if (msg.event == EVENT_HEARTBEAT) {
    markMicHeard();
    return;
  }

  if (msg.event == EVENT_STOP) {
    markMicHeard();
    gotStop = true;
    return;
  }

  if (msg.event == EVENT_OPEN_VALVE) {
    markMicHeard();
    lastValveSeconds = clampValveSeconds(msg.pumpSeconds);
    gotValve = true;
    return;
  }

  if (msg.event == EVENT_SNORE_ACTIVE) {
    markMicHeard();
    gotSnoreActive = true;
    lastLevel = msg.level;
    lastRms = msg.rms;
    lastStreak = msg.streak;
    return;
  }

  if (msg.event != EVENT_SOUND) return;

  markMicHeard();

  if ((msg.flags & FLAG_INTERVENTION) == 0) {
    Serial.println("ESP-NOW ignored (not an intervention packet)");
    return;
  }

  Serial.println("ESP-NOW intervention received");
  lastLevel = msg.level;
  lastRms = msg.rms;
  lastStreak = msg.streak;
  // Short duration (<=4s) = elevated top-up from mic; else full inflate.
  lastTriggerIsTopup = (msg.pumpSeconds > 0 && msg.pumpSeconds <= 4);
  lastSeconds = lastTriggerIsTopup
      ? msg.pumpSeconds
      : clampPumpSeconds(msg.pumpSeconds == 0 ? PUMP_SEC_DEFAULT : msg.pumpSeconds);
  gotTrigger = true;
}

void setup() {
  initDriverSafe();

  Serial.begin(115200);
  delay(800);

  bothOutputsOff();
  setRgb(0, 0, 40);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" HAGOKILLER AIR PUMP + SOLENOID");
  Serial.println("======================================");
  printDriverConfig();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);
  Serial.print("Pump MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.print("ESP-NOW channel: ");
  Serial.println(ESPNOW_CHANNEL);

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init fail");
    while (true) {
      setRgb(255, 0, 0);
      delay(300);
      setRgb(0, 0, 0);
      delay(300);
    }
  }

  esp_now_register_recv_cb(onDataRecv);
  setRgb(0, 40, 0);
  Serial.println("listening for mic ESP-NOW...");
  Serial.println("waiting for mic...");
  printSerialHelp();
}

void loop() {
  unsigned long now = millis();

  handleSerialCommands();

  if (micHeard && (long)(now - lastMicHeardMs) >= (long)MIC_TIMEOUT_MS) {
    micHeard = false;
    printedConnected = false;
    Serial.println("mic link lost - waiting for mic...");
  }

  if (gotStop) {
    gotStop = false;
    forceStopAll("app / mic manual stop");
  }

  if (gotValve) {
    gotValve = false;
    // Manual / mic full deflate request.
    startValveSeconds(now, lastValveSeconds);
    setPhase(PHASE_FULL_DEFLATE);
  }

  if (gotSnoreActive) {
    gotSnoreActive = false;
    noteSnoreActivity(now);
    Serial.println("snore-active while elevated");
  }

  if (gotTrigger) {
    gotTrigger = false;
    if (lastTriggerIsTopup && phase == PHASE_FLAT) {
      // Mic thought elevated but pump is flat — treat as full inflate with default.
      lastSeconds = PUMP_SEC_DEFAULT;
      lastTriggerIsTopup = false;
    }
    if (phase == PHASE_FLAT) {
      handleIntervention(now);
    } else if (pumping) {
      Serial.println("pump busy - extra ESP-NOW packet ignored");
      noteSnoreActivity(now);
    } else {
      // Force top-up path even if packet carried full seconds.
      if (!lastTriggerIsTopup) lastSeconds = TOPUP_SEC;
      handleIntervention(now);
    }
  }

  // --- actuator completion ---
  if (valveOpen) {
    if ((long)(now - valveUntilMs) >= 0) {
      stopValve();
      if (phase == PHASE_PARTIAL_VALVE) {
        // After first partial: if recent snore -> gradual, else quiet hold.
        if (lastSnoreMs != 0 && (now - lastSnoreMs) < QUIET_CONFIRM_MS) {
          gradualCount = 0;
          gradualNextMs = now + GRADUAL_VALVE_INTERVAL_MS;
          setPhase(PHASE_GRADUAL);
          Serial.println("still snoring after partial -> GRADUAL pulses");
        } else {
          beginQuietHold(now);
        }
      } else if (phase == PHASE_FULL_DEFLATE) {
        resetToFlat("full deflate done");
      } else if (phase == PHASE_GRADUAL) {
        // Stay in gradual; next pulse scheduled separately.
      }
    }
  }

  if (pumping) {
    if ((long)(now - pumpUntilMs) >= 0) {
      stopPumping();
      if (phase == PHASE_FULL_PUMP) {
        lastSnoreMs = now;
        quietSinceMs = 0;
        setPhase(PHASE_ELEVATED);
        Serial.println("elevated hold — listen for continued snoring");
      } else if (phase == PHASE_TOPUP_PUMP) {
        schedulePartialAfterTopup(now);
      }
    } else if (now - lastPumpPrintMs >= 10000) {
      lastPumpPrintMs = now;
      unsigned long leftSec = (pumpUntilMs - now) / 1000UL;
      Serial.print("air pumping... ");
      Serial.print(leftSec);
      Serial.println("s left");
    }
  }

  // --- elevated timers (only when not actuating) ---
  if (!pumping && !valveOpen) {
    if (phase == PHASE_WAIT_PARTIAL && partialDueMs != 0 && (long)(now - partialDueMs) >= 0) {
      partialDueMs = 0;
      startValveSeconds(now, PARTIAL_VALVE_SEC);
      setPhase(PHASE_PARTIAL_VALVE);
    }

    if (phase == PHASE_GRADUAL) {
      bool stillSnoring = (lastSnoreMs != 0 && (now - lastSnoreMs) < QUIET_CONFIRM_MS);
      if (!stillSnoring) {
        beginQuietHold(now);
      } else if (gradualCount < GRADUAL_VALVE_MAX && (long)(now - gradualNextMs) >= 0) {
        startValveSeconds(now, GRADUAL_VALVE_SEC);
        gradualCount++;
        gradualNextMs = now + GRADUAL_VALVE_INTERVAL_MS;
        Serial.print("gradual deflate pulse ");
        Serial.print(gradualCount);
        Serial.print("/");
        Serial.println(GRADUAL_VALVE_MAX);
      } else if (gradualCount >= GRADUAL_VALVE_MAX) {
        Serial.println("gradual pulse limit — start quiet hold");
        beginQuietHold(now);
      }
    }

    if (phase == PHASE_ELEVATED || phase == PHASE_WAIT_PARTIAL) {
      // No recent snore while elevated -> start quiet countdown.
      if (lastSnoreMs != 0 && (now - lastSnoreMs) >= QUIET_CONFIRM_MS) {
        beginQuietHold(now);
      }
    }

    if (phase == PHASE_QUIET_HOLD && quietSinceMs != 0) {
      unsigned long quietFor = now - quietSinceMs;
      if (!quietCheckpointDone && quietFor >= QUIET_CHECKPOINT_MS) {
        quietCheckpointDone = true;
        Serial.println("quiet hold 5 min checkpoint — still elevated");
      }
      if (quietFor >= QUIET_HOLD_MS) {
        Serial.println("quiet hold 10 min — full deflate 10s");
        startValveSeconds(now, VALVE_SEC_DEFAULT);
        setPhase(PHASE_FULL_DEFLATE);
      }
    }
  }

  if (!pumping && !valveOpen && now - lastWaitPrintMs >= 3000) {
    lastWaitPrintMs = now;
    if (micHeard) {
      Serial.print("phase=");
      Serial.print(phaseName(phase));
      Serial.println(" | connected to espmic");
    } else {
      Serial.println("waiting for mic...");
    }
  }

  if (phase != PHASE_FLAT && now - lastPhasePrintMs >= 30000) {
    lastPhasePrintMs = now;
    Serial.print("status phase=");
    Serial.println(phaseName(phase));
  }

  delay(20);
}

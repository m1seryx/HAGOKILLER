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
 *   intervention        -> one fixed pump burst of packet seconds -> ELEVATED
 *   ELEVATED            -> stays elevated, no automatic deflation
 *   max 3 bursts        -> holds position, valve never opens by itself
 *   Manual open valve   -> releases air -> FLAT (burst count reset)
 *
 * ESP-NOW events from mic:
 *   1 = intervention (pump burst; pumpSeconds = burst length;
 *       flag 0x02 = new inflation from flat -> resets burst count)
 *   2 = heartbeat
 *   3 = stop pump (burst done / manual stop)
 *   4 = open solenoid valve (manual)
 *   8 = test pump (manual, no state change)
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

#define PUMP_SEC_MAX 120
#define PUMP_SEC_DEFAULT 40
/** Backup of the mic's limit: one pump run per inflation. */
#define MAX_BURSTS_PER_INFLATION 1

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
static const uint8_t EVENT_TEST_PUMP = 8;
static const uint8_t FLAG_INTERVENTION = 0x01;
static const uint8_t FLAG_NEW_CYCLE = 0x02;

enum PillowPhase : uint8_t {
  PHASE_FLAT = 0,
  PHASE_ELEVATED
};

volatile bool gotTrigger = false;
volatile bool gotStop = false;
volatile bool gotValve = false;
volatile bool gotTestPump = false;
volatile uint8_t lastTestSeconds = 5;
volatile bool lastNewCycle = false;
volatile bool micHeard = false;
volatile uint8_t lastLevel = 0;
volatile uint16_t lastRms = 0;
volatile uint8_t lastSeconds = PUMP_SEC_DEFAULT;
volatile uint8_t lastStreak = 0;
volatile uint8_t lastValveSeconds = VALVE_SEC_DEFAULT;

unsigned long lastWaitPrintMs = 0;
unsigned long lastPumpPrintMs = 0;
unsigned long lastMicHeardMs = 0;
unsigned long pumpStartMs = 0;
unsigned long pumpUntilMs = 0;
unsigned long valveUntilMs = 0;
uint8_t burstCount = 0;
bool pumping = false;
bool pumpIsRepump = false;
bool pumpIsManualTest = false;
bool valveOpen = false;
bool printedConnected = false;
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
  if (seconds == 0) return PUMP_SEC_DEFAULT;
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
  return p == PHASE_ELEVATED ? "ELEVATED" : "FLAT";
}

void setPhase(PillowPhase next) {
  if (phase == next) return;
  phase = next;
  Serial.print("phase -> ");
  Serial.println(phaseName(phase));
}

void resetInflation() {
  setPhase(PHASE_FLAT);
  burstCount = 0;
}

void markMicHeard() {
  lastMicHeardMs = millis();
  micHeard = true;
  if (!printedConnected) {
    printedConnected = true;
    Serial.println("connected to espmic");
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
  Serial.println("Cycle: one pump run (app sets the seconds) -> stay elevated -> valve only from app");
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

void stopPumping(unsigned long now, const char *reason) {
  if (!pumping) {
    pumpOffOnly();
    return;
  }
  unsigned long ranMs = now - pumpStartMs;
  pumping = false;
  pumpOffOnly();
  setRgb(0, 40, 0);

  if (!pumpIsManualTest) setPhase(PHASE_ELEVATED);

  Serial.print("pump stopped (");
  Serial.print(reason);
  Serial.print(") ran ");
  Serial.print(ranMs / 1000.0f, 1);
  Serial.print("s  bursts ");
  Serial.print(burstCount);
  Serial.print("/");
  Serial.println(MAX_BURSTS_PER_INFLATION);
}

void forceStopAll(unsigned long now, const char *reason) {
  gotTrigger = false;
  stopPumping(now, reason);
  stopValve();
  bothOutputsOff();
  setRgb(40, 0, 0);
  Serial.print("STOP: ");
  Serial.println(reason);
  delay(80);
  setRgb(0, 40, 0);
}

void startPumpingSeconds(unsigned long now, uint8_t seconds, bool isRepump, bool manualTest) {
  if (valveOpen) stopValve();
  pumpStartMs = now;
  pumpUntilMs = now + (unsigned long)seconds * 1000UL;
  pumpIsRepump = isRepump;
  pumpIsManualTest = manualTest;
  pumping = true;
  lastPumpPrintMs = now;
  pumpOn();
  setRgb(0, 180, 255);
  Serial.print(isRepump ? "PUMP BURST (elevated)... " : "air pumping... ");
  Serial.print(seconds);
  Serial.print(" sec  streak=");
  Serial.print(lastStreak);
  Serial.print("  VOL=");
  Serial.print(lastLevel);
  Serial.print("/10  RMS=");
  Serial.println(lastRms);
}

void startValveSeconds(unsigned long now, uint8_t seconds) {
  if (pumping) stopPumping(now, "valve opened");
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

void handleIntervention(unsigned long now) {
  if (pumping) {
    Serial.println("pump busy - burst ignored");
    return;
  }

  if (lastNewCycle) resetInflation();

  if (burstCount >= MAX_BURSTS_PER_INFLATION) {
    Serial.println("burst limit reached - pillow stays elevated");
    return;
  }

  bool elevated = phase == PHASE_ELEVATED;
  burstCount++;
  startPumpingSeconds(now, clampPumpSeconds(lastSeconds), elevated, false);
}

void printSerialHelp() {
  Serial.println();
  Serial.println("Serial commands:");
  Serial.println("  p / pump   = pump ON 5s");
  Serial.println("  v / valve  = solenoid OPEN 5s");
  Serial.println("  o / off / s / stop = stop pump + close valve");
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
    lastStreak = 0;
    lastLevel = 0;
    lastRms = 0;
    Serial.println("manual test: pump ON for 5 sec");
    startPumpingSeconds(now, 5, false, true);
  } else if (line == "v" || line == "valve" || line == "solenoid") {
    Serial.println("manual test: solenoid OPEN for 5 sec");
    startValveSeconds(now, 5);
    resetInflation();
  } else if (line == "off" || line == "0" || line == "s" || line == "stop" || line == "o") {
    forceStopAll(now, "manual serial stop");
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

  if (msg.event == EVENT_TEST_PUMP) {
    markMicHeard();
    lastTestSeconds = msg.pumpSeconds == 0 ? 5 : (msg.pumpSeconds > 10 ? 10 : msg.pumpSeconds);
    gotTestPump = true;
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
  lastSeconds = msg.pumpSeconds;
  lastNewCycle = (msg.flags & FLAG_NEW_CYCLE) != 0;
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
    gotTrigger = false;
    if (pumping) {
      stopPumping(now, "stop from mic/app");
    } else {
      forceStopAll(now, "app / mic manual stop");
    }
  }

  if (gotValve) {
    gotValve = false;
    startValveSeconds(now, lastValveSeconds);
    resetInflation();
  }

  if (gotTestPump) {
    gotTestPump = false;
    if (pumping) {
      Serial.println("test pump ignored - pump already running");
    } else {
      lastStreak = 0;
      lastLevel = 0;
      lastRms = 0;
      Serial.print("app test: pump ON for ");
      Serial.print(lastTestSeconds);
      Serial.println(" sec");
      startPumpingSeconds(now, lastTestSeconds, false, true);
    }
  }

  if (gotTrigger) {
    gotTrigger = false;
    handleIntervention(now);
  }

  if (valveOpen && (long)(now - valveUntilMs) >= 0) {
    stopValve();
  }

  if (pumping) {
    if ((long)(now - pumpUntilMs) >= 0) {
      stopPumping(now, "burst done");
    } else if (now - lastPumpPrintMs >= 5000) {
      lastPumpPrintMs = now;
      Serial.print("air pumping... ");
      Serial.print((pumpUntilMs - now) / 1000UL);
      Serial.println("s left max");
    }
  } else if (!valveOpen && now - lastWaitPrintMs >= 3000) {
    lastWaitPrintMs = now;
    if (micHeard) {
      Serial.print("phase=");
      Serial.print(phaseName(phase));
      Serial.println(" | connected to espmic");
    } else {
      Serial.println("waiting for mic...");
    }
  }

  delay(20);
}

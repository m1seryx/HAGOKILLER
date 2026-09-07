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
 * ESP-NOW events from mic:
 *   1 = sound / intervention (pump)
 *   2 = heartbeat
 *   3 = manual stop pump
 *   4 = open solenoid valve
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
#define VALVE_SEC_DEFAULT 8
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
static const uint8_t FLAG_INTERVENTION = 0x01;

volatile bool gotTrigger = false;
volatile bool gotStop = false;
volatile bool gotValve = false;
volatile bool micHeard = false;
volatile uint8_t lastLevel = 0;
volatile uint16_t lastRms = 0;
volatile uint8_t lastSeconds = PUMP_SEC_DEFAULT;
volatile uint8_t lastStreak = 0;
volatile uint8_t lastValveSeconds = VALVE_SEC_DEFAULT;

unsigned long lastWaitPrintMs = 0;
unsigned long lastPumpPrintMs = 0;
unsigned long lastMicHeardMs = 0;
unsigned long pumpUntilMs = 0;
unsigned long valveUntilMs = 0;
bool pumping = false;
bool valveOpen = false;
bool printedConnected = false;

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
  Serial.println("Waits for mic ESP-NOW heartbeat / pump / valve commands.");
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

void forceStopAll(const char *reason) {
  gotTrigger = false;
  pumping = false;
  valveOpen = false;
  bothOutputsOff();
  setRgb(40, 0, 0);
  Serial.print("STOP: ");
  Serial.println(reason);
  delay(80);
  setRgb(0, 40, 0);
}

void startPumping(unsigned long now) {
  if (valveOpen) stopValve();
  unsigned long durationMs = (unsigned long)lastSeconds * 1000UL;
  pumpUntilMs = now + durationMs;
  pumping = true;
  lastPumpPrintMs = now;
  pumpOn();
  setRgb(0, 180, 255);
  Serial.print("air pumping...  ");
  Serial.print(lastSeconds);
  Serial.print(" sec  streak=");
  Serial.print(lastStreak);
  Serial.print("  VOL=");
  Serial.print(lastLevel);
  Serial.print("/10  RMS=");
  Serial.println(lastRms);
}

void startValve(unsigned long now) {
  if (pumping) stopPumping();
  uint8_t secs = clampValveSeconds(lastValveSeconds);
  valveUntilMs = now + (unsigned long)secs * 1000UL;
  valveOpen = true;
  valveOn();
  setRgb(255, 120, 0);
  Serial.print("solenoid OPEN...  ");
  Serial.print(secs);
  Serial.println(" sec");
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
    lastSeconds = 5;
    lastStreak = 0;
    lastLevel = 0;
    lastRms = 0;
    Serial.println("manual test: pump ON for 5 sec");
    startPumping(now);
  } else if (line == "v" || line == "valve" || line == "solenoid") {
    lastValveSeconds = 5;
    Serial.println("manual test: solenoid OPEN for 5 sec");
    startValve(now);
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
  lastSeconds = clampPumpSeconds(msg.pumpSeconds == 0 ? PUMP_SEC_DEFAULT : msg.pumpSeconds);
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
    gotValve = false;
    forceStopAll("app / mic manual stop");
  }

  if (gotValve) {
    gotValve = false;
    startValve(now);
  }

  if (gotTrigger) {
    gotTrigger = false;
    if (pumping) {
      Serial.println("pump busy - extra ESP-NOW packet ignored");
    } else {
      startPumping(now);
    }
  }

  if (valveOpen) {
    if ((long)(now - valveUntilMs) >= 0) {
      stopValve();
    }
  }

  if (pumping) {
    if ((long)(now - pumpUntilMs) >= 0) {
      stopPumping();
    } else if (now - lastPumpPrintMs >= 10000) {
      lastPumpPrintMs = now;
      unsigned long leftSec = (pumpUntilMs - now) / 1000UL;
      Serial.print("air pumping... ");
      Serial.print(leftSec);
      Serial.println("s left");
    }
  } else if (!valveOpen && now - lastWaitPrintMs >= 3000) {
    lastWaitPrintMs = now;
    if (micHeard) {
      Serial.println("connected to espmic");
    } else {
      Serial.println("waiting for mic...");
    }
  }

  delay(20);
}

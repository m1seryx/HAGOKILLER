/*
 * HAGOKILLER - ESP32-S3 air pump receiver
 * Board: ESP32S3 Dev Module
 * Serial: 115200
 *
 * Your board has R_EN, L_EN, RPWM, LPWM, R_IS, L_IS — that is a
 * BTS7960 motor driver (NOT a simple HW-039 relay).
 *
 * ========== BTS7960 → ESP32-S3 (right channel for air pump) ==========
 *   VCC   -> 3.3V
 *   GND   -> GND
 *   R_EN  -> 3.3V        (always enable right channel)
 *   RPWM  -> GPIO 18     (HIGH = pump on, LOW = pump off)
 *   LPWM  -> GND
 *   L_EN  -> GND         (disable left channel)
 *   R_IS  -> (not connected)
 *   L_IS  -> (not connected)
 *
 *   Pump motor wires -> M+ and M-  (or B+/B- / R+/R- on your board)
 *   VM / motor V+    -> battery+  (pump voltage, e.g. 5–12V)
 *   motor GND        -> battery- and ESP32 GND (common ground)
 *
 * Mic sends ESP-NOW heartbeat every ~3s while the app is connected.
 * Serial prints "connected to espmic" when heartbeats arrive.
 */

#include <WiFi.h>
#include <esp_wifi.h>
#include <esp_now.h>
#include <string.h>
#include "esp32-hal-rgb-led.h"
#include "driver/gpio.h"

#define PUMP_DRIVER_BTS7960    1
#define PUMP_DRIVER_HW039_RELAY 2
#define PUMP_DRIVER            PUMP_DRIVER_BTS7960

#define PUMP_PWM_PIN  18
#define ESPNOW_CHANNEL 1
#define MIC_TIMEOUT_MS 8000

#if PUMP_DRIVER == PUMP_DRIVER_HW039_RELAY
  #define HW039_ACTIVE_LOW true
  #define HW039_PUMP_ON_NO true
#endif

#define DRIVER_SELF_TEST false

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
static const uint8_t FLAG_INTERVENTION = 0x01;

volatile bool gotTrigger = false;
volatile bool micHeard = false;
volatile uint8_t lastLevel = 0;
volatile uint16_t lastRms = 0;
#define PUMP_SEC_MIN 5
#define PUMP_SEC_MAX 120
#define PUMP_SEC_DEFAULT 12

volatile uint8_t lastSeconds = PUMP_SEC_DEFAULT;
volatile uint8_t lastStreak = 0;
unsigned long lastWaitPrintMs = 0;
unsigned long lastPumpPrintMs = 0;
unsigned long lastMicHeardMs = 0;
unsigned long pumpUntilMs = 0;
bool pumping = false;
bool printedConnected = false;

void setRgb(uint8_t r, uint8_t g, uint8_t b) {
  neopixelWrite(RGB_LED_PIN, r, g, b);
}

void writePumpPin(int level) {
  pinMode(PUMP_PWM_PIN, OUTPUT);
  digitalWrite(PUMP_PWM_PIN, level);
}

void pumpOn() {
#if PUMP_DRIVER == PUMP_DRIVER_BTS7960
  writePumpPin(HIGH);
#elif PUMP_DRIVER == PUMP_DRIVER_HW039_RELAY
  int level = HW039_ACTIVE_LOW
    ? (HW039_PUMP_ON_NO ? LOW : HIGH)
    : (HW039_PUMP_ON_NO ? HIGH : LOW);
  writePumpPin(level);
#endif
}

void pumpOff() {
#if PUMP_DRIVER == PUMP_DRIVER_BTS7960
  writePumpPin(LOW);
#elif PUMP_DRIVER == PUMP_DRIVER_HW039_RELAY
  int level = HW039_ACTIVE_LOW
    ? (HW039_PUMP_ON_NO ? HIGH : LOW)
    : (HW039_PUMP_ON_NO ? LOW : HIGH);
  writePumpPin(level);
#endif
}

void initPumpDriverSafe() {
  pumpOff();
}

__attribute__((constructor)) void bootPumpOffEarly() {
  initPumpDriverSafe();
}

uint8_t clampSeconds(uint8_t seconds) {
  if (seconds < PUMP_SEC_MIN) return PUMP_SEC_DEFAULT;
  if (seconds > PUMP_SEC_MAX) return PUMP_SEC_MAX;
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
#if PUMP_DRIVER == PUMP_DRIVER_BTS7960
  Serial.println("Driver: BTS7960 motor driver (R channel)");
  Serial.println("  VCC  -> 3.3V");
  Serial.println("  GND  -> GND");
  Serial.println("  R_EN -> 3.3V  (jumper wire, not GPIO)");
  Serial.print("  RPWM -> GPIO ");
  Serial.println(PUMP_PWM_PIN);
  Serial.println("  LPWM -> GND");
  Serial.println("  L_EN -> GND");
  Serial.println("  R_IS / L_IS -> not connected");
  Serial.println("  Pump -> M+ / M-   VM -> battery+");
#elif PUMP_DRIVER == PUMP_DRIVER_HW039_RELAY
  Serial.println("Driver: HW-039 relay");
  Serial.print("  IN -> GPIO ");
  Serial.println(PUMP_PWM_PIN);
  Serial.println("  VCC -> 3.3V, pump on COM+NO");
#endif
  Serial.println();
  Serial.println("Waits for mic ESP-NOW heartbeat / pump trigger.");
  Serial.println();
}

void driverSelfTest() {
  Serial.println("Pump self-test: OFF 2s -> ON 1s -> OFF");
  pumpOff();
  delay(2000);
  pumpOn();
  delay(1000);
  pumpOff();
  Serial.println();
}

void startPumping(unsigned long now) {
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

void stopPumping() {
  pumping = false;
  pumpOff();
  setRgb(0, 40, 0);
  Serial.println("pump done");
}

void printSerialHelp() {
  Serial.println();
  Serial.println("Serial test commands (type then Enter):");
  Serial.println("  t     = test pump for 5 seconds");
  Serial.println("  on    = same as t");
  Serial.println("  off   = stop pump now");
  Serial.println("  s     = stop pump now");
  Serial.println("  help  = show this list");
  Serial.println();
}

void handleSerialCommands() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();
  line.toLowerCase();
  if (line.length() == 0) return;

  unsigned long now = millis();

  if (line == "t" || line == "test" || line == "on" || line == "1") {
    lastSeconds = 5;
    lastStreak = 0;
    lastLevel = 0;
    lastRms = 0;
    if (pumping) {
      Serial.println("restarting manual test (5 sec)...");
    } else {
      Serial.println("manual test: pump ON for 5 sec");
    }
    startPumping(now);
  } else if (line == "off" || line == "0" || line == "s" || line == "stop") {
    if (pumping) {
      stopPumping();
      Serial.println("manual stop");
    } else {
      pumpOff();
      Serial.println("pump already off");
    }
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

  // Heartbeat from mic — link is alive, do not run the pump.
  if (msg.event == EVENT_HEARTBEAT) {
    markMicHeard();
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
  lastSeconds = clampSeconds(msg.pumpSeconds == 0 ? PUMP_SEC_DEFAULT : msg.pumpSeconds);
  gotTrigger = true;
}

void setup() {
  initPumpDriverSafe();

  Serial.begin(115200);
  delay(500);

  pumpOff();
  setRgb(0, 0, 40);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" HAGOKILLER AIR PUMP");
  Serial.println("======================================");
  printDriverConfig();

#if DRIVER_SELF_TEST
  driverSelfTest();
#endif

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

  if (gotTrigger) {
    gotTrigger = false;
    if (pumping) {
      Serial.println("pump busy - extra ESP-NOW packet ignored");
    } else {
      startPumping(now);
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
  } else if (now - lastWaitPrintMs >= 3000) {
    lastWaitPrintMs = now;
    if (micHeard) {
      Serial.println("connected to espmic");
    } else {
      Serial.println("waiting for mic...");
    }
  }

  delay(20);
}

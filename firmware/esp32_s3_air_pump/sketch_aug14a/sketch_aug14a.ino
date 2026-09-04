/*
 * HAGOKILLER - ESP32-S3 air pump receiver
 * Prefer opening ../esp32_s3_air_pump.ino in Arduino IDE (this folder is legacy).
 */
#include <WiFi.h>
#include <esp_now.h>
#include <string.h>
#include "esp32-hal-rgb-led.h"

#define PUMP_PIN 18
#define PUMP_ACTIVE_LOW true

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
  uint8_t  pumpMinutes;
  uint8_t  streak;
  uint8_t  flags;
  uint8_t  reserved;
} PumpMsg;

static const uint32_t MSG_MAGIC = 0x48474F4B;
static const uint8_t EVENT_SOUND = 1;
static const uint8_t FLAG_INTERVENTION = 0x01;

volatile bool gotTrigger = false;
volatile uint8_t lastLevel = 0;
volatile uint16_t lastRms = 0;
volatile uint8_t lastMinutes = 1;
volatile uint8_t lastStreak = 0;
unsigned long lastWaitPrintMs = 0;
unsigned long lastPumpPrintMs = 0;
unsigned long pumpUntilMs = 0;
bool pumping = false;

void setRgb(uint8_t r, uint8_t g, uint8_t b) {
  neopixelWrite(RGB_LED_PIN, r, g, b);
}

void pumpOn() {
#if PUMP_ACTIVE_LOW
  digitalWrite(PUMP_PIN, LOW);
#else
  digitalWrite(PUMP_PIN, HIGH);
#endif
}

void pumpOff() {
#if PUMP_ACTIVE_LOW
  digitalWrite(PUMP_PIN, HIGH);
#else
  digitalWrite(PUMP_PIN, LOW);
#endif
}

void initPumpPinSafe() {
  pinMode(PUMP_PIN, OUTPUT);
  pumpOff();
}

uint8_t clampMinutes(uint8_t minutes) {
  if (minutes < 1) return 1;
  if (minutes > 10) return 10;
  return minutes;
}

void startPumping(unsigned long now) {
  unsigned long durationMs = (unsigned long)lastMinutes * 60UL * 1000UL;
  pumpUntilMs = now + durationMs;
  pumping = true;
  lastPumpPrintMs = now;
  pumpOn();
  setRgb(0, 180, 255);
  Serial.print("air pumping...  ");
  Serial.print(lastMinutes);
  Serial.print(" min  streak=");
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

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
#else
void onDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
#endif
  if (len < 8) return;

  PumpMsg msg;
  memset(&msg, 0, sizeof(msg));
  memcpy(&msg, data, len < (int)sizeof(msg) ? len : sizeof(msg));

  if (msg.magic != MSG_MAGIC || msg.event != EVENT_SOUND) return;

  if ((msg.flags & FLAG_INTERVENTION) == 0) {
    Serial.println("ESP-NOW ignored (not an intervention packet)");
    return;
  }

  lastLevel = msg.level;
  lastRms = msg.rms;
  lastStreak = msg.streak;
  lastMinutes = clampMinutes(msg.pumpMinutes == 0 ? 1 : msg.pumpMinutes);
  gotTrigger = true;
}

void setup() {
  initPumpPinSafe();

  Serial.begin(115200);
  delay(1500);

  pumpOff();
  setRgb(0, 0, 40);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" HAGOKILLER AIR PUMP");
  Serial.println("======================================");

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

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
}

void loop() {
  unsigned long now = millis();

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
    Serial.println("waiting for mic...");
  }

  delay(20);
}

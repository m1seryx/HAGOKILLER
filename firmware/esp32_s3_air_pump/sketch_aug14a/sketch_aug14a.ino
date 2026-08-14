/*
 * ESP32-S3 air pump - ESP-NOW receiver (no pump hardware)
 * Board: ESP32S3 Dev Module
 * Serial: 115200
 *
 * When mic detects sound -> prints: air pumping...
 */

#include <WiFi.h>
#include <esp_now.h>
#include "esp32-hal-rgb-led.h"

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
} PumpMsg;

static const uint32_t MSG_MAGIC = 0x48474F4B;
static const uint8_t EVENT_SOUND = 1;

volatile bool gotTrigger = false;
volatile uint8_t lastLevel = 0;
volatile uint16_t lastRms = 0;
unsigned long lastWaitPrintMs = 0;

void setRgb(uint8_t r, uint8_t g, uint8_t b) {
  neopixelWrite(RGB_LED_PIN, r, g, b);
}

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
#else
void onDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
#endif
  if (len < (int)sizeof(PumpMsg)) return;
  PumpMsg msg;
  memcpy(&msg, data, sizeof(msg));
  if (msg.magic != MSG_MAGIC || msg.event != EVENT_SOUND) return;
  lastLevel = msg.level;
  lastRms = msg.rms;
  gotTrigger = true;
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  setRgb(0, 0, 40);

  Serial.println();
  Serial.println("Pump ESP-NOW TEST");
  Serial.println("waiting for mic...");

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  Serial.print("Pump MAC: ");
  Serial.println(WiFi.macAddress());

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
}

void loop() {
  if (!gotTrigger) {
    unsigned long now = millis();
    if (now - lastWaitPrintMs >= 3000) {
      lastWaitPrintMs = now;
      Serial.println("waiting for mic...");
    }
  }

  if (gotTrigger) {
    gotTrigger = false;
    Serial.print("air pumping...  VOL=");
    Serial.print(lastLevel);
    Serial.print("/10  RMS=");
    Serial.println(lastRms);
    setRgb(0, 180, 255);
    delay(700);
    setRgb(0, 40, 0);
  }
  delay(20);
}
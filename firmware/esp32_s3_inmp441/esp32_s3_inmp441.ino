/*
 * ESP32-S3 + INMP441
 * - BLE server for phone app (name: HAGOKILLER Pillow)
 * - ESP-NOW sender to air-pump ESP32
 *
 * Wiring:
 *   VDD -> 3.3V | GND -> GND
 *   SD -> GPIO6 | SCK -> GPIO5 | WS -> GPIO4 | L/R -> GND
 *
 * Phone pair PIN (demo): 1234567
 * Upload pump (ESP-NOW) first, then this mic board.
 * Serial: 115200
 */

#include <driver/i2s.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <WiFi.h>
#include <esp_now.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "esp32-hal-rgb-led.h"

#define I2S_WS   4
#define I2S_SCK  5
#define I2S_SD   6
#define I2S_PORT I2S_NUM_0

#if defined(RGB_BUILTIN)
  #define RGB_LED_PIN RGB_BUILTIN
#else
  #define RGB_LED_PIN 48
#endif

#define SAMPLE_RATE      16000
#define READ_SAMPLES     512
#define CALIBRATE_N      30
#define LOUD_STREAK_NEED 2
#define DIGITAL_GAIN     7
#define RMS_MARGIN       40
#define RMS_RATIO        1.12f
#define PEAK_MARGIN      100
#define PEAK_RATIO       1.25f
#define SEND_COOLDOWN_MS 2000

#define DEVICE_NAME "HAGOKILLER Pillow"
#define PAIR_PIN    "1234567"

#define PHONE_SERVICE_UUID "6ba1d001-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define PIN_CHAR_UUID      "6ba1d002-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define AUTH_CHAR_UUID     "6ba1d003-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define EVENT_CHAR_UUID    "6ba1d004-8e2a-4b7c-9f10-22c0a1b2c3d4"

int32_t i2sBuffer[READ_SAMPLES];
unsigned long loopCount = 0;
bool i2sReady = false;
float noiseRms = 0.0f;
int32_t noisePeak = 0;
int loudStreak = 0;
unsigned long lastSendMs = 0;

bool phoneConnected = false;
bool phoneAuthenticated = false;
unsigned long lastBleStatusMs = 0;

BLECharacteristic *authChar = nullptr;
BLECharacteristic *eventChar = nullptr;

typedef struct __attribute__((packed)) {
  uint32_t magic;
  uint8_t  event;
  uint8_t  level;
  uint16_t rms;
} PumpMsg;

static const uint32_t MSG_MAGIC = 0x48474F4B;
static const uint8_t EVENT_SOUND = 1;
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void setRgb(uint8_t r, uint8_t g, uint8_t b) {
  neopixelWrite(RGB_LED_PIN, r, g, b);
}

void setAuth(bool ok) {
  phoneAuthenticated = ok;
  if (authChar) {
    uint8_t v = ok ? 1 : 0;
    authChar->setValue(&v, 1);
    authChar->notify();
  }
  if (ok) {
    Serial.println("BLE: PIN ok - app paired with ESP32");
  } else {
    Serial.println("BLE: PIN cleared");
  }
  Serial.flush();
}

class PhoneServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override {
    phoneConnected = true;
    Serial.println("BLE: app connected to ESP32");
    Serial.println("BLE: waiting for 7-digit PIN...");
    Serial.flush();
    setRgb(0, 40, 80);
  }

  void onDisconnect(BLEServer *pServer) override {
    phoneConnected = false;
    setAuth(false);
    Serial.println("BLE: app disconnected");
    pServer->startAdvertising();
    Serial.println("BLE: waiting for app...");
    Serial.flush();
    setRgb(0, 0, 40);
  }
};

class PinCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    String pin = pCharacteristic->getValue();
    pin.trim();
    Serial.print("BLE: PIN from app: ");
    Serial.println(pin);
    Serial.flush();

    if (pin == PAIR_PIN) {
      setAuth(true);
      setRgb(0, 120, 0);
    } else {
      setAuth(false);
      Serial.println("BLE: bad PIN - not paired");
      Serial.flush();
    }
  }
};

bool setupEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(50);

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW fail");
    return false;
  }

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, broadcastAddress, 6);
  peer.channel = 0;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("ESP-NOW peer fail");
    return false;
  }

  Serial.print("ESP-NOW ready  mic MAC=");
  Serial.println(WiFi.macAddress());
  return true;
}

void setupPhoneBle() {
  BLEDevice::init(DEVICE_NAME);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new PhoneServerCallbacks());

  BLEService *service = server->createService(PHONE_SERVICE_UUID);

  BLECharacteristic *pinChar = service->createCharacteristic(
    PIN_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pinChar->setCallbacks(new PinCallbacks());

  authChar = service->createCharacteristic(
    AUTH_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  authChar->addDescriptor(new BLE2902());
  uint8_t zero = 0;
  authChar->setValue(&zero, 1);

  eventChar = service->createCharacteristic(
    EVENT_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  eventChar->addDescriptor(new BLE2902());

  service->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(PHONE_SERVICE_UUID);
  adv->setScanResponse(true);

  BLEAdvertisementData advData;
  advData.setName(DEVICE_NAME);
  advData.setCompleteServices(BLEUUID(PHONE_SERVICE_UUID));
  adv->setAdvertisementData(advData);

  BLEAdvertisementData scanData;
  scanData.setName(DEVICE_NAME);
  adv->setScanResponseData(scanData);

  adv->start();
  Serial.println("BLE: advertising as HAGOKILLER Pillow");
  Serial.println("BLE: waiting for app...");
  Serial.println("BLE: demo PIN 1234567");
  Serial.flush();
}

void notifyPhoneAndPump(uint8_t level, uint16_t rms) {
  unsigned long now = millis();
  if (now - lastSendMs < SEND_COOLDOWN_MS) return;
  lastSendMs = now;

  PumpMsg msg;
  msg.magic = MSG_MAGIC;
  msg.event = EVENT_SOUND;
  msg.level = level;
  msg.rms = rms;

  esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));
  Serial.println("ESP-NOW -> pump");

  if (phoneAuthenticated && eventChar != nullptr) {
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
    Serial.println("BLE notify -> phone");
  }
}

bool setupI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 256,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };

  if (i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL) != ESP_OK) return false;
  if (i2s_set_pin(I2S_PORT, &pin_config) != ESP_OK) return false;
  i2s_zero_dma_buffer(I2S_PORT);
  Serial.println("I2S ready");
  return true;
}

bool readMic(float *rmsOut, int32_t *peakOut) {
  size_t bytesRead = 0;
  esp_err_t result = i2s_read(I2S_PORT, (void *)i2sBuffer, sizeof(i2sBuffer), &bytesRead, pdMS_TO_TICKS(300));
  if (result != ESP_OK || bytesRead < sizeof(int32_t)) {
    *rmsOut = 0;
    *peakOut = 0;
    return false;
  }

  int samples = (int)(bytesRead / sizeof(int32_t));
  double sum = 0.0;
  for (int i = 0; i < samples; i++) sum += (double)(i2sBuffer[i] >> 11);
  float mean = (float)(sum / (double)samples);

  double sumSq = 0.0;
  int32_t peak = 0;
  int used = 0;
  for (int i = 0; i < samples; i++) {
    float s = ((float)(i2sBuffer[i] >> 11) - mean) * (float)DIGITAL_GAIN;
    int32_t a = (int32_t)fabsf(s);
    if (a > 400000) continue;
    if (a > peak) peak = a;
    sumSq += (double)s * (double)s;
    used++;
  }
  if (used < 8) {
    *rmsOut = 0;
    *peakOut = 0;
    return true;
  }
  *rmsOut = (float)sqrt(sumSq / (double)used);
  *peakOut = peak;
  return true;
}

static int cmpFloat(const void *a, const void *b) {
  float fa = *(const float *)a;
  float fb = *(const float *)b;
  return (fa > fb) - (fa < fb);
}

void calibrateNoiseFloor() {
  Serial.println("Calibrating...");
  setRgb(0, 0, 60);
  float rmsList[CALIBRATE_N];
  int32_t peakList[CALIBRATE_N];
  int okCount = 0;
  for (int i = 0; i < CALIBRATE_N; i++) {
    float rms = 0;
    int32_t peak = 0;
    if (readMic(&rms, &peak)) {
      rmsList[okCount] = rms;
      peakList[okCount] = peak;
      okCount++;
    }
    delay(50);
  }
  if (okCount < 5) {
    noiseRms = 120;
    noisePeak = 300;
  } else {
    qsort(rmsList, okCount, sizeof(float), cmpFloat);
    noiseRms = rmsList[okCount / 2];
    for (int i = 0; i < okCount; i++) {
      for (int j = i + 1; j < okCount; j++) {
        if (peakList[j] < peakList[i]) {
          int32_t t = peakList[i];
          peakList[i] = peakList[j];
          peakList[j] = t;
        }
      }
    }
    noisePeak = peakList[okCount / 2];
  }
  if (noiseRms < 30.0f) noiseRms = 30.0f;
  if (noisePeak < 80) noisePeak = 80;
  Serial.println("Mic ready");
}

bool isHearingSound(float rms, int32_t peak) {
  float rmsThresh = noiseRms * RMS_RATIO + RMS_MARGIN;
  int32_t peakThresh = (int32_t)(noisePeak * PEAK_RATIO) + PEAK_MARGIN;
  return (rms > rmsThresh) || (peak > peakThresh);
}

int volumeLevel0to10(float rms) {
  if (rms <= noiseRms) return 0;
  float ratio = rms / noiseRms;
  if (ratio < 1.08f) return 1;
  if (ratio < 1.2f) return 2;
  if (ratio < 1.4f) return 3;
  if (ratio < 1.7f) return 4;
  if (ratio < 2.2f) return 5;
  if (ratio < 3.0f) return 6;
  if (ratio < 4.5f) return 7;
  if (ratio < 7.0f) return 8;
  if (ratio < 11.0f) return 9;
  return 10;
}

void updateLed(bool micOk, bool hearing, int level) {
  unsigned long now = millis();
  if (!micOk) {
    if ((now / 250) % 2 == 0) setRgb(120, 0, 180);
    else setRgb(0, 0, 0);
    return;
  }
  if (phoneAuthenticated) {
    if (hearing || level >= 2) setRgb(0, 180, 255);
    else setRgb(0, 80, 0);
    return;
  }
  if (hearing || level >= 2) {
    uint8_t v = (uint8_t)constrain(60 + level * 18, 60, 255);
    setRgb(0, v, v);
    return;
  }
  uint8_t pulse = (uint8_t)(20 + (sin(now / 250.0) * 0.5 + 0.5) * 50);
  setRgb(0, pulse, 0);
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  setRgb(0, 0, 40);
  Serial.println();
  Serial.println("Mic = phone BLE + pump ESP-NOW");

  setupEspNow();
  setupPhoneBle();

  i2sReady = setupI2S();
  if (!i2sReady) {
    Serial.println("I2S fail");
    return;
  }
  calibrateNoiseFloor();
  Serial.println("BLE: waiting for app...");
  Serial.flush();
}

void printBleStatus() {
  unsigned long now = millis();
  if (now - lastBleStatusMs < 2000) return;
  lastBleStatusMs = now;

  if (!phoneConnected) {
    Serial.println("BLE: waiting for app...");
  } else if (!phoneAuthenticated) {
    Serial.println("BLE: app connected - enter PIN in app");
  } else {
    Serial.println("BLE: app paired");
  }
  Serial.flush();
}

void loop() {
  if (!i2sReady) {
    setRgb(255, 0, 0);
    delay(300);
    setRgb(0, 0, 0);
    delay(300);
    return;
  }

  printBleStatus();

  float bestRms = 0;
  int32_t bestPeak = 0;
  bool ok = false;
  int loudHits = 0;

  for (int n = 0; n < 5; n++) {
    float rms = 0;
    int32_t peak = 0;
    if (readMic(&rms, &peak)) {
      ok = true;
      if (isHearingSound(rms, peak)) loudHits++;
      if (rms > bestRms) {
        bestRms = rms;
        bestPeak = peak;
      }
    }
  }

  bool loudNow = loudHits >= 1;
  if (loudNow) loudStreak++;
  else loudStreak = 0;

  bool hearing = loudStreak >= LOUD_STREAK_NEED;
  int level = ok ? volumeLevel0to10(bestRms) : 0;

  if (hearing || level >= 2) {
    notifyPhoneAndPump((uint8_t)level, (uint16_t)constrain((int)bestRms, 0, 65535));
  }

  loopCount++;
  updateLed(ok, hearing, level);

  Serial.print("#");
  Serial.print(loopCount);
  Serial.print(" VOL=");
  Serial.print(level);
  if (phoneAuthenticated) Serial.print(" | BLE: app paired");
  else if (phoneConnected) Serial.print(" | BLE: app connected, need PIN");
  else Serial.print(" | BLE: waiting for app");
  Serial.println(hearing || level >= 2 ? " | sound" : " | quiet");

  delay(500);
}
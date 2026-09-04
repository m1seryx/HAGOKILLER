/*
 * HAGOKILLER - ESP32-S3 + INMP441 + Edge Impulse
 * - BLE server for phone app (name: HAGOKILLER Pillow)
 * - ESP-NOW sender to air-pump ESP32
 * - LED flashes 2 times when the app connects, then IoT (mic + ML) starts
 *
 * INMP441:
 *   VDD -> 3.3V
 *   GND -> GND
 *   SD  -> GPIO 6
 *   SCK -> GPIO 5
 *   WS  -> GPIO 4
 *   L/R -> GND
 *
 * Phone pair PIN (demo): 1234567
 * Upload pump (ESP-NOW) first, then this mic board.
 * Serial: 115200
 *
 * Color coding after IoT starts:
 *   WHITE = no sound  (ML is NOT run)
 *   RED   = sound heard, not snoring
 *   BLUE  = snoring
 *
 * ML decision is 50/50: whichever class scores higher wins.
 * Phone settings (BLE): consecutive snores, pump seconds, mic shift.
 * Sound gate is tuned for near-pillow audio (not across the room).
 */

#include <Arduino.h>
#include <driver/i2s.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <esp_now.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <azeem01nnie-project-1_inferencing.h>
#include "esp32-hal-rgb-led.h"

#define I2S_WS     4
#define I2S_SCK    5
#define I2S_SD     6
#define I2S_PORT   I2S_NUM_0
#define SAMPLE_RATE 16000

#if defined(RGB_BUILTIN)
  #define RGB_LED_PIN RGB_BUILTIN
#else
  #define RGB_LED_PIN 48
#endif

#define MIC_SHIFT_DEFAULT 15
#define CALIBRATE_N 20
#define RMS_RATIO 1.60f
#define RMS_MARGIN 200.0f
#define PEAK_RATIO 1.70f
#define PEAK_MARGIN 500
#define LOUD_STREAK_NEED 2
#define PUMP_SEC_MIN 5
#define PUMP_SEC_MAX 120
#define PUMP_SEC_DEFAULT 12
#define SEND_COOLDOWN_MS 2000
#define ESPNOW_CHANNEL 1
#define HEARTBEAT_MS 3000
#define EI_SAMPLE_COUNT EI_CLASSIFIER_RAW_SAMPLE_COUNT

#define DEVICE_NAME "HAGOKILLER Pillow"
#define PAIR_PIN    "1234567"

#define PHONE_SERVICE_UUID "6ba1d001-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define PIN_CHAR_UUID      "6ba1d002-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define AUTH_CHAR_UUID     "6ba1d003-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define EVENT_CHAR_UUID    "6ba1d004-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define SETTINGS_CHAR_UUID "6ba1d005-8e2a-4b7c-9f10-22c0a1b2c3d4"

static int16_t audio_buffer[EI_SAMPLE_COUNT];
bool i2sReady = false;
bool iotStarted = false;
volatile bool phoneConnected = false;
volatile bool pendingConnectFlash = false;
bool phoneAuthenticated = false;
unsigned long lastSendMs = 0;
unsigned long lastBleStatusMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long pumpLockUntilMs = 0;
float noiseRms = 120.0f;
int noisePeak = 300;
uint8_t micShift = MIC_SHIFT_DEFAULT;
uint8_t snoreThreshold = 3;
uint8_t pumpSeconds = PUMP_SEC_DEFAULT;
uint8_t snoreStreak = 0;
uint8_t loudStreak = 0;
bool pendingRecalibrate = false;

BLECharacteristic *authChar = nullptr;
BLECharacteristic *eventChar = nullptr;
BLEServer *bleServer = nullptr;

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

typedef struct __attribute__((packed)) {
  uint32_t magic;
  uint8_t  snoreThreshold;
  uint8_t  pumpSeconds;
  uint8_t  micShift;
  uint8_t  reserved;
} SettingsMsg;

static const uint32_t MSG_MAGIC = 0x48474F4B;
static const uint32_t SETTINGS_MAGIC = 0x48475354;
static const uint8_t EVENT_SOUND = 1;
static const uint8_t EVENT_HEARTBEAT = 2;
static const uint8_t FLAG_INTERVENTION = 0x01;
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void setRgb(uint8_t r, uint8_t g, uint8_t b)
{
    neopixelWrite(RGB_LED_PIN, r, g, b);
}

void ledWhiteNoSound() { setRgb(255, 255, 255); }
void ledRedNonSnoring() { setRgb(255, 0, 0); }
void ledBlueSnoring() { setRgb(0, 0, 255); }

void flashBluetoothConnected()
{
    for (int i = 0; i < 2; i++) {
        setRgb(0, 180, 255);
        delay(180);
        setRgb(0, 0, 0);
        delay(180);
    }
}

void setAuth(bool ok)
{
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
        pendingConnectFlash = true;
        Serial.println("BLE: app connected to ESP32");
        Serial.println("BLE: waiting for 7-digit PIN...");
        Serial.flush();
    }

    void onDisconnect(BLEServer *pServer) override {
        phoneConnected = false;
        iotStarted = false;
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
        } else {
            setAuth(false);
            Serial.println("BLE: bad PIN - not paired");
            Serial.flush();
        }
    }
};

uint8_t clampU8(uint8_t v, uint8_t lo, uint8_t hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

void printDeviceSettings()
{
    Serial.print("Settings: snores=");
    Serial.print(snoreThreshold);
    Serial.print("  pump=");
    Serial.print(pumpSeconds);
    Serial.print(" sec  micShift=");
    Serial.println(micShift);
    Serial.flush();
}

void applySettingsPacket(const uint8_t *data, size_t len)
{
    if (len < sizeof(SettingsMsg)) {
        Serial.println("BLE: settings packet too short");
        return;
    }

    SettingsMsg msg;
    memcpy(&msg, data, sizeof(msg));
    if (msg.magic != SETTINGS_MAGIC) {
        Serial.println("BLE: bad settings magic");
        return;
    }

    uint8_t nextShift = clampU8(msg.micShift, 12, 16);
    bool shiftChanged = nextShift != micShift;
    snoreThreshold = clampU8(msg.snoreThreshold, 1, 10);
    pumpSeconds = clampU8(msg.pumpSeconds, PUMP_SEC_MIN, PUMP_SEC_MAX);
    micShift = nextShift;
    snoreStreak = 0;
    pumpLockUntilMs = 0;
    if (shiftChanged && iotStarted && i2sReady) pendingRecalibrate = true;

    Serial.println("BLE: settings applied from app");
    printDeviceSettings();
}

class SettingsCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
        String raw = pCharacteristic->getValue();
        applySettingsPacket((const uint8_t *)raw.c_str(), raw.length());
    }
};

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void onEspNowSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
#else
void onEspNowSent(const uint8_t *mac, esp_now_send_status_t status) {
#endif
    if (status != ESP_NOW_SEND_SUCCESS) {
        Serial.println("ESP-NOW send FAIL");
    }
}

bool setupEspNow()
{
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(50);
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);

    if (esp_now_init() != ESP_OK) {
        Serial.println("ESP-NOW fail");
        return false;
    }

    esp_now_register_send_cb(onEspNowSent);

    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, broadcastAddress, 6);
    peer.channel = ESPNOW_CHANNEL;
    peer.encrypt = false;
    if (esp_now_is_peer_exist(broadcastAddress)) {
        esp_now_del_peer(broadcastAddress);
    }
    if (esp_now_add_peer(&peer) != ESP_OK) {
        Serial.println("ESP-NOW peer fail");
        return false;
    }

    Serial.print("ESP-NOW ready  ch=");
    Serial.print(ESPNOW_CHANNEL);
    Serial.print("  mic MAC=");
    Serial.println(WiFi.macAddress());
    return true;
}

void setupPhoneBle()
{
    BLEDevice::init(DEVICE_NAME);
    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new PhoneServerCallbacks());

    BLEService *service = bleServer->createService(PHONE_SERVICE_UUID);

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

    BLECharacteristic *settingsChar = service->createCharacteristic(
        SETTINGS_CHAR_UUID,
        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
    );
    settingsChar->setCallbacks(new SettingsCallbacks());

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

void fillPumpMsg(PumpMsg &msg, uint8_t level, uint16_t rms, uint8_t streak, bool intervene)
{
    msg.magic = MSG_MAGIC;
    msg.event = EVENT_SOUND;
    msg.level = level;
    msg.rms = rms;
    msg.pumpSeconds = pumpSeconds;
    msg.streak = streak;
    msg.flags = intervene ? FLAG_INTERVENTION : 0;
    msg.reserved = 0;
}

void notifyPhone(uint8_t level, uint16_t rms, uint8_t streak, bool intervene)
{
    if (!phoneAuthenticated || eventChar == nullptr) return;

    PumpMsg msg;
    fillPumpMsg(msg, level, rms, streak, intervene);
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
    Serial.println("BLE notify -> phone");
}

bool pumpIsLocked(unsigned long now)
{
    return (long)(now - pumpLockUntilMs) < 0;
}

void notifyPump(uint8_t level, uint16_t rms, uint8_t streak)
{
    unsigned long now = millis();
    if (pumpIsLocked(now)) {
        Serial.println("ESP-NOW -> pump skipped (still in pump window)");
        return;
    }
    if (now - lastSendMs < SEND_COOLDOWN_MS) return;
    lastSendMs = now;

    PumpMsg msg;
    fillPumpMsg(msg, level, rms, streak, true);
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));
    pumpLockUntilMs = now + (unsigned long)pumpSeconds * 1000UL;
    Serial.print("ESP-NOW -> pump  ");
    Serial.print(pumpSeconds);
    Serial.println(" sec");
}

void sendMicHeartbeat()
{
    unsigned long now = millis();
    if (now - lastHeartbeatMs < HEARTBEAT_MS) return;
    lastHeartbeatMs = now;

    PumpMsg msg;
    memset(&msg, 0, sizeof(msg));
    msg.magic = MSG_MAGIC;
    msg.event = EVENT_HEARTBEAT;
    msg.pumpSeconds = pumpSeconds;
    msg.streak = snoreStreak;
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));
}

float computeRms(const int16_t *buffer, int count)
{
    if (count <= 0) return 0.0f;
    double sumSq = 0.0;
    for (int i = 0; i < count; i++) {
        double s = (double)buffer[i];
        sumSq += s * s;
    }
    return (float)sqrt(sumSq / (double)count);
}

int computePeak(const int16_t *buffer, int count)
{
    int peak = 0;
    for (int i = 0; i < count; i++) {
        int s = buffer[i];
        if (s == -32768) s = 32767;
        else if (s < 0) s = -s;
        if (s > peak) peak = s;
    }
    return peak;
}

bool labelIsSnoring(const char *label)
{
    if (!label) return false;
    String s = String(label);
    s.toLowerCase();
    if (s.indexOf("non") >= 0) return false;
    return s.indexOf("snor") >= 0;
}

bool setupI2S()
{
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

    if (i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL) != ESP_OK) {
        Serial.println("ERROR: I2S driver install failed");
        setRgb(80, 0, 80);
        return false;
    }

    if (i2s_set_pin(I2S_PORT, &pin_config) != ESP_OK) {
        Serial.println("ERROR: I2S pin setup failed");
        setRgb(80, 0, 80);
        return false;
    }

    i2s_zero_dma_buffer(I2S_PORT);
    return true;
}

bool captureAudio()
{
    size_t bytesRead = 0;
    int32_t i2s_buffer[256];
    int samplesCollected = 0;

    while (samplesCollected < EI_SAMPLE_COUNT) {
        esp_err_t result = i2s_read(
            I2S_PORT,
            (void *)i2s_buffer,
            sizeof(i2s_buffer),
            &bytesRead,
            portMAX_DELAY
        );

        if (result != ESP_OK) {
            Serial.println("ERROR: I2S read failed");
            setRgb(80, 0, 80);
            return false;
        }

        int samplesRead = bytesRead / sizeof(int32_t);
        for (int i = 0; i < samplesRead && samplesCollected < EI_SAMPLE_COUNT; i++) {
            int32_t sample = i2s_buffer[i] >> micShift;
            if (sample > 32767) sample = 32767;
            if (sample < -32768) sample = -32768;
            audio_buffer[samplesCollected++] = (int16_t)sample;
        }
    }

    int32_t sum = 0;
    for (int i = 0; i < EI_SAMPLE_COUNT; i++) sum += audio_buffer[i];
    int16_t mean = (int16_t)(sum / EI_SAMPLE_COUNT);
    for (int i = 0; i < EI_SAMPLE_COUNT; i++) {
        int v = (int)audio_buffer[i] - (int)mean;
        if (v > 32767) v = 32767;
        if (v < -32768) v = -32768;
        audio_buffer[i] = (int16_t)v;
    }

    return true;
}

static int cmpFloat(const void *a, const void *b)
{
    float fa = *(const float *)a;
    float fb = *(const float *)b;
    return (fa > fb) - (fa < fb);
}

void calibrateNoiseFloor()
{
    Serial.println("Calibrating mic (keep the room quiet)...");
    Serial.flush();
    setRgb(0, 0, 80);

    float rmsList[CALIBRATE_N];
    int peakList[CALIBRATE_N];
    int okCount = 0;

    for (int i = 0; i < CALIBRATE_N; i++) {
        if (!captureAudio()) continue;
        rmsList[okCount] = computeRms(audio_buffer, EI_SAMPLE_COUNT);
        peakList[okCount] = computePeak(audio_buffer, EI_SAMPLE_COUNT);
        okCount++;
        delay(20);
    }

    if (okCount < 5) {
        noiseRms = 120.0f;
        noisePeak = 300;
    } else {
        qsort(rmsList, okCount, sizeof(float), cmpFloat);
        noiseRms = rmsList[okCount / 2];
        for (int i = 0; i < okCount; i++) {
            for (int j = i + 1; j < okCount; j++) {
                if (peakList[j] < peakList[i]) {
                    int t = peakList[i];
                    peakList[i] = peakList[j];
                    peakList[j] = t;
                }
            }
        }
        noisePeak = peakList[okCount / 2];
    }

    if (noiseRms < 80.0f) noiseRms = 80.0f;
    if (noisePeak < 160) noisePeak = 160;

    Serial.print("Noise floor RMS=");
    Serial.print(noiseRms, 1);
    Serial.print(" Peak=");
    Serial.println(noisePeak);
    Serial.flush();
}

bool isHearingSound(float rms, int peak)
{
    float rmsThresh = noiseRms * RMS_RATIO + RMS_MARGIN;
    int peakThresh = (int)(noisePeak * PEAK_RATIO) + PEAK_MARGIN;
    return (rms > rmsThresh) && (peak > peakThresh);
}

int get_signal_data(size_t offset, size_t length, float *out_ptr)
{
    for (size_t i = 0; i < length; i++) {
        out_ptr[i] = (float)audio_buffer[offset + i];
    }
    return 0;
}

float getSnoringScore(ei_impulse_result_t &result)
{
    float best = 0.0f;
    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        if (labelIsSnoring(ei_classifier_inferencing_categories[i])) {
            float v = result.classification[i].value;
            if (v > best) best = v;
        }
    }
    return best;
}

float getNonSnoringScore(ei_impulse_result_t &result)
{
    float best = 0.0f;
    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        if (!labelIsSnoring(ei_classifier_inferencing_categories[i])) {
            float v = result.classification[i].value;
            if (v > best) best = v;
        }
    }
    return best;
}

bool isSnoringWinner(float snoringScore, float nonSnoringScore)
{
    return snoringScore >= nonSnoringScore;
}

uint8_t snoreLevelFromScore(float snoringScore, float rms)
{
    int fromScore = (int)(snoringScore * 10.0f + 0.5f);
    int fromRms = 1;
    if (rms >= 2000) fromRms = 10;
    else if (rms >= 1500) fromRms = 8;
    else if (rms >= 1000) fromRms = 6;
    else if (rms >= 600) fromRms = 4;
    else if (rms >= 300) fromRms = 2;
    int level = fromScore > fromRms ? fromScore : fromRms;
    if (level < 1) level = 1;
    if (level > 10) level = 10;
    return (uint8_t)level;
}

void printResult(ei_impulse_result_t &result, float rms, int peak)
{
    Serial.println("========== ML RESULT ==========");
    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        Serial.print(ei_classifier_inferencing_categories[i]);
        Serial.print(": ");
        Serial.print(result.classification[i].value * 100.0f, 2);
        Serial.print("%");
        if (labelIsSnoring(ei_classifier_inferencing_categories[i])) {
            Serial.print("  <-- snoring class");
        }
        Serial.println();
    }

    float snoringScore = getSnoringScore(result);
    float nonSnoringScore = getNonSnoringScore(result);
    Serial.print("Snoring: ");
    Serial.print(snoringScore * 100.0f, 2);
    Serial.print("%   Non-snoring: ");
    Serial.print(nonSnoringScore * 100.0f, 2);
    Serial.println("%   (50/50: higher wins)");
    Serial.print("RMS: ");
    Serial.println(rms, 1);
    Serial.print("Peak: ");
    Serial.println(peak);
    Serial.println("================================");

    if (isSnoringWinner(snoringScore, nonSnoringScore)) {
        ledBlueSnoring();
        snoreStreak++;
        bool intervene = snoreStreak >= snoreThreshold;
        Serial.print(">>> SNORING DETECTED  streak=");
        Serial.print(snoreStreak);
        Serial.print("/");
        Serial.print(snoreThreshold);
        Serial.println(" <<<");
        Serial.println(">>> RGB LED = BLUE <<<");
        uint8_t level = snoreLevelFromScore(snoringScore, rms);
        uint16_t rmsU16 = (uint16_t)constrain((int)rms, 0, 65535);
        notifyPhone(level, rmsU16, snoreStreak, intervene);
        if (intervene) {
            notifyPump(level, rmsU16, snoreStreak);
            Serial.print(">>> PUMP ");
            Serial.print(pumpSeconds);
            Serial.println(" sec <<<");
            snoreStreak = 0;
        }
    } else {
        snoreStreak = 0;
        ledRedNonSnoring();
        Serial.println(">>> NON-SNORING <<<");
        Serial.println(">>> RGB LED = RED <<<");
    }
    Serial.println();
}

void printBleStatus()
{
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

bool startIot()
{
    if (i2sReady) return true;
    Serial.println("Starting IoT (mic + ML)...");
    if (!setupI2S()) {
        Serial.println("I2S initialization FAILED");
        setRgb(80, 0, 80);
        return false;
    }
    i2sReady = true;
    calibrateNoiseFloor();
    ledWhiteNoSound();
    printDeviceSettings();
    Serial.println("I2S OK. Make noise near the mic.");
    Serial.println("WHITE = no sound (ML off)");
    Serial.println("RED   = sound, not snoring");
    Serial.println("BLUE  = snoring");
    Serial.flush();
    return true;
}

void setup()
{
    Serial.begin(115200);
    delay(2000);
    setRgb(0, 0, 40);

    Serial.println();
    Serial.println("======================================");
    Serial.println(" HAGOKILLER");
    Serial.println("======================================");
    Serial.print("MIC_SHIFT: ");
    Serial.println(micShift);
    printDeviceSettings();
    Serial.println("Connect the phone app first.");
    Serial.println("LED flashes 2 times = Bluetooth connected, then IoT starts.");
    Serial.println();

    setupEspNow();
    setupPhoneBle();
}

void loop()
{
    if (pendingConnectFlash) {
        pendingConnectFlash = false;
        Serial.println("BLE connected - flashing LED 2 times");
        Serial.flush();
        flashBluetoothConnected();
        setupEspNow();
        if (startIot()) {
            iotStarted = true;
            Serial.println("IoT started");
            Serial.flush();
        }
    }

    printBleStatus();
    if (iotStarted && phoneConnected) {
        sendMicHeartbeat();
    }

    if (pendingRecalibrate && iotStarted && i2sReady) {
        pendingRecalibrate = false;
        calibrateNoiseFloor();
        ledWhiteNoSound();
    }

    if (!iotStarted || !i2sReady || !phoneConnected) {
        delay(50);
        return;
    }

    if (!captureAudio()) {
        Serial.println("Audio capture failed");
        setRgb(80, 0, 80);
        delay(1000);
        return;
    }

    float rms = computeRms(audio_buffer, EI_SAMPLE_COUNT);
    int peak = computePeak(audio_buffer, EI_SAMPLE_COUNT);
    bool soundPresent = isHearingSound(rms, peak);

    Serial.print("RMS=");
    Serial.print(rms, 1);
    Serial.print(" Peak=");
    Serial.print(peak);
    Serial.print(" -> ");
    Serial.println(soundPresent ? "SOUND (run ML)" : "NO SOUND");

    if (!soundPresent) {
        loudStreak = 0;
        snoreStreak = 0;
        ledWhiteNoSound();
        delay(50);
        return;
    }

    loudStreak++;
    if (loudStreak < LOUD_STREAK_NEED) {
        Serial.println("SOUND too brief / far - wait");
        delay(50);
        return;
    }

    signal_t signal;
    signal.total_length = EI_SAMPLE_COUNT;
    signal.get_data = &get_signal_data;

    ei_impulse_result_t result = { 0 };
    EI_IMPULSE_ERROR res = run_classifier(&signal, &result, false);

    if (res != EI_IMPULSE_OK) {
        Serial.print("ERROR: run_classifier failed: ");
        Serial.println(res);
        setRgb(80, 0, 80);
        delay(1000);
        return;
    }

    printResult(result, rms, peak);
    delay(80);
}
 
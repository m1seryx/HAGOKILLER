/*
 * HAGOKILLER - ESP32-S3 + INMP441 + light Hagokiller_inferencing
 * - BLE server for phone app (name: HAGOKILLER Pillow)
 * - ESP-NOW sender to air-pump ESP32
 * - LED flashes 2 times when the app connects, then IoT (mic + detector) starts
 *
 * INMP441 Wiring:
 *   VDD -> 3.3V
 *   GND -> GND
 *   SD  -> GPIO 6
 *   SCK -> GPIO 5
 *   WS  -> GPIO 4
 *   L/R -> 3.3V (RIGHT Channel)
 *
 * Phone pair PIN: 1234567
 */

#define EIDSP_QUANTIZE_FILTERBANK 0
#define EI_CLASSIFIER_ALLOCATION_STATIC
#define EIDSP_USE_ESP_DSP 0
#define EIDSP_INCLUDE_KISSFFT 1

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
#include <hagokillerv3_inferencing.h>
#include "esp32-hal-rgb-led.h"
#include "hagokiller_packets.h"

SET_LOOP_TASK_STACK_SIZE(24 * 1024);

#define I2S_WS     4
#define I2S_SCK    5
#define I2S_SD     6
#define I2S_PORT   I2S_NUM_0
#define SAMPLE_RATE 16000
#define EI_SLICE_COUNT EI_CLASSIFIER_SLICE_SIZE
#define RAW_MIC_ALIVE_MIN 64

#if defined(RGB_BUILTIN)
  #define RGB_LED_PIN RGB_BUILTIN
#else
  #define RGB_LED_PIN 48
#endif

// --- SENSITIVITY CONFIGURATION ---
#define MIC_SHIFT_MIN 7
#define MIC_SHIFT_MAX 16
#define MIC_SHIFT_DEFAULT 8

// Sound gate: Lowered to 85 so quiet snores pass into AI
#define SOUND_RMS_MIN 85.0f

// 51% Rule: Any score >= 51% counts as a snore
#define SNORE_MIN_SCORE 0.51f
#define NON_SNORE_MIN_SCORE 0.50f
#define SWAP_SNORE_LABELS 0

// Immediate response (1 slice = 500ms)
#define LOUD_STREAK_NEED 1

#define MIC_TEST_NOTIFY_MS 280UL
#define PUMP_SEC_MIN 5
#define PUMP_SEC_MAX 120
#define PUMP_SEC_DEFAULT 40
#define SNORE_WINDOW_DEFAULT 15
#define SNORE_WINDOW_MIN 5
#define SNORE_WINDOW_MAX 60
#define SNORE_TIMES_MAX 10
#define SNORE_MIN_GAP_MS 5000UL
#define POST_PUMP_MUTE_MS 8000UL
#define SERIAL_BAR_W 20
#define VALVE_SEC_DEFAULT 10
#define MAX_BURSTS_PER_INFLATION 1
#define HOLD_ALERT_WAIT_MS 10000UL
#define HOLD_SNORE_GAP_MS 30000UL
#define ALARM_MUTE_AUTO_STOP_MS 120000UL // 2 minutes auto-stop

#define SEND_COOLDOWN_MS 2000
#define ESPNOW_CHANNEL 1
#define HEARTBEAT_MS 3000

#define DEVICE_NAME "HAGOKILLER Pillow"
#define PAIR_PIN    "1234567"

#define PHONE_SERVICE_UUID "6ba1d001-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define PIN_CHAR_UUID      "6ba1d002-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define AUTH_CHAR_UUID     "6ba1d003-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define EVENT_CHAR_UUID    "6ba1d004-8e2a-4b7c-9f10-22c0a1b2c3d4"
#define SETTINGS_CHAR_UUID "6ba1d005-8e2a-4b7c-9f10-22c0a1b2c3d4"

// --- Forward Declarations ---
void resetContinuousClassifier();
void serialRule(char edge, char fill);
void serialBanner(const char *title);
void serialBar(float score01);
void serialPctLine(const char *label, float score01);
void serialKv(const char *key, const char *value);
void printDeviceSettings();
void printDetectorBanner();
void endPumpSession(unsigned long now, const char *reason, bool sendStop);

static int16_t audio_buffer[EI_SLICE_COUNT];
uint8_t loudStreak = 0;
static bool classifierReady = false;
static bool continuousWarm = false;
static int lastRawPeak = 0;

static i2s_channel_fmt_t i2sChannelFmt = I2S_CHANNEL_FMT_ONLY_RIGHT;

bool i2sReady = false;
bool iotStarted = false;
volatile bool phoneConnected = false;
volatile bool pendingConnectFlash = false;
volatile bool pendingStartIot = false;
volatile bool pendingAdvertise = false;
volatile bool phoneAuthenticated = false;

// Flag to reboot the mic when user unpairs / disconnects
volatile bool pendingReboot = false;

volatile bool phoneAlarmMute = false;
unsigned long phoneAlarmMuteStartMs = 0;

volatile bool snoreDetectionEnabled = false;
bool espNowReady = false;
unsigned long lastSendMs = 0;
unsigned long lastHeartbeatMs = 0;
uint8_t micShift = MIC_SHIFT_DEFAULT;
uint8_t snoreThreshold = 3;
uint8_t snoreWindowSec = SNORE_WINDOW_DEFAULT;
uint8_t pumpSeconds = PUMP_SEC_DEFAULT;
uint8_t snoreStreak = 0;
volatile bool micTestActive = false;
unsigned long lastMicTestNotifyMs = 0;
unsigned long snoreTimes[SNORE_TIMES_MAX];
uint8_t snoreTimeCount = 0;
unsigned long lastCountedSnoreMs = 0;
unsigned long listenMuteUntilMs = 0;
bool pillowElevated = false;
bool pumpSessionActive = false;
unsigned long pumpSessionStartMs = 0;
unsigned long pumpSessionMaxMs = 0;
uint8_t burstCount = 0;
unsigned long capSnoreStartMs = 0;
unsigned long capLastSnoreMs = 0;
bool maxHoldAlerted = false;

BLECharacteristic *authChar = nullptr;
BLECharacteristic *eventChar = nullptr;
BLEServer *bleServer = nullptr;

static const uint32_t MSG_MAGIC = 0x48474F4B;
static const uint32_t SETTINGS_MAGIC = 0x48475354;
static const uint32_t COMMAND_MAGIC = 0x4847434D;
static const uint8_t EVENT_SOUND = 1;
static const uint8_t EVENT_HEARTBEAT = 2;
static const uint8_t EVENT_STOP = 3;
static const uint8_t EVENT_OPEN_VALVE = 4;
static const uint8_t EVENT_TEST_PUMP = 8;
static const uint8_t EVENT_MIC_TEST = 9;
static const uint8_t FLAG_INTERVENTION = 0x01;
static const uint8_t FLAG_NEW_CYCLE = 0x02;
static const uint8_t FLAG_MAX_HOLD = 0x04;
static const uint8_t CMD_STOP = 1;
static const uint8_t CMD_OPEN_VALVE = 2;
static const uint8_t CMD_TEST_PUMP = 3;
static const uint8_t CMD_MUTE_MIC = 4;
static const uint8_t CMD_UNMUTE_MIC = 5;
static const uint8_t CMD_STOP_DETECTION = 6;
static const uint8_t CMD_START_DETECTION = 7;
static const uint8_t CMD_MIC_TEST_START = 8;
static const uint8_t CMD_MIC_TEST_STOP = 9;
static const uint8_t CMD_UNPAIR = 10; // Explicit unpair command

uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void setRgb(uint8_t r, uint8_t g, uint8_t b) { neopixelWrite(RGB_LED_PIN, r, g, b); }
void ledIdleWaiting() { setRgb(60, 28, 0); }
void ledWhiteNoSound() { setRgb(255, 255, 255); }
void ledRedNonSnoring() { setRgb(255, 0, 0); }
void ledBlueSnoring() { setRgb(0, 0, 255); }
void ledPumpMute() { setRgb(220, 0, 180); }
void ledDetectionStopped() { setRgb(0, 160, 160); }
void ledPhoneAlarmMute() { setRgb(255, 140, 0); }

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
        pendingStartIot = true;
        snoreDetectionEnabled = false;
        Serial.println("BLE: PIN ok - app paired (detection paused until Start)");
    } else {
        pendingStartIot = false;
        snoreDetectionEnabled = false;
        Serial.println("BLE: PIN cleared");
    }
    Serial.flush();
}

class PhoneServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer) override {
        phoneConnected = true;
        pendingConnectFlash = true;
        setAuth(false);
        Serial.println("BLE: app connected to ESP32");
        Serial.println("BLE: waiting for 7-digit PIN...");
        Serial.flush();
    }

    // --- REBOOT WHEN UNPAIR / DISCONNECT HAPPENS ---
    void onDisconnect(BLEServer *pServer) override {
        phoneConnected = false;
        iotStarted = false;
        phoneAlarmMute = false;
        phoneAlarmMuteStartMs = 0;
        micTestActive = false;
        setAuth(false);
        Serial.println("BLE: Unpaired / App disconnected -> Rebooting mic...");
        Serial.flush();
        pendingReboot = true; // Triggers clean CPU reboot in loop()
    }
};

class PinCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
        String pin = pCharacteristic->getValue();
        pin.trim();
        String digits = "";
        for (unsigned i = 0; i < pin.length(); i++) {
            char c = pin.charAt(i);
            if (c >= '0' && c <= '9') digits += c;
        }
        Serial.print("BLE: PIN from app: ");
        Serial.println(digits);
        Serial.flush();

        if (digits == PAIR_PIN) {
            setAuth(true);
        } else {
            setAuth(false);
            Serial.println("BLE: bad PIN - not paired");
            Serial.flush();
            if (bleServer) {
                bleServer->disconnect(bleServer->getConnId());
            }
        }
    }
};

uint8_t clampU8(uint8_t v, uint8_t lo, uint8_t hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

void clearSnoreWindow()
{
    snoreTimeCount = 0;
    snoreStreak = 0;
}

void markPillowFlat()
{
    pillowElevated = false;
    burstCount = 0;
    capSnoreStartMs = 0;
    maxHoldAlerted = false;
}

void clearActuatorMute()
{
    listenMuteUntilMs = 0;
}

void armActuatorMute(unsigned long now, unsigned long actuatorMs)
{
    unsigned long span = actuatorMs + POST_PUMP_MUTE_MS;
    if (span > 180000UL) span = 180000UL;
    unsigned long until = now + span;
    if (listenMuteUntilMs == 0 || (long)(until - listenMuteUntilMs) > 0) {
        listenMuteUntilMs = until;
    }
    clearSnoreWindow();
}

bool snoreListenMuted(unsigned long now)
{
    if (phoneAlarmMute) return true;
    if (listenMuteUntilMs == 0) return false;
    return (long)(now - listenMuteUntilMs) < 0;
}

uint8_t refreshSnoreWindow(unsigned long now)
{
    unsigned long windowMs = (unsigned long)snoreWindowSec * 1000UL;
    uint8_t kept = 0;
    for (uint8_t i = 0; i < snoreTimeCount; i++) {
        if ((long)(now - snoreTimes[i]) <= (long)windowMs) {
            snoreTimes[kept++] = snoreTimes[i];
        }
    }
    snoreTimeCount = kept;
    snoreStreak = snoreTimeCount;
    return snoreStreak;
}

uint8_t noteSnoreEvent(unsigned long now)
{
    if (snoreListenMuted(now)) return 0xFF;
    if (lastCountedSnoreMs != 0 && (now - lastCountedSnoreMs) < SNORE_MIN_GAP_MS) return 0xFE;

    refreshSnoreWindow(now);
    if (snoreTimeCount < SNORE_TIMES_MAX) {
        snoreTimes[snoreTimeCount++] = now;
    } else {
        for (uint8_t i = 1; i < SNORE_TIMES_MAX; i++) snoreTimes[i - 1] = snoreTimes[i];
        snoreTimes[SNORE_TIMES_MAX - 1] = now;
    }
    lastCountedSnoreMs = now;
    snoreStreak = snoreTimeCount;
    return snoreStreak;
}

void printDeviceSettings()
{
    Serial.print("Settings: snores=");
    Serial.print(snoreThreshold);
    Serial.print(" in ");
    Serial.print(snoreWindowSec);
    Serial.print("s  pump=");
    Serial.print(pumpSeconds);
    Serial.print(" sec  micShift=");
    Serial.println(micShift);
    Serial.flush();
}

void sendPumpControlEvent(uint8_t eventCode, uint8_t seconds)
{
    PumpMsg msg;
    memset(&msg, 0, sizeof(msg));
    msg.magic = MSG_MAGIC;
    msg.event = eventCode;
    msg.pumpSeconds = seconds;
    msg.streak = snoreStreak;
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));
}

void applyCommandPacket(const uint8_t *data, size_t len)
{
    if (len < sizeof(CommandMsg)) return;

    CommandMsg msg;
    memcpy(&msg, data, sizeof(msg));
    if (msg.magic != COMMAND_MAGIC) return;

    if (msg.opcode == CMD_STOP) {
        if (pumpSessionActive) endPumpSession(millis(), "manual stop", false);
        clearSnoreWindow();
        sendPumpControlEvent(EVENT_STOP, 0);
        Serial.println("BLE: manual STOP -> pump ESP");
        return;
    }

    if (msg.opcode == CMD_OPEN_VALVE) {
        uint8_t secs = msg.argSeconds == 0 ? VALVE_SEC_DEFAULT : clampU8(msg.argSeconds, 1, 30);
        if (pumpSessionActive) endPumpSession(millis(), "valve opened", false);
        sendPumpControlEvent(EVENT_STOP, 0);
        delay(30);
        sendPumpControlEvent(EVENT_OPEN_VALVE, secs);
        markPillowFlat();
        armActuatorMute(millis(), (unsigned long)secs * 1000UL);
        Serial.print("BLE: OPEN VALVE -> pump ESP  ");
        Serial.print(secs);
        Serial.println(" sec");
        return;
    }

    if (msg.opcode == CMD_TEST_PUMP) {
        if (pumpSessionActive) return;
        uint8_t secs = msg.argSeconds == 0 ? 5 : clampU8(msg.argSeconds, 1, 10);
        sendPumpControlEvent(EVENT_TEST_PUMP, secs);
        armActuatorMute(millis(), (unsigned long)secs * 1000UL);
        Serial.print("BLE: TEST PUMP -> pump ESP  ");
        Serial.print(secs);
        Serial.println(" sec");
        return;
    }

    if (msg.opcode == CMD_MUTE_MIC) {
        phoneAlarmMute = true;
        phoneAlarmMuteStartMs = millis();
        clearSnoreWindow();
        resetContinuousClassifier();
        Serial.println("BLE: MUTE MIC (phone alarm) — 2-minute auto-stop timer active");
        return;
    }

    if (msg.opcode == CMD_UNMUTE_MIC) {
        phoneAlarmMute = false;
        phoneAlarmMuteStartMs = 0;
        resetContinuousClassifier();
        Serial.println("BLE: UNMUTE MIC — snore listening on");
        return;
    }

    if (msg.opcode == CMD_STOP_DETECTION) {
        snoreDetectionEnabled = false;
        clearSnoreWindow();
        resetContinuousClassifier();
        Serial.println("BLE: STOP DETECTION");
        return;
    }

    if (msg.opcode == CMD_START_DETECTION) {
        micTestActive = false;
        snoreDetectionEnabled = true;
        clearSnoreWindow();
        clearActuatorMute();
        resetContinuousClassifier();
        Serial.println("BLE: START DETECTION");
        return;
    }

    if (msg.opcode == CMD_MIC_TEST_START) {
        if (snoreDetectionEnabled || !iotStarted || !i2sReady) return;
        micTestActive = true;
        lastMicTestNotifyMs = 0;
        clearActuatorMute();
        resetContinuousClassifier();
        Serial.println("BLE: MIC TEST start");
        return;
    }

    if (msg.opcode == CMD_MIC_TEST_STOP) {
        micTestActive = false;
        resetContinuousClassifier();
        Serial.println("BLE: MIC TEST stop");
        return;
    }

    if (msg.opcode == CMD_UNPAIR) {
        Serial.println("BLE: CMD_UNPAIR received -> Rebooting mic...");
        Serial.flush();
        pendingReboot = true;
        return;
    }
}

void applySettingsPacket(const uint8_t *data, size_t len)
{
    if (len < sizeof(SettingsMsg)) return;

    SettingsMsg msg;
    memcpy(&msg, data, sizeof(msg));
    if (msg.magic != SETTINGS_MAGIC) return;

    snoreThreshold = clampU8(msg.snoreThreshold, 1, 10);
    pumpSeconds = clampU8(msg.pumpSeconds, PUMP_SEC_MIN, PUMP_SEC_MAX);
    micShift = clampU8(msg.micShift, MIC_SHIFT_MIN, MIC_SHIFT_MAX);
    snoreWindowSec = clampU8(
        msg.snoreWindowSec == 0 ? SNORE_WINDOW_DEFAULT : msg.snoreWindowSec,
        SNORE_WINDOW_MIN,
        SNORE_WINDOW_MAX
    );
    clearSnoreWindow();
    Serial.println("BLE: settings applied");
    printDeviceSettings();
}

class SettingsCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
        if (!phoneAuthenticated) return;
        const uint8_t *bytes = pCharacteristic->getData();
        size_t len = pCharacteristic->getLength();
        if (len < 4) return;

        uint32_t magic = (uint32_t)bytes[0]
            | ((uint32_t)bytes[1] << 8)
            | ((uint32_t)bytes[2] << 16)
            | ((uint32_t)bytes[3] << 24);

        if (magic == COMMAND_MAGIC) applyCommandPacket(bytes, len);
        else if (magic == SETTINGS_MAGIC) applySettingsPacket(bytes, len);
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
    if (espNowReady) return true;

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(50);
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);

    if (esp_now_init() != ESP_OK) return false;
    esp_now_register_send_cb(onEspNowSent);

    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, broadcastAddress, 6);
    peer.channel = ESPNOW_CHANNEL;
    peer.encrypt = false;
    if (esp_now_is_peer_exist(broadcastAddress)) esp_now_del_peer(broadcastAddress);
    if (esp_now_add_peer(&peer) != ESP_OK) return false;

    espNowReady = true;
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
    Serial.println("BLE: ready (PIN: 1234567)");
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

void fillPumpMsgSeconds(PumpMsg &msg, uint8_t level, uint16_t rms, uint8_t streak, uint8_t seconds)
{
    msg.magic = MSG_MAGIC;
    msg.event = EVENT_SOUND;
    msg.level = level;
    msg.rms = rms;
    msg.pumpSeconds = seconds;
    msg.streak = streak;
    msg.flags = FLAG_INTERVENTION;
    msg.reserved = 0;
}

void notifyPhone(uint8_t level, uint16_t rms, uint8_t streak, bool intervene)
{
    if (!phoneAuthenticated || eventChar == nullptr) return;
    PumpMsg msg;
    fillPumpMsg(msg, level, rms, streak, intervene);
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
}

void notifyPhonePump(uint8_t level, uint16_t rms, uint8_t streak, uint8_t seconds)
{
    if (!phoneAuthenticated || eventChar == nullptr) return;
    PumpMsg msg;
    fillPumpMsgSeconds(msg, level, rms, streak, seconds);
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
}

void notifyPhoneMicTest(uint8_t snorePct, uint8_t nonPct, uint8_t verdict)
{
    if (!phoneAuthenticated || eventChar == nullptr) return;
    unsigned long now = millis();
    if (lastMicTestNotifyMs != 0 && (now - lastMicTestNotifyMs) < MIC_TEST_NOTIFY_MS) return;
    lastMicTestNotifyMs = now;

    PumpMsg msg;
    memset(&msg, 0, sizeof(msg));
    msg.magic = MSG_MAGIC;
    msg.event = EVENT_MIC_TEST;
    msg.level = snorePct;
    msg.rms = nonPct;
    msg.streak = verdict;
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
}

bool startPumpBurst(unsigned long now, uint8_t seconds, bool newInflation,
                    uint8_t level, uint16_t rms, uint8_t streak)
{
    if (now - lastSendMs < SEND_COOLDOWN_MS) return false;
    lastSendMs = now;

    PumpMsg msg;
    fillPumpMsgSeconds(msg, level, rms, streak, seconds);
    if (newInflation) msg.flags |= FLAG_NEW_CYCLE;
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));

    pumpSessionActive = true;
    pumpSessionStartMs = now;
    pumpSessionMaxMs = (unsigned long)seconds * 1000UL;
    armActuatorMute(now, pumpSessionMaxMs);

    // Stop I2S to prevent DMA overflow during pumping
    i2s_stop(I2S_PORT);

    return true;
}

void endPumpSession(unsigned long now, const char *reason, bool sendStop)
{
    if (!pumpSessionActive) return;

    if (sendStop) sendPumpControlEvent(EVENT_STOP, 0);
    pumpSessionActive = false;

    // Flush old samples, restart I2S, and reset continuous classifier buffer
    i2s_zero_dma_buffer(I2S_PORT);
    i2s_start(I2S_PORT);
    resetContinuousClassifier();

    listenMuteUntilMs = now + POST_PUMP_MUTE_MS;
    clearSnoreWindow();
}

void notifyPhoneMaxHold(uint8_t level, uint16_t rms, uint8_t streak)
{
    if (!phoneAuthenticated || eventChar == nullptr) return;
    PumpMsg msg;
    fillPumpMsg(msg, level, rms, streak, false);
    msg.flags |= FLAG_MAX_HOLD;
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
}

void handleSnoreAtPumpLimit(unsigned long now, uint8_t level, uint16_t rms, uint8_t streak)
{
    if (maxHoldAlerted) {
        notifyPhone(level, rms, streak, false);
        return;
    }

    if (capSnoreStartMs == 0 || now - capLastSnoreMs > HOLD_SNORE_GAP_MS) capSnoreStartMs = now;
    capLastSnoreMs = now;

    if ((now - capSnoreStartMs) < HOLD_ALERT_WAIT_MS) {
        notifyPhone(level, rms, streak, false);
        return;
    }

    notifyPhoneMaxHold(level, rms, streak);
    maxHoldAlerted = true;
}

void updatePumpSession(unsigned long now)
{
    if (!pumpSessionActive) return;
    if (now - pumpSessionStartMs >= pumpSessionMaxMs) {
        endPumpSession(now, "burst done", true);
    }
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
        int s = abs(buffer[i]);
        if (s > peak) peak = s;
    }
    return peak;
}

void printDetectorBanner()
{
    serialBanner("LIGHT EI  ·  MFCC-only v3");
    Serial.print("|  quiet RMS < ");
    Serial.print((int)SOUND_RMS_MIN);
    Serial.println("  (skip ML)                 |");
    Serial.print("|  decision  snore>=");
    Serial.print((int)(SNORE_MIN_SCORE * 100.0f));
    Serial.println("%                     |");
    serialRule('+', '-');
    Serial.println();
}

bool setupI2S(i2s_channel_fmt_t channelFmt)
{
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = channelFmt,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
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
    i2sChannelFmt = channelFmt;
    return true;
}

void teardownI2S()
{
    if (!i2sReady) return;
    i2s_driver_uninstall(I2S_PORT);
    i2sReady = false;
}

int probeRawPeak(int reads)
{
    size_t bytesRead = 0;
    int32_t i2s_buffer[256];
    int rawPeak = 0;
    for (int r = 0; r < reads; r++) {
        esp_err_t result = i2s_read(I2S_PORT, (void *)i2s_buffer, sizeof(i2s_buffer), &bytesRead, pdMS_TO_TICKS(100));
        if (result != ESP_OK || bytesRead < sizeof(int32_t)) continue;
        int n = (int)(bytesRead / sizeof(int32_t));
        for (int i = 0; i < n; i++) {
            int32_t s = abs(i2s_buffer[i]);
            if (s > rawPeak) rawPeak = s;
        }
    }
    return rawPeak;
}

bool setupI2SAutoChannel()
{
    teardownI2S();

    if (!setupI2S(I2S_CHANNEL_FMT_ONLY_RIGHT)) {
        Serial.println("ERROR: I2S RIGHT channel setup failed");
        return false;
    }
    i2sReady = true;
    delay(60);

    int peak = probeRawPeak(8);
    Serial.print("I2S: RIGHT channel (L/R->3.3V) active. Baseline peak=");
    Serial.println(peak);
    return true;
}

bool labelIsSnoring(const char *label)
{
    if (!label) return false;
    String s = String(label);
    s.toLowerCase();
    if (s.indexOf("non") >= 0) return false;
    return s.indexOf("snor") >= 0;
}

bool labelIsNonSnoring(const char *label)
{
    if (!label) return true;
    String s = String(label);
    s.toLowerCase();
    if (s.indexOf("non") >= 0) return true;
    return s.indexOf("snor") < 0;
}

void getClassScores(ei_impulse_result_t &result, float &snoringScore, float &nonSnoringScore)
{
    snoringScore = 0.0f;
    nonSnoringScore = 0.0f;
    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        const char *lab = result.classification[i].label;
        if (!lab || !lab[0]) lab = ei_classifier_inferencing_categories[i];
        float v = result.classification[i].value;
        if (labelIsSnoring(lab)) {
            if (v > snoringScore) snoringScore = v;
        } else {
            if (v > nonSnoringScore) nonSnoringScore = v;
        }
    }
}

bool isSnoringWinner(float snoringScore, float nonSnoringScore)
{
    (void)nonSnoringScore;
    return (snoringScore >= 0.51f);
}

void peakNormalizeForMl()
{
    int peak = 1;
    for (int i = 0; i < EI_SLICE_COUNT; i++) {
        int s = abs((int)audio_buffer[i]);
        if (s > peak) peak = s;
    }
    if (peak < 64) return;
    float scale = (20000.0f) / (float)peak;
    if (scale < 1.05f) return;
    
    if (scale > 12.0f) scale = 12.0f;

    for (int i = 0; i < EI_SLICE_COUNT; i++) {
        int v = (int)lroundf((float)audio_buffer[i] * scale);
        if (v > 32767) v = 32767;
        if (v < -32768) v = -32768;
        audio_buffer[i] = (int16_t)v;
    }
}

int get_signal_data(size_t offset, size_t length, float *out_ptr)
{
    for (size_t i = 0; i < length; i++) {
        out_ptr[i] = (float)audio_buffer[offset + i];
    }
    return 0;
}

bool captureSlice(float &rms, int &peak)
{
    size_t bytesRead = 0;
    int32_t i2s_buffer[256];
    int samplesCollected = 0;
    int rawPeak = 0;

    static int32_t raw32_buffer[EI_SLICE_COUNT];
    int64_t sum32 = 0;

    while (samplesCollected < EI_SLICE_COUNT) {
        esp_err_t result = i2s_read(I2S_PORT, (void *)i2s_buffer, sizeof(i2s_buffer), &bytesRead, pdMS_TO_TICKS(100));

        if (result != ESP_OK || bytesRead == 0) {
            ledRedNonSnoring();
            return false;
        }

        int samplesRead = (int)(bytesRead / sizeof(int32_t));
        for (int i = 0; i < samplesRead && samplesCollected < EI_SLICE_COUNT; i++) {
            int32_t raw = i2s_buffer[i];
            int32_t absRaw = abs(raw);
            if (absRaw > rawPeak) rawPeak = absRaw;

            raw32_buffer[samplesCollected++] = raw;
            sum32 += raw;
        }
    }

    lastRawPeak = rawPeak;

    int32_t mean32 = (int32_t)(sum32 / EI_SLICE_COUNT);

    for (int i = 0; i < EI_SLICE_COUNT; i++) {
        int32_t centered = raw32_buffer[i] - mean32;
        int32_t sample = centered >> micShift;

        if (sample > 32767) sample = 32767;
        if (sample < -32768) sample = -32768;
        audio_buffer[i] = (int16_t)sample;
    }

    rms = computeRms(audio_buffer, EI_SLICE_COUNT);
    peak = computePeak(audio_buffer, EI_SLICE_COUNT);
    return true;
}

void resetContinuousClassifier()
{
    if (!classifierReady) return;
    run_classifier_init();
    continuousWarm = false;
    loudStreak = 0;
}

uint8_t classifySlice(float &rms, int &peak, bool &snoreWin, float &snoreScore01, float &nonScore01)
{
    snoreWin = false;
    snoreScore01 = 0.0f;
    nonScore01 = 1.0f;

    if (!captureSlice(rms, peak)) return 1;

    // Too quiet! Skip AI completely
    if (rms < SOUND_RMS_MIN) {
        if (continuousWarm) resetContinuousClassifier();
        else loudStreak = 0;

        snoreScore01 = 0.0f;
        nonScore01 = 1.0f;
        return 0;
    }

    if (!classifierReady) {
        loudStreak = 0;
        return 1;
    }

    peakNormalizeForMl();

    signal_t signal;
    signal.total_length = EI_SLICE_COUNT;
    signal.get_data = &get_signal_data;
    ei_impulse_result_t result = {0};

    EI_IMPULSE_ERROR res = run_classifier_continuous(&signal, &result, false);
    if (res != EI_IMPULSE_OK) {
        resetContinuousClassifier();
        return 1;
    }

    continuousWarm = true;
    getClassScores(result, snoreScore01, nonScore01);

    if (isSnoringWinner(snoreScore01, nonScore01)) {
        if (loudStreak < 255) loudStreak++;
        if (loudStreak >= LOUD_STREAK_NEED) {
            snoreWin = true;
            return 2;
        }
        return 1;
    }

    loudStreak = 0;
    return 1;
}

void serialRule(char edge, char fill)
{
    Serial.print(edge);
    for (int i = 0; i < 42; i++) Serial.print(fill);
    Serial.println(edge);
}

void serialBanner(const char *title)
{
    Serial.println();
    serialRule('+', '-');
    Serial.print("|  ");
    Serial.print(title);
    int pad = 38 - (int)strlen(title);
    for (int i = 0; i < pad; i++) Serial.print(' ');
    Serial.println("|");
    serialRule('+', '-');
}

void serialBar(float score01)
{
    int filled = (int)(score01 * (float)SERIAL_BAR_W + 0.5f);
    if (filled < 0) filled = 0;
    if (filled > SERIAL_BAR_W) filled = SERIAL_BAR_W;
    Serial.print('[');
    for (int i = 0; i < SERIAL_BAR_W; i++) {
        Serial.print(i < filled ? '#' : '.');
    }
    Serial.print(']');
}

void serialPctLine(const char *label, float score01)
{
    Serial.print("|  ");
    Serial.print(label);
    int labelPad = 10 - (int)strlen(label);
    for (int i = 0; i < labelPad; i++) Serial.print(' ');
    Serial.print(" ");
    serialBar(score01);
    Serial.print("  ");
    Serial.print(score01 * 100.0f, 1);
    Serial.println("%  |");
}

void serialKv(const char *key, const char *value)
{
    Serial.print("|  ");
    Serial.print(key);
    Serial.print(": ");
    Serial.print(value);
    int used = 4 + (int)strlen(key) + 2 + (int)strlen(value);
    int pad = 42 - used;
    for (int i = 0; i < pad; i++) Serial.print(' ');
    Serial.println("|");
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

void handleDetectResult(bool snoreWin, float snoreScore01, float nonScore01, float rms, int peak)
{
    serialBanner("HAGOKILLER  ·  LIVE DETECT");
    serialPctLine("SNORE", snoreScore01);
    serialPctLine("NON-SNORE", nonScore01);

    if (snoreWin) {
        ledBlueSnoring();
        unsigned long now = millis();
        uint8_t streak = noteSnoreEvent(now);

        if (streak != 0xFF && streak != 0xFE) {
            uint8_t level = snoreLevelFromScore(snoreScore01, rms);
            uint16_t rmsU16 = (uint16_t)constrain((int)rms, 0, 65535);

            if (burstCount >= MAX_BURSTS_PER_INFLATION) {
                handleSnoreAtPumpLimit(now, level, rmsU16, streak);
            } else if (streak < snoreThreshold) {
                notifyPhone(level, rmsU16, streak, false);
            } else {
                bool newInflation = !pillowElevated;
                if (startPumpBurst(now, pumpSeconds, newInflation, level, rmsU16, streak)) {
                    burstCount++;
                    pillowElevated = true;
                    notifyPhonePump(level, rmsU16, streak, pumpSeconds);
                }
            }
        }
    } else {
        refreshSnoreWindow(millis());
        ledRedNonSnoring();
    }
}

void runMicTestFrame()
{
    float rms = 0.0f;
    int peak = 0;
    bool snoreWin = false;
    float snoreScore01 = 0.0f;
    float nonScore01 = 0.0f;
    uint8_t verdict = classifySlice(rms, peak, snoreWin, snoreScore01, nonScore01);

    uint8_t snorePct = (uint8_t)constrain((int)lroundf(snoreScore01 * 100.0f), 0, 100);
    uint8_t nonPct = (uint8_t)constrain((int)lroundf(nonScore01 * 100.0f), 0, 100);

    if (verdict == 0) ledWhiteNoSound();
    else if (verdict == 2) ledBlueSnoring();
    else ledRedNonSnoring();

    notifyPhoneMicTest(snorePct, nonPct, verdict);
}

bool startIot()
{
    if (!i2sReady) {
        if (!setupI2SAutoChannel()) return false;
    }
    run_classifier_init();
    classifierReady = true;
    continuousWarm = false;
    loudStreak = 0;
    clearActuatorMute();

    ledWhiteNoSound();
    printDeviceSettings();
    printDetectorBanner();
    return true;
}

void serialAliveTick()
{
    uint8_t bleState = !phoneConnected ? 0 : (!phoneAuthenticated ? 1 : 2);
    static uint8_t lastBle = 0xFF;
    static bool lastIot = false;
    static bool lastDetect = false;

    if (bleState == lastBle && iotStarted == lastIot && snoreDetectionEnabled == lastDetect) return;

    lastBle = bleState;
    lastIot = iotStarted;
    lastDetect = snoreDetectionEnabled;

    Serial.print("[status] ble=");
    if (bleState == 0) Serial.print("wait");
    else if (bleState == 1) Serial.print("need-PIN");
    else Serial.print("paired");
    Serial.print("  iot=");
    Serial.print(iotStarted ? "on" : "off");
    Serial.print("  detect=");
    Serial.println(snoreDetectionEnabled ? "on" : "paused");
}

void setup()
{
    Serial.begin(115200);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && (ARDUINO_USB_CDC_ON_BOOT == 1)
    Serial.setTxTimeoutMs(0);
#endif
    unsigned long serialWaitStart = millis();
    while (!Serial && (millis() - serialWaitStart) < 3000UL) delay(10);
    delay(200);

    ledIdleWaiting();
    setupEspNow();
    setupPhoneBle();
    Serial.println(">>> System Ready <<<");
}

void loop()
{
    // --- REBOOT WHEN UNPAIR IS CLICKED ---
    if (pendingReboot) {
        delay(300);
        ESP.restart();
    }

    serialAliveTick();

    if (pendingAdvertise) {
        pendingAdvertise = false;
        delay(200);
        if (bleServer) bleServer->startAdvertising();
        else BLEDevice::startAdvertising();
    }

    if (pendingConnectFlash) {
        pendingConnectFlash = false;
        flashBluetoothConnected();
        ledIdleWaiting();
    }

    if (pendingStartIot && phoneAuthenticated && phoneConnected) {
        pendingStartIot = false;
        maxHoldAlerted = false;
        capSnoreStartMs = 0;
        setupEspNow();
        if (startIot() && phoneConnected && phoneAuthenticated) iotStarted = true;
        else iotStarted = false;
    }

    updatePumpSession(millis());

    if (iotStarted && phoneConnected && phoneAuthenticated) sendMicHeartbeat();

    if (!iotStarted || !i2sReady || !phoneConnected || !phoneAuthenticated) {
        micTestActive = false;
        loudStreak = 0;
        delay(50);
        return;
    }

    // 2-minute alarm mute auto-stop check
    if (phoneAlarmMute) {
        if (millis() - phoneAlarmMuteStartMs >= ALARM_MUTE_AUTO_STOP_MS) {
            phoneAlarmMute = false;
            phoneAlarmMuteStartMs = 0;
            capSnoreStartMs = 0;
            maxHoldAlerted = false;
            resetContinuousClassifier();
            clearSnoreWindow();
            Serial.println(">>> 2-Minute Alarm Mute Expired: Resuming Detection <<<");
        } else {
            loudStreak = 0;
            ledPhoneAlarmMute();
            delay(50);
            return;
        }
    }

    if (!snoreDetectionEnabled) {
        if (micTestActive) {
            runMicTestFrame();
            return;
        }
        loudStreak = 0;
        ledDetectionStopped();
        delay(50);
        return;
    }

    if (pumpSessionActive) {
        loudStreak = 0;
        ledPumpMute();
        delay(50);
        return;
    }

    float rms = 0.0f;
    int peak = 0;
    bool snoreWin = false;
    float snoreScore01 = 0.0f;
    float nonScore01 = 0.0f;
    uint8_t verdict = classifySlice(rms, peak, snoreWin, snoreScore01, nonScore01);

    if (verdict == 0) {
        refreshSnoreWindow(millis());
        ledWhiteNoSound();
        return;
    }

    if (snoreWin) {
        handleDetectResult(true, snoreScore01, nonScore01, rms, peak);
        return;
    }

    handleDetectResult(false, snoreScore01, nonScore01, rms, peak);
}
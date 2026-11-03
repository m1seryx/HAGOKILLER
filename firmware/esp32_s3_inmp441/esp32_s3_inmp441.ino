/*
 * HAGOKILLER - ESP32-S3 + INMP441 + light Hagokiller_inferencing
 * - BLE server for phone app (name: HAGOKILLER Pillow)
 * - ESP-NOW sender to air-pump ESP32
 * - LED flashes 2 times when the app connects, then IoT (mic + detector) starts
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
 * Color coding:
 *   AMBER    = idle / waiting for app
 *   WHITE    = no sound (quiet)
 *   RED      = sound heard, not snoring
 *   BLUE     = snoring
 *   MAGENTA  = air pump motor running (mic ignored)
 *   TEAL     = snore detection stopped from app
 *   ORANGE   = phone risk alarm muted the mic
 *   (After pump: settle still ignores snore counts, LED returns to white/red/blue)
 *
 * Detector: ONE ML zip — Hagokiller_inferencing (MFCC-only)
 *   Impulse 2s window / 500ms stride / 16kHz → continuous slices
 *   Labels: non_snoring | snoring   Decision: accept snore only if snore>=60%
 *   Light RAM: STATIC arena, KissFFT, 500ms buffer, ML only when sound
 * Pump mute LED = magenta only while pump motor runs (settle keeps counting muted).
 * Counting: min 5s between counted snores; mute during pump/valve + settle.
 * Serial Monitor: 115200 baud. Arduino Tools (must match — TinyUSB + Hardware
 *   CDC together = blank Serial):
 *   Board           = ESP32S3 Dev Module
 *   Partition Scheme= Default (mapped to Huge APP 3MB — required for ML)
 *   Optimize        = Smallest (-Os)   (optional)
 *   USB CDC On Boot = Enabled
 *   USB Mode        = Hardware CDC and JTAG
 *   Upload Mode     = UART0 / Hardware CDC   ← not "USB-OTG CDC (TinyUSB)"
 *
 * Pillow cycle (with air-pump ESP):
 *   rolling window: N snores in W seconds (app defaults: 3 in 15s)
 *     -> one pump burst for the app pump seconds (default 40s)
 *   mic ignores snores during the burst + 8s settle
 *   pillow then stays elevated (no automatic deflation)
 *   max 1 burst per inflation; further snoring ~10s -> phone risk alarm (once)
 *   valve never opens automatically; app "open valve" releases air and resets
 *
 * Phone settings (BLE): snore count, window seconds, pump seconds, mic shift.
 * Phone commands (BLE): stop pump, open valve, test pump, mute/unmute mic.
 * Settings/commands require a successful PIN pair first.
 *
 * One Edge Impulse library only: Hagokiller_inferencing.
 */

/**
 * RAM: BLE + WiFi leave little fragmented heap.
 * MFCC-only model (~1300 features).
 * - STATIC EI buffers
 * - KissFFT (no ESP-DSP malloc)
 * - Continuous 500ms slices (16KB) instead of full 2s buffer (64KB)
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
#include <Hagokiller_inferencing.h>
#include "esp32-hal-rgb-led.h"
#include "hagokiller_packets.h"

// Default loop stack is 8KB (EI overflows → reboot).
// 24KB is enough for KissFFT MFCC + BLE without stealing too much heap.
SET_LOOP_TASK_STACK_SIZE(24 * 1024);

#define I2S_WS     4
#define I2S_SCK    5
#define I2S_SD     6
#define I2S_PORT   I2S_NUM_0
#define SAMPLE_RATE 16000
/** One continuous slice = window / 4 = 500ms @ 16kHz. */
#define EI_SLICE_COUNT EI_CLASSIFIER_SLICE_SIZE
/** Raw peak before micShift — used for channel auto-pick + Serial debug. */
#define RAW_MIC_ALIVE_MIN 64

#if defined(RGB_BUILTIN)
  #define RGB_LED_PIN RGB_BUILTIN
#else
  #define RGB_LED_PIN 48
#endif

/** Lower shift = more gain / longer listening range. */
#define MIC_SHIFT_MIN 8
#define MIC_SHIFT_MAX 16
#define MIC_SHIFT_DEFAULT 9
/** Absolute sound gate (RMS): quiet vs any sound — skip ML when quiet. */
#define SOUND_RMS_MIN 150.0f
/** Accept snore only when snoring score >= 60%. */
#define SNORE_MIN_SCORE 0.60f
#define NON_SNORE_MIN_SCORE 0.50f
/** Do not swap Studio labels. */
#define SWAP_SNORE_LABELS 0
/** Consecutive ML snore wins required before counting. */
#define LOUD_STREAK_NEED 1
/** Min gap between mic-test BLE notifies. */
#define MIC_TEST_NOTIFY_MS 280UL
#define PUMP_SEC_MIN 5
#define PUMP_SEC_MAX 120
#define PUMP_SEC_DEFAULT 40
#define SNORE_WINDOW_DEFAULT 15
#define SNORE_WINDOW_MIN 5
#define SNORE_WINDOW_MAX 60
#define SNORE_TIMES_MAX 10
/** Min gap between counted snore events (stops one long snore = 2–3 counts). */
#define SNORE_MIN_GAP_MS 5000UL
/** Extra quiet time after pump finishes before counting snores again. */
#define POST_PUMP_MUTE_MS 8000UL
/** Serial UI bar width for live detect cards. */
#define SERIAL_BAR_W 20
#define VALVE_SEC_DEFAULT 10
/** One pump run per inflation. The app sets how long that run lasts. */
#define MAX_BURSTS_PER_INFLATION 1
/** Snoring must continue this long after the pump max before the phone alarm. */
#define HOLD_ALERT_WAIT_MS 10000UL
/** A snore pause longer than this restarts the alert wait. */
#define HOLD_SNORE_GAP_MS 30000UL
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
static int16_t audio_buffer[EI_SLICE_COUNT];
uint8_t loudStreak = 0;
static bool classifierReady = false;
static bool continuousWarm = false;
/** Last capture: max |raw| before micShift (0 = I2S silence / wrong channel). */
static int lastRawPeak = 0;
/** Active I2S RX slot: LEFT if mic L/R→GND, RIGHT if L/R→3V3. */
static i2s_channel_fmt_t i2sChannelFmt = I2S_CHANNEL_FMT_ONLY_LEFT;
bool i2sReady = false;
bool iotStarted = false;
volatile bool phoneConnected = false;
volatile bool pendingConnectFlash = false;
volatile bool pendingStartIot = false;
volatile bool pendingAdvertise = false;
volatile bool phoneAuthenticated = false;
volatile bool phoneAlarmMute = false;
/** App start/stop snore detection. Stays off until the user taps Start. */
volatile bool snoreDetectionEnabled = false;
bool espNowReady = false;
unsigned long lastSendMs = 0;
unsigned long lastHeartbeatMs = 0;
uint8_t micShift = MIC_SHIFT_DEFAULT;
uint8_t snoreThreshold = 3;
uint8_t snoreWindowSec = SNORE_WINDOW_DEFAULT;
uint8_t pumpSeconds = PUMP_SEC_DEFAULT;
uint8_t snoreStreak = 0;
/** Settings mic-test mode (only while overnight detection is paused). */
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
static const uint8_t EVENT_TEST_PUMP = 8;   // mic -> pump: short manual test, no state change
/** BLE only: Settings mic test — level=snore%, rms=non%, streak=0 quiet / 1 non / 2 snore. */
static const uint8_t EVENT_MIC_TEST = 9;
static const uint8_t FLAG_INTERVENTION = 0x01;
/** Mic -> pump: pillow is flat, start a fresh inflation cycle. */
static const uint8_t FLAG_NEW_CYCLE = 0x02;
/** Mic -> phone: still snoring with the pump time used up, pillow holding position. */
static const uint8_t FLAG_MAX_HOLD = 0x04;
static const uint8_t CMD_STOP = 1;
static const uint8_t CMD_OPEN_VALVE = 2;
static const uint8_t CMD_TEST_PUMP = 3;
/** Phone risk alarm is ringing — ignore mic so the ringtone is not counted as snoring. */
static const uint8_t CMD_MUTE_MIC = 4;
static const uint8_t CMD_UNMUTE_MIC = 5;
/** App toggles overnight listening without unpairing. */
static const uint8_t CMD_STOP_DETECTION = 6;
static const uint8_t CMD_START_DETECTION = 7;
/** Settings screen mic test (preview scores only; detection must be paused). */
static const uint8_t CMD_MIC_TEST_START = 8;
static const uint8_t CMD_MIC_TEST_STOP = 9;

uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void setRgb(uint8_t r, uint8_t g, uint8_t b)
{
    neopixelWrite(RGB_LED_PIN, r, g, b);
}

/** Soft amber — waiting for app / idle (not snore blue). */
void ledIdleWaiting() { setRgb(60, 28, 0); }
void ledWhiteNoSound() { setRgb(255, 255, 255); }
void ledRedNonSnoring() { setRgb(255, 0, 0); }
void ledBlueSnoring() { setRgb(0, 0, 255); }
/** Magenta — only while the air-pump motor is running. */
void ledPumpMute() { setRgb(220, 0, 180); }
/** Teal — snore detection stopped from the app. */
void ledDetectionStopped() { setRgb(0, 160, 160); }
/** Orange — phone risk alarm muted the mic. */
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
        // Do not auto-listen — wait for app Start (countdown).
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
        // Require a fresh correct PIN every session — never inherit a prior AUTH=1.
        setAuth(false);
        Serial.println("BLE: app connected to ESP32");
        Serial.println("BLE: waiting for 7-digit PIN...");
        Serial.flush();
    }

    void onDisconnect(BLEServer *pServer) override {
        phoneConnected = false;
        iotStarted = false;
        phoneAlarmMute = false;
        micTestActive = false;
        setAuth(false);
        // Defer advertising restart to loop() — calling it inside the
        // disconnect callback often fails and the pillow stays undiscoverable.
        pendingAdvertise = true;
        Serial.println("BLE: app disconnected");
        Serial.flush();
        ledIdleWaiting();
    }
};

class PinCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
        String pin = pCharacteristic->getValue();
        pin.trim();
        // Keep only digits (drop nulls / BLE padding).
        String digits;
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
            // Drop the GATT link so a wrong PIN cannot stay connected.
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

void endPumpSession(unsigned long now, const char *reason, bool sendStop);

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
    // Mute through actuator run + settle. Cap so a bad packet cannot lock the mic.
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
    // True while now is still before the mute deadline.
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

/**
 * Count a snore only if enough time passed since the last counted one.
 * Returns 0xFF if ignored (gap / mute), else current streak.
 */
uint8_t noteSnoreEvent(unsigned long now)
{
    if (snoreListenMuted(now)) {
        return 0xFF;
    }
    if (lastCountedSnoreMs != 0 && (now - lastCountedSnoreMs) < SNORE_MIN_GAP_MS) {
        return 0xFE;
    }

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
    if (len < sizeof(CommandMsg)) {
        Serial.println("BLE: command packet too short");
        return;
    }

    CommandMsg msg;
    memcpy(&msg, data, sizeof(msg));
    if (msg.magic != COMMAND_MAGIC) {
        Serial.println("BLE: bad command magic");
        return;
    }

    if (msg.opcode == CMD_STOP) {
        // Air stays in the pillow, so elevated state is kept.
        if (pumpSessionActive) endPumpSession(millis(), "manual stop", false);
        clearSnoreWindow();
        sendPumpControlEvent(EVENT_STOP, 0);
        Serial.println("BLE: manual STOP -> pump ESP");
        return;
    }

    if (msg.opcode == CMD_OPEN_VALVE) {
        uint8_t secs = msg.argSeconds == 0 ? VALVE_SEC_DEFAULT : clampU8(msg.argSeconds, 1, 30);
        if (pumpSessionActive) endPumpSession(millis(), "valve opened", false);
        // Stop inflation first, then open valve.
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
        if (pumpSessionActive) {
            Serial.println("BLE: TEST PUMP ignored - pump already running");
            return;
        }
        uint8_t secs = msg.argSeconds == 0 ? 5 : clampU8(msg.argSeconds, 1, 10);
        sendPumpControlEvent(EVENT_TEST_PUMP, secs);
        // Pump motor noise must not count as snoring; pillow state is unchanged.
        armActuatorMute(millis(), (unsigned long)secs * 1000UL);
        Serial.print("BLE: TEST PUMP -> pump ESP  ");
        Serial.print(secs);
        Serial.println(" sec");
        return;
    }

    if (msg.opcode == CMD_MUTE_MIC) {
        phoneAlarmMute = true;
        clearSnoreWindow();
        resetContinuousClassifier();
        Serial.println("BLE: MUTE MIC (phone alarm) — snore listening off");
        return;
    }

    if (msg.opcode == CMD_UNMUTE_MIC) {
        phoneAlarmMute = false;
        resetContinuousClassifier();
        Serial.println("BLE: UNMUTE MIC — snore listening on");
        return;
    }

    if (msg.opcode == CMD_STOP_DETECTION) {
        snoreDetectionEnabled = false;
        clearSnoreWindow();
        resetContinuousClassifier();
        Serial.println("BLE: STOP DETECTION — snore listening paused");
        return;
    }

    if (msg.opcode == CMD_START_DETECTION) {
        // Overnight listening wins — end any Settings mic test.
        micTestActive = false;
        snoreDetectionEnabled = true;
        clearSnoreWindow();
        clearActuatorMute();
        resetContinuousClassifier();
        Serial.println("BLE: START DETECTION — snore listening on");
        return;
    }

    if (msg.opcode == CMD_MIC_TEST_START) {
        if (snoreDetectionEnabled) {
            Serial.println("BLE: MIC TEST ignored — overnight detection is on (pause it first)");
            return;
        }
        if (!iotStarted || !i2sReady) {
            Serial.println("BLE: MIC TEST ignored — mic IoT not ready yet");
            return;
        }
        micTestActive = true;
        lastMicTestNotifyMs = 0;
        clearActuatorMute();
        resetContinuousClassifier();
        Serial.println("BLE: MIC TEST start — preview scores only");
        return;
    }

    if (msg.opcode == CMD_MIC_TEST_STOP) {
        micTestActive = false;
        resetContinuousClassifier();
        Serial.println("BLE: MIC TEST stop");
        return;
    }

    Serial.print("BLE: unknown command opcode ");
    Serial.println(msg.opcode);
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

    uint8_t nextShift = clampU8(msg.micShift, MIC_SHIFT_MIN, MIC_SHIFT_MAX);
    bool shiftChanged = nextShift != micShift;
    snoreThreshold = clampU8(msg.snoreThreshold, 1, 10);
    pumpSeconds = clampU8(msg.pumpSeconds, PUMP_SEC_MIN, PUMP_SEC_MAX);
    micShift = nextShift;
    snoreWindowSec = clampU8(
        msg.snoreWindowSec == 0 ? SNORE_WINDOW_DEFAULT : msg.snoreWindowSec,
        SNORE_WINDOW_MIN,
        SNORE_WINDOW_MAX
    );
    clearSnoreWindow();
    (void)shiftChanged;

    Serial.println("BLE: settings applied from app");
    printDeviceSettings();
}

class SettingsCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
        if (!phoneAuthenticated) {
            Serial.println("BLE: ignore settings/command — not paired");
            return;
        }

        String raw = pCharacteristic->getValue();
        const uint8_t *bytes = (const uint8_t *)raw.c_str();
        size_t len = raw.length();
        if (len < 4) {
            Serial.println("BLE: write too short");
            return;
        }

        uint32_t magic = (uint32_t)bytes[0]
            | ((uint32_t)bytes[1] << 8)
            | ((uint32_t)bytes[2] << 16)
            | ((uint32_t)bytes[3] << 24);

        if (magic == COMMAND_MAGIC) {
            applyCommandPacket(bytes, len);
        } else if (magic == SETTINGS_MAGIC) {
            applySettingsPacket(bytes, len);
        } else {
            Serial.println("BLE: unknown write magic");
        }
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
    // Re-running WiFi.mode / WiFi.disconnect while BLE is connected drops the
    // phone link. Init once at boot; later pair sessions reuse the peer.
    if (espNowReady) {
        Serial.println("ESP-NOW already ready — skip WiFi reinit (keeps BLE up)");
        return true;
    }

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

    espNowReady = true;
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
    Serial.println("BLE notify -> phone");
}

void notifyPhonePump(uint8_t level, uint16_t rms, uint8_t streak, uint8_t seconds)
{
    if (!phoneAuthenticated || eventChar == nullptr) return;

    PumpMsg msg;
    fillPumpMsgSeconds(msg, level, rms, streak, seconds);
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
    Serial.println("BLE notify -> phone (pump started)");
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
    msg.streak = verdict; // 0 quiet, 1 non-snore, 2 snore
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
}

/**
 * Start one fixed-length pump burst. Snores are ignored while it runs (pump
 * noise) plus POST_PUMP_MUTE_MS, and the rolling window starts over afterwards.
 */
bool startPumpBurst(unsigned long now, uint8_t seconds, bool newInflation,
                    uint8_t level, uint16_t rms, uint8_t streak)
{
    if (now - lastSendMs < SEND_COOLDOWN_MS) {
        Serial.println("ESP-NOW -> pump skipped (send cooldown)");
        return false;
    }
    lastSendMs = now;

    PumpMsg msg;
    fillPumpMsgSeconds(msg, level, rms, streak, seconds);
    if (newInflation) msg.flags |= FLAG_NEW_CYCLE;
    esp_now_send(broadcastAddress, (uint8_t *)&msg, sizeof(msg));

    pumpSessionActive = true;
    pumpSessionStartMs = now;
    pumpSessionMaxMs = (unsigned long)seconds * 1000UL;
    armActuatorMute(now, pumpSessionMaxMs);

    Serial.print("ESP-NOW -> PUMP BURST ");
    Serial.print(seconds);
    Serial.println(" sec");
    return true;
}

void endPumpSession(unsigned long now, const char *reason, bool sendStop)
{
    if (!pumpSessionActive) return;

    unsigned long ranMs = now - pumpSessionStartMs;
    if (ranMs > pumpSessionMaxMs) ranMs = pumpSessionMaxMs;

    if (sendStop) sendPumpControlEvent(EVENT_STOP, 0);
    pumpSessionActive = false;

    // Settle time so leftover motor/pillow noise is not counted as a new snore.
    listenMuteUntilMs = now + POST_PUMP_MUTE_MS;
    clearSnoreWindow();

    Serial.print(">>> PUMP STOPPED (");
    Serial.print(reason);
    Serial.print(") ran ");
    Serial.print(ranMs / 1000.0f, 1);
    Serial.print("s  bursts ");
    Serial.print(burstCount);
    Serial.print("/");
    Serial.print(MAX_BURSTS_PER_INFLATION);
    Serial.println(" — pillow stays elevated <<<");
}

void notifyPhoneMaxHold(uint8_t level, uint16_t rms, uint8_t streak)
{
    if (!phoneAuthenticated || eventChar == nullptr) return;

    PumpMsg msg;
    fillPumpMsg(msg, level, rms, streak, false);
    msg.flags |= FLAG_MAX_HOLD;
    eventChar->setValue((uint8_t *)&msg, sizeof(msg));
    eventChar->notify();
    Serial.println("BLE notify -> phone (max elevation hold alert)");
}

/** Snore with all bursts already used: hold, never deflate. */
void handleSnoreAtPumpLimit(unsigned long now, uint8_t level, uint16_t rms, uint8_t streak)
{
    if (maxHoldAlerted) {
        notifyPhone(level, rms, streak, false);
        Serial.println(">>> Burst limit reached — holding position (alert already sent) <<<");
        return;
    }

    if (capSnoreStartMs == 0 || now - capLastSnoreMs > HOLD_SNORE_GAP_MS) {
        capSnoreStartMs = now;
    }
    capLastSnoreMs = now;

    unsigned long snoringFor = now - capSnoreStartMs;
    if (snoringFor < HOLD_ALERT_WAIT_MS) {
        notifyPhone(level, rms, streak, false);
        Serial.print(">>> Burst limit reached — holding, snoring ");
        Serial.print(snoringFor / 1000UL);
        Serial.print("/");
        Serial.print(HOLD_ALERT_WAIT_MS / 1000UL);
        Serial.println("s before app alert <<<");
        return;
    }

    notifyPhoneMaxHold(level, rms, streak);
    maxHoldAlerted = true;
    Serial.println(">>> STILL SNORING AT MAX ELEVATION — holding position (no pump / no deflate) <<<");
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
        int s = buffer[i];
        if (s == -32768) s = 32767;
        else if (s < 0) s = -s;
        if (s > peak) peak = s;
    }
    return peak;
}

void printDetectorBanner()
{
    serialBanner("LIGHT EI  ·  MFCC-only v3");
    Serial.print("|  sample rate: ");
    Serial.print(SAMPLE_RATE);
    Serial.println(" Hz                         |");
    Serial.print("|  slice: ");
    Serial.print(EI_SLICE_COUNT);
    Serial.print(" samples (~");
    Serial.print((EI_SLICE_COUNT * 1000) / SAMPLE_RATE);
    Serial.println("ms)                   |");
    Serial.print("|  window ");
    Serial.print(EI_CLASSIFIER_RAW_SAMPLE_COUNT / (SAMPLE_RATE / 1000));
    Serial.print("ms / stride ");
    Serial.print((EI_SLICE_COUNT * 1000) / SAMPLE_RATE);
    Serial.println("ms              |");
    Serial.print("|  features ");
    Serial.print(EI_CLASSIFIER_NN_INPUT_FRAME_SIZE);
    Serial.print(" (MFCC)  deploy v");
    Serial.print(EI_CLASSIFIER_PROJECT_DEPLOY_VERSION);
    Serial.println("      |");
    Serial.print("|  quiet RMS < ");
    Serial.print((int)SOUND_RMS_MIN);
    Serial.println("  (skip ML)                 |");
    Serial.print("|  decision  snore>=");
    Serial.print((int)(SNORE_MIN_SCORE * 100.0f));
    Serial.print("%  non>=");
    Serial.print((int)(NON_SNORE_MIN_SCORE * 100.0f));
    Serial.println("%          |");
    Serial.println("|  Partition: Huge APP (3MB) required for ML  |");
    serialRule('+', '-');
    Serial.println();
    Serial.flush();
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
    i2sChannelFmt = channelFmt;
    return true;
}

void teardownI2S()
{
    if (!i2sReady) return;
    i2s_driver_uninstall(I2S_PORT);
    i2sReady = false;
}

/** Quick raw-energy probe (ignores micShift). Speak/tap near mic while this runs. */
int probeRawPeak(int reads)
{
    size_t bytesRead = 0;
    int32_t i2s_buffer[256];
    int rawPeak = 0;
    for (int r = 0; r < reads; r++) {
        esp_err_t result = i2s_read(
            I2S_PORT,
            (void *)i2s_buffer,
            sizeof(i2s_buffer),
            &bytesRead,
            pdMS_TO_TICKS(200)
        );
        if (result != ESP_OK || bytesRead < sizeof(int32_t)) continue;
        int n = (int)(bytesRead / sizeof(int32_t));
        for (int i = 0; i < n; i++) {
            int32_t s = i2s_buffer[i];
            if (s == (int32_t)0x80000000) s = 0x7FFFFFFF;
            else if (s < 0) s = -s;
            if (s > rawPeak) rawPeak = s;
        }
    }
    return rawPeak;
}

/**
 * Install I2S and pick LEFT vs RIGHT slot.
 * INMP441: L/R→GND = left, L/R→3V3 = right. Wrong slot → exact rms=0.
 */
bool setupI2SAutoChannel()
{
    const i2s_channel_fmt_t candidates[2] = {
        I2S_CHANNEL_FMT_ONLY_LEFT,
        I2S_CHANNEL_FMT_ONLY_RIGHT
    };
    const char *names[2] = { "LEFT (L/R→GND)", "RIGHT (L/R→3V3)" };
    int bestIdx = 0;
    int bestPeak = -1;

    Serial.println("I2S: probing mic channel (make some noise)...");
    for (int i = 0; i < 2; i++) {
        teardownI2S();
        if (!setupI2S(candidates[i])) {
            continue;
        }
        i2sReady = true;
        delay(50);
        int peak = probeRawPeak(8);
        Serial.print("  channel ");
        Serial.print(names[i]);
        Serial.print("  rawPeak=");
        Serial.println(peak);
        if (peak > bestPeak) {
            bestPeak = peak;
            bestIdx = i;
        }
    }

    teardownI2S();
    if (!setupI2S(candidates[bestIdx])) {
        return false;
    }
    i2sReady = true;
    Serial.print("I2S: using ");
    Serial.print(names[bestIdx]);
    Serial.print("  rawPeak=");
    Serial.println(bestPeak);
    if (bestPeak < RAW_MIC_ALIVE_MIN) {
        Serial.println("WARN: mic looks dead — check wiring VDD/GND/SD/SCK/WS/L/R");
    }
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
        if (!lab || !lab[0]) {
            lab = ei_classifier_inferencing_categories[i];
        }
        float v = result.classification[i].value;
#if SWAP_SNORE_LABELS
        if (labelIsSnoring(lab)) {
            if (v > nonSnoringScore) nonSnoringScore = v;
        } else if (labelIsNonSnoring(lab) || !labelIsSnoring(lab)) {
            if (v > snoringScore) snoringScore = v;
        }
#else
        if (labelIsSnoring(lab)) {
            if (v > snoringScore) snoringScore = v;
        } else if (labelIsNonSnoring(lab) || !labelIsSnoring(lab)) {
            if (v > nonSnoringScore) nonSnoringScore = v;
        }
#endif
    }
}

bool isSnoringWinner(float snoringScore, float nonSnoringScore)
{
    (void)nonSnoringScore;
    // Only accept snoring when the snoring class is >= 60%.
    return snoringScore >= SNORE_MIN_SCORE;
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

    while (samplesCollected < EI_SLICE_COUNT) {
        esp_err_t result = i2s_read(
            I2S_PORT,
            (void *)i2s_buffer,
            sizeof(i2s_buffer),
            &bytesRead,
            portMAX_DELAY
        );

        if (result != ESP_OK) {
            Serial.println("ERROR: I2S read failed");
            ledRedNonSnoring();
            return false;
        }

        int samplesRead = (int)(bytesRead / sizeof(int32_t));
        for (int i = 0; i < samplesRead && samplesCollected < EI_SLICE_COUNT; i++) {
            int32_t raw = i2s_buffer[i];
            int32_t absRaw = raw;
            if (absRaw == (int32_t)0x80000000) absRaw = 0x7FFFFFFF;
            else if (absRaw < 0) absRaw = -absRaw;
            if (absRaw > rawPeak) rawPeak = absRaw;

            int32_t sample = raw >> micShift;
            if (sample > 32767) sample = 32767;
            if (sample < -32768) sample = -32768;
            audio_buffer[samplesCollected++] = (int16_t)sample;
        }
    }

    lastRawPeak = rawPeak;

    int64_t sum = 0;
    for (int i = 0; i < EI_SLICE_COUNT; i++) sum += audio_buffer[i];
    int16_t mean = (int16_t)(sum / EI_SLICE_COUNT);
    for (int i = 0; i < EI_SLICE_COUNT; i++) {
        int v = (int)audio_buffer[i] - (int)mean;
        if (v > 32767) v = 32767;
        if (v < -32768) v = -32768;
        audio_buffer[i] = (int16_t)v;
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

/**
 * Capture one 500ms slice. Quiet → skip ML. Sound → continuous classifier.
 * Returns verdict: 0 quiet, 1 sound/non-snore, 2 snore.
 */
uint8_t classifySlice(float &rms, int &peak, bool &snoreWin, float &snoreScore01, float &nonScore01)
{
    snoreWin = false;
    snoreScore01 = 0.0f;
    nonScore01 = 1.0f;

    if (!captureSlice(rms, peak)) {
        return 1;
    }

    if (rms < SOUND_RMS_MIN) {
        if (continuousWarm) resetContinuousClassifier();
        else loudStreak = 0;
        float snorePct = constrain(rms / 20.0f, 0.0f, 25.0f);
        snoreScore01 = snorePct / 100.0f;
        nonScore01 = 1.0f - snoreScore01;
        return 0;
    }

    if (!classifierReady) {
        loudStreak = 0;
        snoreScore01 = 0.0f;
        nonScore01 = 1.0f;
        return 1;
    }

    peakNormalizeForMl();

    signal_t signal;
    signal.total_length = EI_SLICE_COUNT;
    signal.get_data = &get_signal_data;
    ei_impulse_result_t result = {0};

    EI_IMPULSE_ERROR res = run_classifier_continuous(&signal, &result, false);
    if (res != EI_IMPULSE_OK) {
        Serial.print("ERROR: run_classifier_continuous failed: ");
        Serial.println((int)res);
        Serial.print("  free heap ");
        Serial.print(ESP.getFreeHeap());
        Serial.print("  largest ");
        Serial.println(ESP.getMaxAllocHeap());
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
    Serial.print("|  verdict   ");
    if (snoreWin) {
        Serial.print(">>>  SNORE  <<<");
        int pad = 42 - 12 - 15;
        for (int i = 0; i < pad; i++) Serial.print(' ');
    } else {
        Serial.print(">>>  NON-SNORE  <<<");
        int pad = 42 - 12 - 19;
        for (int i = 0; i < pad; i++) Serial.print(' ');
    }
    Serial.println("|");
    Serial.print("|  rms ");
    Serial.print(rms, 1);
    Serial.print("   peak ");
    Serial.print(peak);
    Serial.print("   ML snore>=60%  streak ");
    Serial.print(loudStreak);
    Serial.print("/");
    Serial.print(LOUD_STREAK_NEED);
    Serial.println(" |");
    serialRule('+', '-');

    if (snoreWin) {
        ledBlueSnoring();
        unsigned long now = millis();
        uint8_t streak = noteSnoreEvent(now);

        if (streak == 0xFF) {
            Serial.println("|  note: muted (pump / settle)                 |");
            serialRule('+', '-');
        } else if (streak == 0xFE) {
            Serial.print("|  note: min gap ");
            Serial.print(SNORE_MIN_GAP_MS / 1000UL);
            Serial.println("s — count skipped              |");
            serialRule('+', '-');
        } else {
            uint8_t level = snoreLevelFromScore(snoreScore01, rms);
            uint16_t rmsU16 = (uint16_t)constrain((int)rms, 0, 65535);
            Serial.print("|  streak ");
            Serial.print(streak);
            Serial.print("/");
            Serial.print(snoreThreshold);
            Serial.print(" in ");
            Serial.print(snoreWindowSec);
            Serial.print("s   pillow ");
            Serial.print(pillowElevated ? "UP" : "FLAT");
            Serial.println("              |");
            serialRule('+', '-');

            if (burstCount >= MAX_BURSTS_PER_INFLATION) {
                handleSnoreAtPumpLimit(now, level, rmsU16, streak);
            } else if (streak < snoreThreshold) {
                notifyPhone(level, rmsU16, streak, false);
            } else {
                bool newInflation = !pillowElevated;
                if (newInflation) markPillowFlat();
                if (startPumpBurst(now, pumpSeconds, newInflation, level, rmsU16, streak)) {
                    burstCount++;
                    pillowElevated = true;
                    notifyPhonePump(level, rmsU16, streak, pumpSeconds);
                    serialBanner("PUMP BURST");
                    Serial.print("|  burst ");
                    Serial.print(burstCount);
                    Serial.print("/");
                    Serial.print(MAX_BURSTS_PER_INFLATION);
                    Serial.print("   duration ");
                    Serial.print(pumpSeconds);
                    Serial.println("s                  |");
                    serialRule('+', '-');
                } else {
                    // Cooldown blocked the pump — drop this count so the window can retry cleanly.
                    if (snoreTimeCount > 0) {
                        snoreTimeCount--;
                        snoreStreak = snoreTimeCount;
                    }
                    notifyPhone(level, rmsU16, snoreStreak, false);
                    Serial.println("|  pump blocked (cooldown) — snore dropped    |");
                    serialRule('+', '-');
                }
            }
        }
    } else {
        // Keep rolling window; only time expiry removes older snores.
        refreshSnoreWindow(millis());
        ledRedNonSnoring();
        Serial.print("|  window streak stays ");
        Serial.print(snoreStreak);
        Serial.println("                         |");
        serialRule('+', '-');
    }
    Serial.println();
}

/** Settings mic test: EI slice preview (no pump / overnight count). */
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

    if (verdict == 0) {
        ledWhiteNoSound();
    } else if (verdict == 2) {
        ledBlueSnoring();
    } else {
        ledRedNonSnoring();
    }

    notifyPhoneMicTest(snorePct, nonPct, verdict);

    serialBanner("MIC TEST  ·  EI MFCC");
    serialPctLine("SNORE", snoreScore01);
    serialPctLine("NON-SNORE", nonScore01);
    Serial.print("|  rms ");
    Serial.print(rms, 1);
    Serial.print("  peak ");
    Serial.print(peak);
    Serial.print("  loudStreak ");
    Serial.print(loudStreak);
    Serial.println("        |");
    Serial.print("|  verdict   ");
    if (verdict == 0) Serial.print(">>>  QUIET  <<<");
    else if (verdict == 2) Serial.print(">>>  SNORE  <<<");
    else Serial.print(">>>  NON-SNORE  <<<");
    Serial.println("              |");
    serialRule('+', '-');
    Serial.println();
}

bool startIot()
{
    Serial.println("Starting IoT (mic + MFCC-only Hagokiller)...");
    if (!i2sReady) {
        if (!setupI2SAutoChannel()) {
            Serial.println("I2S initialization FAILED");
            setRgb(80, 0, 80);
            return false;
        }
        Serial.println("I2S OK.");
    } else {
        Serial.println("I2S already up — fixed sound gate (no calibration).");
    }

    Serial.print("Fixed gate RMS>=");
    Serial.println((int)SOUND_RMS_MIN);
    Serial.print("Free heap before classifier: ");
    Serial.print(ESP.getFreeHeap());
    Serial.print("  largest ");
    Serial.println(ESP.getMaxAllocHeap());

    run_classifier_init();
    classifierReady = true;
    continuousWarm = false;
    loudStreak = 0;
    clearActuatorMute();

    ledWhiteNoSound();
    printDeviceSettings();
    Serial.print("Free heap after classifier: ");
    Serial.print(ESP.getFreeHeap());
    Serial.print("  largest ");
    Serial.println(ESP.getMaxAllocHeap());
    serialBanner("IoT READY  ·  MFCC-only Hagokiller");
    Serial.print("|  slice ");
    Serial.print((EI_SLICE_COUNT * 1000) / SAMPLE_RATE);
    Serial.println("ms continuous  (STATIC + KissFFT)       |");
    Serial.print("|  features ");
    Serial.print(EI_CLASSIFIER_NN_INPUT_FRAME_SIZE);
    Serial.print("  deploy v");
    Serial.print(EI_CLASSIFIER_PROJECT_DEPLOY_VERSION);
    Serial.println("                   |");
    Serial.print("|  quiet <");
    Serial.print((int)SOUND_RMS_MIN);
    Serial.print("  snore>=");
    Serial.print((int)(SNORE_MIN_SCORE * 100.0f));
    Serial.print("%  non>=");
    Serial.print((int)(NON_SNORE_MIN_SCORE * 100.0f));
    Serial.println("%         |");
    Serial.println("|  WHITE  quiet                                |");
    Serial.println("|  RED    sound → non-snore                    |");
    Serial.println("|  BLUE   sound → snore                        |");
    Serial.println("|  AMBER  idle / waiting for app               |");
    Serial.println("|  Partition: Huge APP (3MB) for ML            |");
    serialRule('+', '-');
    Serial.println();
    Serial.flush();
    return true;
}

/** Print status only when BLE / IoT / detect / mic-test state changes (no 2s spam). */
void serialAliveTick()
{
    uint8_t bleState = !phoneConnected ? 0 : (!phoneAuthenticated ? 1 : 2);
    static uint8_t lastBle = 0xFF;
    static bool lastIot = false;
    static bool lastDetect = false;
    static bool lastMicTest = false;

    if (bleState == lastBle &&
        iotStarted == lastIot &&
        snoreDetectionEnabled == lastDetect &&
        micTestActive == lastMicTest) {
        return;
    }

    lastBle = bleState;
    lastIot = iotStarted;
    lastDetect = snoreDetectionEnabled;
    lastMicTest = micTestActive;

    Serial.print("[status] ble=");
    if (bleState == 0) Serial.print("wait");
    else if (bleState == 1) Serial.print("need-PIN");
    else Serial.print("paired");
    Serial.print("  iot=");
    Serial.print(iotStarted ? "on" : "off");
    Serial.print("  detect=");
    Serial.print(snoreDetectionEnabled ? "on" : "paused");
    Serial.print("  micTest=");
    Serial.println(micTestActive ? "on" : "off");
    Serial.flush();
}

void setup()
{
    // ESP32-S3: Tools must be:
    //   USB CDC On Boot = Enabled
    //   USB Mode        = Hardware CDC and JTAG
    //   Upload Mode     = UART0 / Hardware CDC
    // Serial Monitor: 115200 baud. Open monitor, then press RESET.
    Serial.begin(115200);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && (ARDUINO_USB_CDC_ON_BOOT == 1)
    Serial.setTxTimeoutMs(0);
#endif
    // Wait briefly for the USB host / Serial Monitor to attach.
    unsigned long serialWaitStart = millis();
    while (!Serial && (millis() - serialWaitStart) < 4000UL) {
        delay(10);
    }
    delay(300);

    // Loud boot spam so late-opened Serial Monitor still catches something.
    for (int i = 0; i < 12; i++) {
        Serial.println();
        Serial.print("*** HAGOKILLER SERIAL LIVE ");
        Serial.print(i + 1);
        Serial.println("/12 ***");
        Serial.flush();
        delay(200);
    }

    ledIdleWaiting();

    serialBanner("HAGOKILLER  PILLOW  MIC");
    serialKv("mode", "LIGHT Hagokiller MFCC-only snore>=60%");
    serialKv("baud", "115200");
    Serial.print("|  micShift: ");
    Serial.print(micShift);
    Serial.println("                             |");
    Serial.print("|  slice ");
    Serial.print(EI_SLICE_COUNT);
    Serial.print(" @ ");
    Serial.print(SAMPLE_RATE);
    Serial.print("  snore>=");
    Serial.print((int)(SNORE_MIN_SCORE * 100.0f));
    Serial.println("%         |");
    Serial.println("|  Partition: Huge APP (3MB) for ML           |");
    Serial.println("|  If blank: USB CDC On Boot = Enabled        |");
    Serial.println("|  USB Mode=Hardware CDC  Upload=UART0/CDC   |");
    Serial.println("|  Then Upload, open Serial, press RESET      |");
    serialRule('+', '-');
    printDetectorBanner();
    printDeviceSettings();
    Serial.println("|  1) Open phone app + pair PIN 1234567        |");
    Serial.println("|  2) LED flash x2 = Bluetooth linked         |");
    Serial.println("|  3) Tap Start detection for live ML cards   |");
    Serial.println("|  LED  WHITE quiet · RED other · BLUE snore  |");
    serialRule('+', '-');
    Serial.println(">>> Serial OK — status on state change... <<<");
    Serial.flush();

    setupEspNow();
    setupPhoneBle();
    Serial.println(">>> setup() done — entering loop() <<<");
    Serial.flush();
}

void loop()
{
    serialAliveTick();

    if (pendingAdvertise) {
        pendingAdvertise = false;
        delay(200);
        if (bleServer) {
            bleServer->startAdvertising();
        } else {
            BLEDevice::startAdvertising();
        }
        Serial.println("BLE: waiting for app...");
        Serial.flush();
    }

    if (pendingConnectFlash) {
        pendingConnectFlash = false;
        Serial.println("BLE connected - flashing LED 2 times (enter PIN to start mic)");
        Serial.flush();
        flashBluetoothConnected();
        ledIdleWaiting();
    }

    if (pendingStartIot && phoneAuthenticated && phoneConnected) {
        pendingStartIot = false;
        // New paired session: allow the hold alert again (pillow height is kept).
        maxHoldAlerted = false;
        capSnoreStartMs = 0;
        // Do NOT reinit WiFi/ESP-NOW here — that drops the BLE link.
        setupEspNow();
        if (startIot() && phoneConnected && phoneAuthenticated) {
            iotStarted = true;
            Serial.println("IoT started after PIN pair (fixed threshold, no calibration)");
            Serial.flush();
        } else {
            iotStarted = false;
            Serial.println("IoT start aborted — BLE not stable");
            Serial.flush();
        }
    }

    updatePumpSession(millis());

    if (iotStarted && phoneConnected && phoneAuthenticated) {
        sendMicHeartbeat();
    }

    if (!iotStarted || !i2sReady || !phoneConnected || !phoneAuthenticated) {
        micTestActive = false;
        loudStreak = 0;
        delay(50);
        return;
    }

    // Phone risk alarm is playing — do not run detector on that ringtone.
    // Keep micTestActive; only CMD_MIC_TEST_STOP (Stop button) clears it.
    if (phoneAlarmMute) {
        loudStreak = 0;
        ledPhoneAlarmMute();
        delay(50);
        return;
    }

    // App paused overnight listening — allow Settings mic test only.
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

    // Overnight listening active — never keep mic test running.
    if (micTestActive) {
        micTestActive = false;
        loudStreak = 0;
    }

    // Magenta ONLY while the pump motor session is active.
    // Post-pump / valve / test settle still ignores snore counts (snoreListenMuted)
    // but LED goes back to white/red/blue so it does not look "stuck blinking magenta".
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
        static unsigned long lastQuietScoreMs = 0;
        unsigned long nowQ = millis();
        if (nowQ - lastQuietScoreMs >= 2000UL) {
            lastQuietScoreMs = nowQ;
            Serial.print("[quiet] rms=");
            Serial.print(rms, 1);
            Serial.print(" peak=");
            Serial.print(peak);
            Serial.print(" raw=");
            Serial.print(lastRawPeak);
            Serial.print(" shift=");
            Serial.print(micShift);
            Serial.print(" ch=");
            Serial.print(i2sChannelFmt == I2S_CHANNEL_FMT_ONLY_RIGHT ? "R" : "L");
            Serial.print(" heap=");
            Serial.println(ESP.getFreeHeap());
            if (lastRawPeak < RAW_MIC_ALIVE_MIN) {
                Serial.println("[quiet] mic raw=0 — wiring or L/R channel; lower micShift for more gain");
            }
        }
        return;
    }

    if (snoreWin) {
        handleDetectResult(true, snoreScore01, nonScore01, rms, peak);
        return;
    }

    handleDetectResult(false, snoreScore01, nonScore01, rms, peak);
}
 
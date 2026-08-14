# ESP32-S3 + INMP441 — Smart Pillow Mic Firmware

Paste the Arduino sketch below into **Arduino IDE**, then wire the microphone using the jumper table.

---

## What this firmware does

| Function | Purpose |
|---|---|
| `setupI2S()` | Starts the I2S bus so the ESP32-S3 can receive digital audio from the INMP441 |
| `readMicRMS()` | Reads a block of samples and returns loudness (RMS amplitude) |
| `updateSnoreDetector()` | Tracks loudness over time and decides if it looks like snoring |
| `onSnoreDetected()` | Runs when a snore event is confirmed (prints Serial message; you can add BLE / pillow pump later) |
| `setup()` | Pins, Serial, and I2S initialization |
| `loop()` | Continuously samples the mic and runs snore detection |

**Behavior**
1. Reads audio from the INMP441 over **I2S**.
2. Computes **RMS loudness** every ~50 ms.
3. If loudness stays above a threshold for several consecutive windows → **snore detected**.
4. Prints status on **Serial Monitor** (115200 baud).

---

## Jumper wire connections (INMP441 → ESP32-S3)

> Use **3.3 V only**. Do **not** connect VDD to 5 V.

| INMP441 pin | Connect to ESP32-S3 | Notes |
|---|---|---|
| **VDD** | **3.3V** | Mic power |
| **GND** | **GND** | Common ground |
| **SD** (DOUT / Data) | **GPIO 6** | I2S data from mic → ESP32 |
| **SCK** (BCLK) | **GPIO 5** | I2S bit clock |
| **WS** (LRCLK / LRC) | **GPIO 4** | I2S word select / left-right clock |
| **L/R** | **GND** | Selects **left** channel (use **3.3V** for right) |

### Wiring diagram (text)

```
INMP441                 ESP32-S3
───────                 ────────
VDD  -----------------> 3.3V
GND  -----------------> GND
SD   -----------------> GPIO 6
SCK  -----------------> GPIO 5
WS   -----------------> GPIO 4
L/R  -----------------> GND   (left channel)
```

If your board labels pins differently, only change these three `#define` lines in the sketch:
`I2S_WS`, `I2S_SCK`, `I2S_SD`.

---

## Arduino IDE setup

1. Install **ESP32** board support:  
   **File → Preferences → Additional Board Manager URLs**  
   add: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. **Tools → Board → ESP32 Arduino → ESP32S3 Dev Module** (or your exact S3 board).
3. **Tools → USB CDC On Boot → Enabled** (if Serial does not appear).
4. Select the correct **COM port**.
5. Create a new sketch, **delete all default code**, paste the sketch below, **Upload**.
6. Open **Serial Monitor** at **115200**.

You should see lines like:

```text
RMS=420  snore=0
SNORE DETECTED  severity=medium  rms=1850
```

---

## Fix: `Failed to connect to ESP32-S3: No serial data received`

Your sketch **built OK**. COM5 is open, but the chip did not enter **download / bootloader** mode.

### 1) Close anything using COM5
- Close **Serial Monitor**
- Close other terminals / Arduino IDE windows using COM5
- Unplug USB → wait 3 seconds → plug back in
- Confirm **Tools → Port → COM5** (or the new COM number)

### 2) Use the correct USB port on the board
Many ESP32-S3 boards have **two USB ports**:
- **USB** / **USB-OTG** / labeled **USB** → usually best for upload + Serial
- **UART** / **COM** → needs a USB‑UART chip

Try the other USB socket if upload fails.

### 3) Manual bootloader (most common fix)
1. Hold **BOOT** (sometimes labeled **IO0**)
2. While holding BOOT, press and release **RESET** (or **EN**)
3. Keep holding **BOOT**
4. Click **Upload** in Arduino IDE
5. When you see `Connecting...`, keep holding BOOT until it says `Writing...` or `Chip is...`
6. Then release BOOT

If there is only one button, hold **BOOT**, click Upload, release when writing starts.

### 4) Arduino IDE Tools settings (ESP32-S3)
Use these first:

| Setting | Try |
|---|---|
| **Board** | `ESP32S3 Dev Module` |
| **USB Mode** | `Hardware CDC and JTAG` *or* `USB-OTG (TinyUSB)` |
| **USB CDC On Boot** | `Enabled` |
| **Upload Mode** | `UART0` / `USB-CDC` (try both) |
| **Upload Speed** | `921600` → if fail, try `115200` |
| **Flash Mode** | `QIO` (or `DIO` if QIO fails) |
| **Flash Size** | match your module (often `4MB` or `8MB`) |
| **Port** | correct COM port |

### 5) Disconnect the INMP441 while uploading
Unplug mic jumpers from **GPIO 4 / 5 / 6** during upload, then reconnect after success. Extra wires on I2S pins can sometimes interfere.

### 6) Cable / power
- Use a **data USB cable** (not charge-only)
- Prefer a direct PC USB port (avoid cheap hubs)
- Try another cable / port

### 7) Drivers (Windows)
If the board never shows a stable COM port:
- Install **CP210x** or **CH340** drivers (depends on your board’s USB chip)
- Or for native USB-S3 boards, ensure Windows sees “USB JTAG/serial” / “USB Serial Device”

---

## Arduino sketch (paste this into Arduino IDE)

```cpp
/*
 * HAGOKILLER — ESP32-S3 + INMP441 snore microphone firmware
 * Board: ESP32-S3
 * Mic:   INMP441 (I2S MEMS)
 *
 * Wiring (default):
 *   INMP441 VDD -> 3.3V
 *   INMP441 GND -> GND
 *   INMP441 SD  -> GPIO 6
 *   INMP441 SCK -> GPIO 5
 *   INMP441 WS  -> GPIO 4
 *   INMP441 L/R -> GND
 */

#include <driver/i2s.h>
#include <math.h>

// ===== Pin map (change if your wiring differs) =====
#define I2S_WS   4   // LRCLK / WS
#define I2S_SCK  5   // BCLK / SCK
#define I2S_SD   6   // DOUT / SD
#define I2S_PORT I2S_NUM_0

// ===== Audio settings =====
#define SAMPLE_RATE     16000
#define SAMPLE_BITS     I2S_BITS_PER_SAMPLE_32BIT
#define DMA_BUF_COUNT   4
#define DMA_BUF_LEN     256
#define READ_SAMPLES    256

// ===== Snore detection tuning =====
// Raise THRESHOLD if it false-triggers; lower if it misses soft snores.
#define SNORE_RMS_THRESHOLD   1200
#define QUIET_RMS_THRESHOLD    400
#define SNORE_WINDOWS_NEEDED     6   // consecutive loud windows (~6 * 50ms)
#define COOLDOWN_MS           8000   // ignore new events for 8s after a detect

int32_t i2sBuffer[READ_SAMPLES];

int consecutiveLoud = 0;
unsigned long lastSnoreMs = 0;

// -------------------------------------------------
// setupI2S()
// Configures the ESP32-S3 I2S peripheral as a receiver
// so it can clock and read digital audio from INMP441.
// -------------------------------------------------
bool setupI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = SAMPLE_BITS,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = DMA_BUF_COUNT,
    .dma_buf_len = DMA_BUF_LEN,
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
    Serial.println("ERROR: i2s_driver_install failed");
    return false;
  }
  if (i2s_set_pin(I2S_PORT, &pin_config) != ESP_OK) {
    Serial.println("ERROR: i2s_set_pin failed");
    return false;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  Serial.println("I2S ready — listening on INMP441");
  return true;
}

// -------------------------------------------------
// readMicRMS()
// Reads one DMA block of samples and returns RMS loudness.
// Higher value = louder sound near the mic.
// -------------------------------------------------
float readMicRMS() {
  size_t bytesRead = 0;
  esp_err_t result = i2s_read(
    I2S_PORT,
    (void *)i2sBuffer,
    sizeof(i2sBuffer),
    &bytesRead,
    portMAX_DELAY
  );

  if (result != ESP_OK || bytesRead == 0) {
    return 0.0f;
  }

  int samples = bytesRead / sizeof(int32_t);
  double sumSquares = 0.0;

  for (int i = 0; i < samples; i++) {
    // INMP441 data is usually in the upper bits of the 32-bit word
    int32_t sample = i2sBuffer[i] >> 14;
    sumSquares += (double)sample * (double)sample;
  }

  return (float)sqrt(sumSquares / samples);
}

// -------------------------------------------------
// onSnoreDetected()
// Called when snoring is confirmed.
// Hook BLE / pump / LED logic here later.
// -------------------------------------------------
void onSnoreDetected(float rms) {
  const char *severity = "low";
  if (rms > 2500) severity = "high";
  else if (rms > 1800) severity = "medium";

  Serial.print("SNORE DETECTED  severity=");
  Serial.print(severity);
  Serial.print("  rms=");
  Serial.println((int)rms);

  // TODO (next step for your pillow app):
  // - send BLE notify to the phone
  // - trigger air pump / inflation GPIO
}

// -------------------------------------------------
// updateSnoreDetector()
// Counts consecutive "loud" windows. When enough in a
// row (and cooldown finished), fires onSnoreDetected().
// -------------------------------------------------
void updateSnoreDetector(float rms) {
  unsigned long now = millis();

  if (rms >= SNORE_RMS_THRESHOLD) {
    consecutiveLoud++;
  } else if (rms < QUIET_RMS_THRESHOLD) {
    consecutiveLoud = 0;
  }

  bool cooledDown = (now - lastSnoreMs) > COOLDOWN_MS;
  if (consecutiveLoud >= SNORE_WINDOWS_NEEDED && cooledDown) {
    onSnoreDetected(rms);
    lastSnoreMs = now;
    consecutiveLoud = 0;
  }
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("HAGOKILLER ESP32-S3 + INMP441");
  Serial.println("Open Serial Monitor @ 115200");

  if (!setupI2S()) {
    Serial.println("Halting — fix I2S / wiring");
    while (true) delay(1000);
  }
}

void loop() {
  float rms = readMicRMS();
  updateSnoreDetector(rms);

  // Live debug line (comment out if Serial is too noisy)
  Serial.print("RMS=");
  Serial.print((int)rms);
  Serial.print("  streak=");
  Serial.println(consecutiveLoud);

  delay(50);
}
```

---

## How to tune snore detection

| Symptom | Change |
|---|---|
| Detects talking / room noise | Raise `SNORE_RMS_THRESHOLD` (e.g. 1600 → 2000) |
| Misses real snoring | Lower `SNORE_RMS_THRESHOLD` |
| Triggers too often | Raise `SNORE_WINDOWS_NEEDED` or `COOLDOWN_MS` |
| RMS always ~0 | Check **SD / SCK / WS** wires and that **L/R → GND** |
| Distorted / stuck high | Confirm **3.3V** power and shared **GND** |

---

## Pin function summary (hardware)

| Signal | Role |
|---|---|
| **SCK (BCLK)** | ESP32 clocks bits out of the mic |
| **WS (LRCLK)** | Marks left/right sample frames |
| **SD (DOUT)** | Mic sends PCM audio data to ESP32 |
| **L/R** | Selects which stereo slot the mic uses |
| **VDD / GND** | Power |

---

## Next steps (optional)

1. Add a GPIO to drive your pillow air pump when `onSnoreDetected()` runs.
2. Add BLE (NimBLE) so the React Native app receives real snore events instead of mock data.
3. Match the app’s event fields: `severity`, `duration`, `interventionTriggered`.

If your ESP32-S3 board uses different free GPIOs, tell me which pins are free and we can remap `I2S_WS` / `I2S_SCK` / `I2S_SD`.

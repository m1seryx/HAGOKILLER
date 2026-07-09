# HAGOKILLER IoT Smart Pillow Architecture

This document explains the physical hardware mechanisms, sensor integrations, and software logic behind the **HAGOKILLER** IoT Smart Pillow. 

While the mobile app acts as the remote dashboard, the "Smart Pillow" itself is the active device responsible for detecting snoring and physically intervening to stop it.

---

## 1. Core Hardware Components

The smart pillow is driven by a central microcontroller unit (MCU) embedded safely inside the pillow's base lining.

### A. The Microcontroller: ESP32
- **Why ESP32?** The ESP32 is a low-cost, low-power system-on-a-chip microcontroller with integrated Wi-Fi and dual-mode Bluetooth (BLE). 
- **Role:** It acts as the "brain" of the pillow. It constantly processes incoming sensor data, makes real-time decisions, controls the physical air pumps, and streams data via Bluetooth Low Energy (BLE) to the HAGOKILLER mobile app.

### B. Sensory Array (Detection)
- **MEMS Microphone:** A high-sensitivity, low-profile microphone embedded in the pillow. It listens specifically for the acoustic frequencies and decibel (dB) levels characteristic of snoring.
- **Pressure/Force Sensors:** A grid of thin-film pressure sensors detects whether the user is actually lying on the pillow and tracks their head movements or tossing and turning throughout the night.
- **Vibration Sensor (Accelerometer):** Detects the mechanical vibrations caused by heavy snoring directly through the pillow material.

### C. Mechanical Actuators (Intervention)
- **Pneumatic Air Chambers:** Multiple silent, inflatable polyurethane bladders inside the pillow's core.
- **Micro Air Pump & Solenoid Valves:** A whisper-quiet micro air compressor rapidly pumps air into specific chambers to change the pillow's shape. Solenoid valves allow the air to release (deflate) smoothly and quietly.

---

## 2. How the System Works (Step-by-Step)

### Step 1: Continuous Monitoring (The "Sleep" Phase)
Once the user lies down, the pressure sensors activate the ESP32 from its low-power standby mode. The MEMS microphone begins continuously sampling audio in the room.

### Step 2: Edge Computing & Snore Detection
Instead of sending constant audio to the phone (which drains battery and violates privacy), the ESP32 performs **Edge Computing**.
- It runs a lightweight digital signal processing (DSP) algorithm.
- It filters out background noise (like a fan or AC).
- If it detects a rhythmic acoustic pattern matching a snore, and the dB level crosses the "Sensitivity Threshold," it flags a **Snore Event**.

### Step 3: Physical Intervention (The "Action" Phase)
When a Snore Event is confirmed, the ESP32 triggers the mechanical actuators.
- **Positional Adjustment:** The micro air pump silently inflates specific air chambers under the user's head.
- **Mechanism of Relief:** Elevating or slightly tilting the user's head opens up their airways. Snoring is often caused by relaxed throat tissues collapsing the airway; changing the head's pitch by just 10–15 degrees is often enough to clear the obstruction.
- **Monitoring:** The microphone continues to listen. If the snoring stops, the pump shuts off, and the pillow slowly deflates back to its resting state to ensure maximum comfort.

### Step 4: Data Logging & BLE Syncing
Every event is logged in the ESP32's local flash memory:
- **Timestamp:** When the snore occurred.
- **Duration:** How long the episode lasted.
- **Intensity:** Peak decibel (dB) level.
- **Intervention:** Whether the pillow inflated, and if it was successful.

When the user wakes up and opens the HAGOKILLER mobile app, the ESP32 syncs all this logged data via Bluetooth Low Energy (BLE), which the app then calculates into the beautiful charts and assessments seen on the Dashboard.

---

## 3. Power & Maintenance

- **Battery:** Powered by a rechargeable high-capacity Lithium-Ion battery pack. Because the ESP32 and BLE are highly power-efficient, the pillow only draws significant power during actual inflation events.
- **Charging:** It charges via a standard USB-C port located on a small external tag, or potentially via a wireless charging mat placed under the mattress. 
- **Firmware Updates:** The ESP32 can receive Over-The-Air (OTA) firmware updates directly from the mobile app to improve the snore-detection algorithms over time.

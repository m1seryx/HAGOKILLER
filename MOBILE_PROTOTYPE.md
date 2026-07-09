# HAGOKILLER Mobile App Prototype 

Welcome to the **HAGOKILLER** Smart Sleep System mobile application prototype. This document provides a step-by-step explanation of how the app works, its architecture, and every functionality available to the user.

---

## 1. The Core Architecture

The HAGOKILLER mobile app is built using **React Native** and **Expo**. Because the actual physical "Smart Pillow ESP32" hardware is not connected during development, the app utilizes a **Mock BLE (Bluetooth Low Energy) Service** (`MockBLEService.ts`). 

This service generates simulated, randomized sleep data (like snore events, pillow inflations, and duration) so developers and users can fully interact with the UI as if real hardware were present.

---

## 2. Step-by-Step User Flow & Functionalities

### Step 1: The Boot & Loading Sequence (`LoadingScreen.tsx`)
When the app launches, it initiates the `LoadingScreen`. 
- **Functionality:** This screen fakes a hardware connection sequence. It displays sequential messages like *"Scanning for BLE smart pillow..."*, *"Found SmartPillow-ESP32"*, and *"Syncing database..."*. 
- **Design:** It features a pulsing "Space Midnight" aesthetic with a glowing bed icon and floating "Zzz" animations to establish the premium sleep theme immediately.

### Step 2: Onboarding & Personalization (`NameInputScreen.tsx`)
Once the connection is "established," the user is prompted to enter their name.
- **Functionality:** It captures the user's name to personalize the dashboard. It uses a `KeyboardAvoidingView` to ensure the input field is always accessible. The button remains disabled until a valid name is typed.
- **Design:** A sleek glassmorphic card with a glowing astronaut avatar. The input field highlights with an indigo glow when focused.

### Step 3: The Main Dashboard (`DashboardScreen.tsx`)
The Dashboard is the central hub of the application, utilizing a deep space aesthetic (`#0a0b10`). It is divided into several highly functional sections:

#### A. Header & Hardware Status
- **Greeting:** Welcomes the user by name and displays the current date.
- **BLE Connection Card:** A dedicated card showing the mock status of the ESP32 Smart Pillow. It displays the battery percentage (e.g., 85%) and signal strength, giving the illusion of a live IoT connection.
- **Simulation Override Menu:** A collapsible dropdown menu that allows the user to force the mock data into different states: *Normal*, *Elevated*, or *Critical*. This is used to test how the UI reacts to different severity levels of snoring.

#### B. Time Period Filters (`StatsFilter.tsx`)
- **Functionality:** A segmented control that lets the user switch between `Today`, `7 Days`, `30 Days`, and a `Custom Range`. 
- When the user selects a filter, all the metrics on the dashboard (the grid, the charts, and the recommendations) instantly recalculate based on the selected timeframe.

#### C. Analytics Tab (Metrics Grid & Charts)
- **Metrics Grid (`StatsCard.tsx`):** A 2x2 grid displaying the core data:
  1. **Snore Events:** Total number of snores detected. Changes color based on severity (Green for Normal, Red for Critical).
  2. **Avg. Duration:** The average length of a snore event in seconds.
  3. **Pillow Inflations:** How many times the pillow actively intervened to stop the snoring.
  4. **Peak Hour:** The time of night when snoring was most frequent.
- **Trend Chart (`SnorePatternsChart.tsx`):** A smooth bezier line chart that visually graphs the snore events over the selected time period.
- **Historical Trend:** A list showing month-over-month comparisons, allowing users to see if their condition is "Improving", "Stable", or "Worsening".
- **View Nightly Detail:** When viewing "Today", a button appears that allows the user to deep-dive into the specific timeline of that night.

#### D. Assessment Tab (`RecommendationCard.tsx`)
- **Functionality:** Instead of raw data, this tab provides actionable human-readable advice.
- **Features:** 
  - An AI-style summary of their sleep health.
  - A checklist of therapeutic action items (e.g., "Elevate head by 15 degrees").
  - **Medical Disclaimer:** An italicized label reminding users to consult a doctor if symptoms persist, alongside a bold warning banner if the snoring reaches critical levels.

### Step 4: The Night Detail Deep-Dive (`NightDetailScreen.tsx`)
If the user clicks the "View Nightly Detail Timeline" button on the Dashboard, they are navigated to this screen via React Navigation.
- **Functionality:** It breaks down a single night into microscopic events.
- **Features:**
  - **Sleep Composition Chart:** A circular progress ring showing the percentage of Deep, Light, and REM sleep.
  - **Event Timeline:** A vertical scrollable timeline showing exactly when the user fell asleep, when a snore occurred (including its decibel level), and when the pillow inflated to intervene.
  - **Mock Audio Player:** Snore events feature a visual waveform and a fake "Play" button, prototyping a future feature where users can actually listen to recordings of their snores.

---

## 3. Technology Stack & Key Libraries

- **Framework:** React Native & Expo
- **Routing:** `@react-navigation/native-stack` (for pushing screens like Night Detail over the Dashboard)
- **Visuals & Charts:** `react-native-chart-kit` (for the bezier line charts and progress rings)
- **Icons:** `@expo/vector-icons` (FontAwesome5)
- **Time Parsing:** `moment.js` (for handling dates, historical trends, and dynamic timeline generations)

## Summary
The HAGOKILLER prototype successfully demonstrates a premium, consumer-ready IoT application. By leveraging complex mock data generation, it proves out the entire user journey—from pairing the hardware to analyzing long-term health trends—without requiring a physical pillow during the software design phase.

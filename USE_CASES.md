# HAGOKILLER: System Use Cases Documentation

This document catalogs and describes the functional use cases of the **HAGOKILLER** Smart Pillow Sleep Analytics System. 

Each use case is structured using the standard template:
* **Use Case ID & Title**
* **User (Actors involved)**
* **Description (Goal of the use case)**
* **Fit Criterion (Definition of success / validation)**
* **Use Case Scripts (Step-by-step procedural steps, including error and alternate flows)**

---

## 📋 Table of Contents
1. [Use Case #1: Login (Enter Name)](#use-case-1-login-enter-name)
2. [Use Case #2: Configure Sleep Goal](#use-case-2-configure-sleep-goal)
3. [Use Case #3: Connect to Smart Pillow](#use-case-3-connect-to-smart-pillow)
4. [Use Case #4: View Dashboard Analytics](#use-case-4-view-dashboard-analytics)
5. [Use Case #5: Filter Analytics by Time Period](#use-case-5-filter-analytics-by-time-period)
6. [Use Case #6: Simulate Severity Level](#use-case-6-simulate-severity-level)
7. [Use Case #7: View Health Recommendations](#use-case-7-view-health-recommendations)
8. [Use Case #8: Pull to Refresh Data](#use-case-8-pull-to-refresh-data)
9. [Use Case #9: Detect Snoring Event (Pillow-Side)](#use-case-9-detect-snoring-event-pillow-side)
10. [Use Case #10: Trigger Pillow Intervention (Pillow-Side)](#use-case-10-trigger-pillow-intervention-pillow-side)

---

### Use Case #1: Login (Enter Name)
> **User:** User / Patient  
> **Description:** The system shall allow the user to input their name to establish a session identity and access the main sleep analytics dashboard.  
> **Fit Criterion:** The user enters a validated non-empty name, which is successfully stored, and the system loads the dashboard with a personalized greeting header.  
> **Use case scripts:**
> 1. The application splash/loading sequence completes.
> 2. The Name Input form is loaded, prompting "What should we call you?".
> 3. The user enters their name in the input field.
> 4. If the input field is empty, the "Get Started" button is disabled (preventing submission).
> 5. If the user clicks the "Get Started" button (or presses done on the keyboard) with a valid name, the system stores the profile in local storage, grants access, and loads the dashboard displaying the personalized greeting: *"Hello, [Name]"*.

---

### Use Case #2: Configure Sleep Goal
> **User:** User / Patient  
> **Description:** The system shall allow the user to configure their targeted daily sleep duration goal.  
> **Fit Criterion:** The user inputs a validated sleep target in hours, which is saved, and is used to compute sleep quality scores and personalize advice.  
> **Use case scripts:**
> 1. The Sleep Goal configuration setting is loaded.
> 2. The user enters their desired sleep goal hours (e.g., 8 hours).
> 3. If the entered value is invalid (e.g., non-numeric, negative, or excessive), the system displays a validation error prompt: *"ERROR: Invalid sleep goal hours. Please enter a valid number."*
> 4. If the value is correct and submitted, the system updates `tbluserprofile` with the new sleep goal.
> 5. The system automatically recalculates the daily sleep quality metrics on the dashboard relative to the new goal and displays: *"SUCCESS: Sleep goal updated successfully."*

---

### Use Case #3: Connect to Smart Pillow
> **User:** User / Patient, IoT Smart Pillow  
> **Description:** The system shall establish a Bluetooth Low Energy (BLE) connection handshake between the mobile app and the Smart Pillow hardware.  
> **Fit Criterion:** A BLE handshake is successfully completed, and the connection status indicator updates to show paired active telemetry.  
> **Use case scripts:**
> 1. The app starts scanning for nearby Smart Pillow BLE devices.
> 2. The system locates the device and attempts a pairing handshake.
> 3. If one of the BLE connection handshakes fails or is out of range, a notification prompts: *"CONNECTION FAILED: Smart Pillow is out of range or Bluetooth is disabled."* The user can select to retry or fall back to cached data.
> 4. If the connection details are correct and paired, the status badge prompts: *"CONNECTION ESTABLISHED: Successfully paired with HAGOKILLER Smart Pillow"*.
> 5. The system begins displaying active BLE signal strength and device battery status on the header.

---

### Use Case #4: View Dashboard Analytics
> **User:** User / Patient  
> **Description:** The system shall compile and display aggregated snoring and sleep metrics on the visual analytics dashboard.  
> **Fit Criterion:** The dashboard loads correctly, rendering statistics cards, sleep quality indicators, and interactive snore pattern charts.  
> **Use case scripts:**
> 1. The dashboard screen is loaded after login.
> 2. The system queries daily and monthly sleep stats from `tbldailystats` and `tblmonthlystats`.
> 3. If database query fails, a message prompts: *"ERROR: Failed to load sleep database. Please pull to refresh."*
> 4. If the data is successfully retrieved, the system renders the stats cards:
>    * Total Snoring Events
>    * Average Snore Duration (seconds)
>    * Active Intervention Count
>    * Peak Snoring Hour
> 5. The system renders the 7-Day Snore Pattern Chart showing event distribution, alongside the calculated severity badge (Normal, Bad, or Danger).

---

### Use Case #5: Filter Analytics by Time Period
> **User:** User / Patient  
> **Description:** The system shall allow the user to filter their sleep metrics by Today, 7 Days, Month, or a custom Date Range.  
> **Fit Criterion:** The selected filter is applied, and the dashboard statistics and pattern charts update dynamically to reflect only the selected timeframe.  
> **Use case scripts:**
> 1. The user taps a filter option (Today, 7 Days, Month, or Date Range) on the filter bar.
> 2. If "Date Range" is selected, the system loads input fields for "From" and "To" dates.
> 3. If the custom date format is invalid (e.g., end date is before start date), the system prompts: *"ERROR: Invalid date range. End date must be after start date."*
> 4. If the entered values are correct and applied, the system queries the events from `tblsleepevent` within the specified timeframe.
> 5. The system updates the dashboard statistics cards and redraws the pattern charts instantly.

---

### Use Case #6: Simulate Severity Level
> **User:** User / Patient, Developer / Tester  
> **Description:** The system shall allow the user to override the computed snoring severity to preview dashboard layout adjustments.  
> **Fit Criterion:** The user selects a simulated severity, and the dashboard badge, theme colors, and recommendations adapt immediately.  
> **Use case scripts:**
> 1. The user taps the "Simulate Severity" dropdown button.
> 2. The severity options dropdown menu is loaded (Normal, Bad, Danger).
> 3. The user selects a severity level (e.g., "Danger").
> 4. The system overrides the active status, immediately updating the status badge to `🔴 DANGER` and updating theme accents.
> 5. The system feeds the overridden status to the Recommendation Engine, updating the dashboard tabs with corresponding urgent warnings.

---

### Use Case #7: View Health Recommendations
> **User:** User / Patient  
> **Description:** The system shall generate personalized, severity-based health recommendations and actionable lifestyle advice.  
> **Fit Criterion:** The recommendations tab displays corresponding advice and clinical suggestions matching the current severity and trend.  
> **Use case scripts:**
> 1. The user taps the "Recommendations" tab on the dashboard.
> 2. The system checks the current severity level (Normal, Bad, or Danger) and the month-over-month trend (Improving, Stable, or Worsening).
> 3. The Recommendation Engine retrieves matching content from `tblrecommendation`.
> 4. If severity is classified as "Danger", the system highlights a critical warning card: *"CRITICAL ALERT: Your snoring events have exceeded danger thresholds. We recommend consulting a medical professional."*
> 5. If severity is "Normal", the system renders positive wellness tips and motivational trend messages.

---

### Use Case #8: Pull to Refresh Data
> **User:** User / Patient  
> **Description:** The system shall allow the user to manually trigger a sync gesture to fetch the latest sleep data from the Smart Pillow.  
> **Fit Criterion:** A pull-down gesture triggers a database sync via BLE and updates all stats and graphs.  
> **Use case scripts:**
> 1. The user performs a pull-down gesture at the top of the dashboard.
> 2. The refresh indicator begins spinning.
> 3. The app establishes connection and queries the Smart Pillow for new sleep events.
> 4. If the connection fails or drops during sync, a prompt appears: *"SYNC FAILED: Pillow disconnected. Please check Bluetooth connection and retry."*
> 5. If the new events are successfully received, the system writes them to `tblsleepevent`, aggregates stats, updates charts, and dismisses the refresh indicator.

---

### Use Case #9: Detect Snoring Event (Pillow-Side)
> **User:** IoT Smart Pillow (Acoustic Sensors / Edge AI)  
> **Description:** The Smart Pillow shall monitor acoustic signals during sleep and classify snoring events in real-time.  
> **Fit Criterion:** The embedded Edge AI classifier flags breathing patterns as snoring, logging duration and severity.  
> **Use case scripts:**
> 1. The Smart Pillow is active and in monitoring mode during sleep.
> 2. The INMP441 digital microphone captures ambient acoustic signals.
> 3. The on-device Edge AI classifies audio features in real-time.
> 4. If snoring is detected, a snore event timer begins.
> 5. The Edge AI model determines snore severity (Low, Medium, or High) based on frequency and decibel levels.
> 6. Once the snoring sounds stop, the event is saved to local device flash buffer, capturing start timestamp, duration, and severity level.

---

### Use Case #10: Trigger Pillow Intervention (Pillow-Side)
> **User:** IoT Smart Pillow (Air Pump & Valve Actuators)  
> **Description:** The Smart Pillow shall trigger a physical head-repositioning intervention if high-severity snoring is detected.  
> **Fit Criterion:** When severe snoring is detected, the airbag inflates to gently reposition the head, logging intervention details.  
> **Use case scripts:**
> 1. The Smart Pillow Edge AI model classifies an active snore event as High severity.
> 2. The microcontroller triggers the inflation valve and starts the air pump.
> 3. The airbag inflates, gently lifting and shifting the user's head position to clear their airway.
> 4. The system logs the intervention flag (`interventionTriggered: true`) and tracks duration.
> 5. If snoring levels drop below threshold (or maximum inflation limit is reached), the pump stops, air slowly deflates, and the session log is updated.

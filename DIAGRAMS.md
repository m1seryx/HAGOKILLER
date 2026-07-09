# HAGOKILLER: System Diagrams Documentation

This document provides the complete set of system-level diagrams for the **HAGOKILLER Smart Pillow Sleep Analytics System**. Each section contains a **Mermaid diagram** (renderable in GitHub/VS Code), a thorough **discussion and explanation**, and the corresponding **Graphviz DOT code** that can be pasted into [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/) to generate high-quality images.

---

## 4.5.1 Context Diagram

### Diagram (Mermaid)

```mermaid
graph LR
    subgraph External Entities
        USER["👤 User / Patient"]
        PILLOW["🛏️ IoT Smart Pillow<br>(ESP32 + INMP441)"]
    end

    SYSTEM(("HAGOKILLER<br>Context Diagram"))

    %% Inflows from User
    USER -->|"User Profile (Create, Update, Delete)"| SYSTEM
    USER -->|"Sleep Goal Configuration"| SYSTEM
    USER -->|"Severity Simulation Selection"| SYSTEM
    USER -->|"Time Period Filter (Today, Week, Month, Range)"| SYSTEM
    USER -->|"Date Range Selection"| SYSTEM
    USER -->|"Refresh / Pull-to-Refresh"| SYSTEM
    USER -->|"Tab Navigation (Analytics, Recommendations)"| SYSTEM
    USER -->|"Login (Name Input)"| SYSTEM

    %% Outflows to User
    SYSTEM -->|"Dashboard Analytics Display"| USER
    SYSTEM -->|"Snoring Event Statistics"| USER
    SYSTEM -->|"Snore Pattern Charts (7-Day, 30-Day)"| USER
    SYSTEM -->|"Severity Classification (Normal, Bad, Danger)"| USER
    SYSTEM -->|"Health Recommendations & Action Items"| USER
    SYSTEM -->|"Monthly Trend Analysis"| USER
    SYSTEM -->|"Peak Snoring Hour"| USER
    SYSTEM -->|"Intervention Count & Duration"| USER

    %% Inflows from Smart Pillow
    PILLOW -->|"BLE Connection Handshake"| SYSTEM
    PILLOW -->|"Raw Snoring Audio Events"| SYSTEM
    PILLOW -->|"Snore Duration & Severity Data"| SYSTEM
    PILLOW -->|"Intervention Trigger Signals"| SYSTEM
    PILLOW -->|"Device Signal Strength"| SYSTEM

    %% Outflows to Smart Pillow
    SYSTEM -->|"Intervention Activation Command"| PILLOW
    SYSTEM -->|"Connection Status Acknowledgement"| PILLOW

    style SYSTEM fill:#1a1a2e,stroke:#3b82f6,stroke-width:3px,color:#ffffff
    style USER fill:#DBEAFE,stroke:#1D4ED8,stroke-width:2px,color:#1E293B
    style PILLOW fill:#FEF9C3,stroke:#B45309,stroke-width:2px,color:#1E293B
```

### Discussion and Explanation

The **Context Diagram** (also called a Level 0 DFD) provides the highest-level view of the HAGOKILLER system. It shows the system as a single process bubble and identifies all **external entities** that interact with it, along with the **data flows** crossing the system boundary.

#### External Entities

1. **User / Patient**
   - The primary human actor who interacts with the HAGOKILLER mobile application. The user creates a profile by inputting their name, configures sleep goals (e.g., 8 hours of sleep per night), and navigates through the dashboard interface. The user receives computed analytics, severity classifications, chart visualizations, health-based recommendations, and trend reports generated from aggregated snoring data.
   - **Inbound data flows** include profile creation data, sleep goal values, severity simulation selections (used for demo/testing purposes), time period filter choices (Today, Week, Month, Custom Range), date range specifications, pull-to-refresh triggers, and tab navigation commands.
   - **Outbound data flows** include the fully computed dashboard display (snoring event counts, average durations, intervention counts, peak snoring hours), 7-day and 30-day pattern charts, severity classification labels (Normal, Bad, or Danger), personalized health recommendations with actionable items, and month-over-month trend analysis (Improving, Stable, or Worsening).

2. **IoT Smart Pillow (ESP32 + INMP441)**
   - The hardware external entity consisting of an ESP32 microcontroller equipped with an INMP441 digital MEMS microphone. This device performs real-time acoustic monitoring during sleep, classifies snoring intensity using an on-device Edge AI model, and activates a physical air-inflation intervention mechanism to gently reposition the user's head when snoring severity exceeds configured thresholds.
   - **Inbound data flows** from the pillow include BLE (Bluetooth Low Energy) connection handshake signals, raw snoring event data (timestamped with millisecond precision), computed snore duration and severity classification (low, medium, high), intervention trigger flags (whether the air bag inflated), and device telemetry such as signal strength and connection status.
   - **Outbound data flows** to the pillow include intervention activation commands (instructing the pillow to inflate its air mechanism) and connection status acknowledgements (confirming the BLE link is established).

#### System Boundary

The central process bubble labeled **"HAGOKILLER Context Diagram"** encapsulates the entire mobile application logic, including:
- User profile management and local storage (SQLite/AsyncStorage)
- BLE device pairing and communication management
- Sleep event ingestion and persistent logging
- Daily and monthly statistics aggregation
- Severity classification engine (threshold-based: Normal ≤ 3 events, Bad ≤ 10 events, Danger > 10 events)
- Recommendation generation engine
- Dashboard rendering with charts and analytics
- Trend calculation across multiple months

The context diagram deliberately abstracts away all internal processing to focus on **what data enters and exits** the system boundary, establishing the scope of the HAGOKILLER system for stakeholders and developers.

---

### Graphviz DOT Code — Context Diagram

Copy the code below into [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/) to render:

```dot
digraph HAGOKILLER_Context {
    graph [pad="0.5", nodesep="0.8", ranksep="2.0", bgcolor="#ffffff", splines=true, fontname="Helvetica"];
    node [fontname="Helvetica", fontsize=11];
    edge [fontname="Helvetica", fontsize=9, color="#4B5563"];

    // ─── EXTERNAL ENTITIES ─── (Rectangles)
    node [shape=box, style="filled,bold", fillcolor="#DBEAFE", color="#1D4ED8",
          penwidth=2.5, fontsize=12, width=2.0, height=0.7];

    USER [label="User / Patient"];
    PILLOW [label="IoT Smart Pillow\n(ESP32 + INMP441)", fillcolor="#FEF9C3", color="#B45309"];

    // ─── CENTRAL PROCESS ─── (Circle)
    node [shape=circle, style="filled,bold", fillcolor="#1a1a2e", color="#3b82f6",
          penwidth=3, fontcolor="#ffffff", fontsize=13, width=2.5, height=2.5, fixedsize=true];

    SYSTEM [label="HAGOKILLER\nSleep Analytics\nSystem"];

    // ─── DATA FLOWS: User → System ─── (Blue arrows)
    edge [color="#2563EB", fontcolor="#1D4ED8", arrowsize=0.7, penwidth=1.2];

    USER -> SYSTEM [label="User Profile\n(Create, Update, Delete)"];
    USER -> SYSTEM [label="Sleep Goal Config\nSeverity Simulation\nTime Filter / Range"];
    USER -> SYSTEM [label="Login (Name Input)\nRefresh Request\nTab Navigation"];

    // ─── DATA FLOWS: System → User ─── (Green arrows)
    edge [color="#059669", fontcolor="#065F46", arrowsize=0.7, penwidth=1.2];

    SYSTEM -> USER [label="Dashboard Analytics\nSnore Pattern Charts\nSeverity Classification"];
    SYSTEM -> USER [label="Health Recommendations\nMonthly Trend Analysis\nIntervention Reports"];
    SYSTEM -> USER [label="Peak Hour Display\nEvent Counts\nAvg Duration Stats"];

    // ─── DATA FLOWS: Pillow → System ─── (Amber arrows)
    edge [color="#D97706", fontcolor="#92400E", arrowsize=0.7, penwidth=1.2];

    PILLOW -> SYSTEM [label="BLE Handshake\nRaw Snore Events\nDuration & Severity"];
    PILLOW -> SYSTEM [label="Intervention Triggers\nSignal Strength\nDevice Telemetry"];

    // ─── DATA FLOWS: System → Pillow ─── (Red arrows)
    edge [color="#DC2626", fontcolor="#991B1B", arrowsize=0.7, penwidth=1.2];

    SYSTEM -> PILLOW [label="Intervention Command\nConnection ACK"];

    // ─── LAYOUT HINTS ───
    { rank=same; USER; PILLOW; }
}
```

---

## 4.5.2 Data Flow Diagram (Level 1 DFD)

### Diagram (Mermaid)

```mermaid
graph TB
    %% External Entities
    USER["👤 User / Patient"]
    PILLOW["🛏️ IoT Smart Pillow"]

    %% Processes
    P1(("1.0\nUser Profile\nManagement"))
    P2(("2.0\nBLE Device\nPairing"))
    P3(("3.0\nSleep Event\nIngestion"))
    P4(("4.0\nDaily Statistics\nAggregation"))
    P5(("5.0\nMonthly Statistics\nAggregation"))
    P6(("6.0\nSeverity\nClassification"))
    P7(("7.0\nRecommendation\nEngine"))
    P8(("8.0\nDashboard\nRendering"))
    P9(("9.0\nTrend\nCalculation"))

    %% Data Stores
    DS1[("D1: tbluserprofile")]
    DS2[("D2: tbldevice")]
    DS3[("D3: tblsleepevent")]
    DS4[("D4: tbldailystats")]
    DS5[("D5: tblmonthlystats")]
    DS6[("D6: tblrecommendation")]

    %% User → Processes
    USER -->|"Name, Age, Sleep Goal"| P1
    USER -->|"Time Filter, Date Range,\nSeverity Simulation,\nTab Selection"| P8

    %% Pillow → Processes
    PILLOW -->|"BLE Address,\nDevice Name,\nSignal Strength"| P2
    PILLOW -->|"Raw Snore Events\n(timestamp, duration,\nseverity, intervention)"| P3

    %% Process → Data Stores
    P1 -->|"Store Profile"| DS1
    P2 -->|"Store Device Info"| DS2
    P3 -->|"Store Sleep Event"| DS3
    P4 -->|"Store Daily Stats"| DS4
    P5 -->|"Store Monthly Stats"| DS5

    %% Data Store → Processes
    DS1 -->|"profileID"| P2
    DS1 -->|"profileID"| P3
    DS2 -->|"deviceID"| P3
    DS3 -->|"Sleep Events"| P4
    DS3 -->|"Sleep Events"| P5
    DS4 -->|"Daily Stats"| P6
    DS5 -->|"Monthly Stats"| P6
    DS4 -->|"Daily Stats"| P9
    DS5 -->|"Monthly Stats"| P9
    DS6 -->|"Recommendation\nTemplates"| P7

    %% Inter-Process Flows
    P4 -->|"Aggregated Daily Data"| P6
    P5 -->|"Aggregated Monthly Data"| P6
    P6 -->|"Severity Level\n(Normal/Bad/Danger)"| P7
    P6 -->|"Severity Level"| P8
    P7 -->|"Recommendations &\nAction Items"| P8
    P9 -->|"Trend\n(Improving/Stable/Worsening)"| P7
    P9 -->|"Trend Data"| P8
    P4 -->|"Chart Data Points"| P8
    P1 -->|"User Name"| P8

    %% Processes → User
    P8 -->|"Dashboard Display:\nCharts, Stats, Severity,\nRecommendations, Trends"| USER

    %% Process → Pillow
    P2 -->|"Connection ACK"| PILLOW
    P3 -->|"Intervention Command"| PILLOW
```

### Discussion and Explanation

The **Level 1 Data Flow Diagram** decomposes the single HAGOKILLER process bubble from the Context Diagram into its constituent sub-processes. It reveals **how data moves** through the internal system — from external entities, through processing stages, into and out of data stores, and ultimately back to the user.

#### Processes

1. **Process 1.0 — User Profile Management**
   - **Function**: Handles the creation, updating, and retrieval of user profiles. When the user first opens the application, they enter their name via the `NameInputScreen`. This process stores the profile data (userName, age, sleepGoalHours, timestamps) into `D1: tbluserprofile`.
   - **Input**: Name, age, and sleep goal from the User.
   - **Output**: The stored `profileID` is passed to Process 2.0 (Device Pairing) and Process 3.0 (Event Ingestion) as a foreign key reference, ensuring all subsequent data is linked to the correct user. The user's display name is also forwarded to Process 8.0 for dashboard greeting rendering.

2. **Process 2.0 — BLE Device Pairing**
   - **Function**: Manages the Bluetooth Low Energy handshake with the ESP32-based Smart Pillow hardware. The `MockBLEService.connect()` method simulates this process, establishing a communication channel for real-time sensor data transmission.
   - **Input**: BLE address, device name, and signal strength telemetry from the IoT Smart Pillow.
   - **Output**: Device metadata is persisted in `D2: tbldevice`. A connection acknowledgement is sent back to the pillow. The `deviceID` is forwarded to Process 3.0 so that each sleep event can be attributed to the correct hardware unit.

3. **Process 3.0 — Sleep Event Ingestion**
   - **Function**: The core data capture process. It receives raw acoustic snoring events from the smart pillow — each containing a Unix timestamp (millisecond precision), duration in seconds, severity classification from the Edge AI model (low/medium/high), and a boolean flag indicating whether the pillow's air-inflation intervention was triggered.
   - **Input**: Raw event packets from the Smart Pillow; `profileID` from Process 1.0; `deviceID` from Process 2.0.
   - **Output**: Each event is stored as a row in `D3: tblsleepevent`. The accumulated events in this store feed into both Process 4.0 and Process 5.0 for aggregation. If a critical snoring event is detected, an intervention command is sent back to the pillow.

4. **Process 4.0 — Daily Statistics Aggregation**
   - **Function**: Queries `D3: tblsleepevent` for a given calendar date (formatted as `YYYY-MM-DD`), then computes: total snore event count, average snore duration, total intervention count, and the peak snoring hour (the clock hour with the most events). This is implemented in `calculateDailyStats()`.
   - **Input**: Raw sleep events from `D3`.
   - **Output**: A `DailyStats` record written to `D4: tbldailystats`. The aggregated data flows to Process 6.0 for severity classification and to Process 8.0 for chart rendering (the 7-day and 30-day pattern charts).

5. **Process 5.0 — Monthly Statistics Aggregation**
   - **Function**: Aggregates all sleep events within a given month (`YYYY-MM` format) to produce monthly totals. Implemented in `calculateMonthlyStats()`.
   - **Input**: Raw sleep events from `D3`.
   - **Output**: A `MonthlyStats` record stored in `D5: tblmonthlystats`. This feeds Process 6.0, Process 9.0 (for trend comparison between months), and Process 8.0 (for the Monthly Trend section of the dashboard).

6. **Process 6.0 — Severity Classification**
   - **Function**: Applies threshold rules to classify the user's snoring condition:
     - **Normal**: ≤ 3 events/day AND average duration ≤ 30 seconds
     - **Bad**: ≤ 10 events/day AND average duration ≤ 60 seconds
     - **Danger**: > 10 events/day OR average duration > 60 seconds
   - This is implemented in `calculateDailySeverity()` and `calculateMonthlySeverity()`.
   - **Input**: Aggregated daily and monthly statistics from Processes 4.0 and 5.0.
   - **Output**: A severity label (`normal`, `bad`, or `danger`) forwarded to Process 7.0 (to select appropriate recommendations) and Process 8.0 (to render severity badges and color-coded indicators).

7. **Process 7.0 — Recommendation Engine**
   - **Function**: Maps the severity classification and trend data to a catalog of health recommendations stored in `D6: tblrecommendation`. Each severity level triggers a distinct set of actionable advice — ranging from general wellness tips (Normal) to urgent medical referral warnings (Danger).
   - **Input**: Severity level from Process 6.0; trend direction from Process 9.0; recommendation templates from `D6`.
   - **Output**: A structured `RecommendationData` object (containing the recommendation text, action items array, and trend message) forwarded to Process 8.0 for display on the Recommendations tab.

8. **Process 8.0 — Dashboard Rendering**
   - **Function**: The presentation layer process that assembles all computed data into the user-facing mobile interface. It renders the greeting header, severity badge, stats cards (Snoring Events, Avg Duration, Interventions, Peak Hour), snore pattern charts, monthly trend rows, and the recommendations card.
   - **Input**: User name from Process 1.0; severity level from Process 6.0; recommendations from Process 7.0; trend data from Process 9.0; chart data points from Process 4.0; user interaction inputs (time filters, date ranges, tab selections, severity simulator, refresh triggers).
   - **Output**: The complete dashboard display rendered on the user's mobile screen, including all analytics, charts, recommendations, and trend visualizations.

9. **Process 9.0 — Trend Calculation**
   - **Function**: Compares monthly statistics across two or more consecutive months to determine the overall direction of the user's snoring pattern. A decrease of more than 10% in average daily events signals "Improving"; an increase of more than 10% signals "Worsening"; otherwise "Stable". Implemented in `calculateTrend()`.
   - **Input**: Monthly statistics from `D5: tblmonthlystats`.
   - **Output**: A trend label (`improving`, `stable`, or `worsening`) forwarded to Process 7.0 (to customize the trend message in recommendations) and Process 8.0 (to render the trend badge and monthly comparison arrows).

#### Data Stores

| Store | Name | Description |
|:------|:-----|:------------|
| D1 | `tbluserprofile` | User identity, demographics, sleep goals, and audit timestamps. |
| D2 | `tbldevice` | Paired BLE smart pillow metadata (device name, BLE MAC address, connection status, signal strength). |
| D3 | `tblsleepevent` | Individual snoring event records with timestamps, durations, severity classifications, and intervention flags. |
| D4 | `tbldailystats` | Pre-aggregated daily statistics for fast chart rendering and severity calculation. |
| D5 | `tblmonthlystats` | Pre-aggregated monthly statistics for long-term trend tracking. |
| D6 | `tblrecommendation` | Static recommendation catalog mapping severity levels to health advice templates. |

---

### Graphviz DOT Code — Data Flow Diagram

```dot
digraph HAGOKILLER_DFD {
    graph [pad="0.5", nodesep="0.7", ranksep="1.0", bgcolor="#ffffff",
           splines=true, fontname="Helvetica", compound=true];
    node [fontname="Helvetica", fontsize=10];
    edge [fontname="Helvetica", fontsize=8, color="#4B5563"];

    // ─── EXTERNAL ENTITIES ─── (Rectangles, bold borders)
    node [shape=box, style="filled,bold", penwidth=2.5, width=1.8, height=0.6];

    USER [label="User / Patient", fillcolor="#DBEAFE", color="#1D4ED8", fontsize=11];
    PILLOW [label="IoT Smart Pillow\n(ESP32 + INMP441)", fillcolor="#FEF9C3", color="#B45309", fontsize=11];

    // ─── PROCESSES ─── (Circles)
    node [shape=circle, style="filled,bold", fillcolor="#EDE9FE", color="#7C3AED",
          penwidth=2, fontsize=9, width=1.2, height=1.2, fixedsize=true];

    P1 [label="1.0\nUser Profile\nMgmt"];
    P2 [label="2.0\nBLE Device\nPairing"];
    P3 [label="3.0\nSleep Event\nIngestion"];
    P4 [label="4.0\nDaily Stats\nAggregation"];
    P5 [label="5.0\nMonthly Stats\nAggregation"];
    P6 [label="6.0\nSeverity\nClassification"];
    P7 [label="7.0\nRecommendation\nEngine"];
    P8 [label="8.0\nDashboard\nRendering"];
    P9 [label="9.0\nTrend\nCalculation"];

    // ─── DATA STORES ─── (Open-ended rectangles / double lines)
    node [shape=record, style="filled", fillcolor="#F3F4F6", color="#6B7280",
          penwidth=1.5, fontsize=9, height=0.4];

    DS1 [label="D1 | tbluserprofile"];
    DS2 [label="D2 | tbldevice"];
    DS3 [label="D3 | tblsleepevent"];
    DS4 [label="D4 | tbldailystats"];
    DS5 [label="D5 | tblmonthlystats"];
    DS6 [label="D6 | tblrecommendation"];

    // ─── USER → PROCESS FLOWS ───
    edge [color="#2563EB", fontcolor="#1D4ED8", arrowsize=0.7, penwidth=1.2];

    USER -> P1 [label="Name, Age,\nSleep Goal"];
    USER -> P8 [label="Filters, Tab\nSelection, Refresh"];

    // ─── PILLOW → PROCESS FLOWS ───
    edge [color="#D97706", fontcolor="#92400E"];

    PILLOW -> P2 [label="BLE Address,\nDevice Name"];
    PILLOW -> P3 [label="Raw Snore Events\n(timestamp, duration,\nseverity, intervention)"];

    // ─── PROCESS → DATA STORE FLOWS ───
    edge [color="#059669", fontcolor="#065F46"];

    P1 -> DS1 [label="Store\nProfile"];
    P2 -> DS2 [label="Store\nDevice"];
    P3 -> DS3 [label="Store\nEvent"];
    P4 -> DS4 [label="Store\nDaily Stats"];
    P5 -> DS5 [label="Store\nMonthly Stats"];

    // ─── DATA STORE → PROCESS FLOWS ───
    edge [color="#6B7280", fontcolor="#374151", style=dashed];

    DS1 -> P2 [label="profileID"];
    DS1 -> P3 [label="profileID"];
    DS2 -> P3 [label="deviceID"];
    DS3 -> P4 [label="Sleep\nEvents"];
    DS3 -> P5 [label="Sleep\nEvents"];
    DS4 -> P6 [label="Daily\nStats"];
    DS5 -> P6 [label="Monthly\nStats"];
    DS4 -> P9 [label="Daily\nStats"];
    DS5 -> P9 [label="Monthly\nStats"];
    DS6 -> P7 [label="Recommendation\nTemplates"];

    // ─── INTER-PROCESS FLOWS ───
    edge [color="#7C3AED", fontcolor="#5B21B6", style=solid];

    P6 -> P7 [label="Severity\nLevel"];
    P6 -> P8 [label="Severity\nLevel"];
    P7 -> P8 [label="Recommendations\n& Action Items"];
    P9 -> P7 [label="Trend\nDirection"];
    P9 -> P8 [label="Trend\nData"];
    P4 -> P8 [label="Chart\nData"];
    P1 -> P8 [label="User\nName"];

    // ─── PROCESS → USER FLOWS ───
    edge [color="#059669", fontcolor="#065F46", style=solid];

    P8 -> USER [label="Dashboard:\nCharts, Stats,\nRecommendations"];

    // ─── PROCESS → PILLOW FLOWS ───
    edge [color="#DC2626", fontcolor="#991B1B"];

    P2 -> PILLOW [label="Connection\nACK"];
    P3 -> PILLOW [label="Intervention\nCommand"];
}
```

---

## 4.5.3 Flowchart

### Diagram (Mermaid)

```mermaid
flowchart TD
    START(["🟢 START: App Launch"]) --> SPLASH["Display Splash / Loading Screen"]
    SPLASH --> LOADED{"Loading\nComplete?"}
    LOADED -- No --> SPLASH
    LOADED -- Yes --> NAMEINPUT["Display Name Input Screen"]
    NAMEINPUT --> SUBMIT{"User Submits\nName?"}
    SUBMIT -- No --> NAMEINPUT
    SUBMIT -- Yes --> STORE_PROFILE["Store User Profile\n(userName, createdAt)"]
    STORE_PROFILE --> INIT_BLE["Initialize BLE Service\n& Connect to Smart Pillow"]
    INIT_BLE --> BLE_OK{"BLE Connection\nSuccessful?"}
    BLE_OK -- No --> RETRY{"Retry\nConnection?"}
    RETRY -- Yes --> INIT_BLE
    RETRY -- No --> MOCK["Use Mock/Cached\nSleep Data"]
    BLE_OK -- Yes --> FETCH["Fetch Sleep Events\nfrom Smart Pillow"]
    MOCK --> PROCESS
    FETCH --> PROCESS["Process Raw Sleep Events"]

    PROCESS --> CALC_DAILY["Calculate Daily Statistics\n(totalEvents, avgDuration,\ninterventionCount, peakHour)"]
    CALC_DAILY --> CALC_MONTHLY["Calculate Monthly Statistics\n(totalEvents, avgDuration,\ninterventionCount)"]
    CALC_MONTHLY --> CALC_SEVERITY{"Classify Severity"}

    CALC_SEVERITY --> |"≤3 events &\navg ≤30s"| NORMAL["Severity: NORMAL 🟢"]
    CALC_SEVERITY --> |"≤10 events &\navg ≤60s"| BAD["Severity: BAD 🟡"]
    CALC_SEVERITY --> |">10 events or\navg >60s"| DANGER["Severity: DANGER 🔴"]

    NORMAL --> CALC_TREND
    BAD --> CALC_TREND
    DANGER --> CALC_TREND

    CALC_TREND["Calculate Month-over-Month Trend"]
    CALC_TREND --> TREND_CHECK{"Trend Direction?"}
    TREND_CHECK --> |"Decrease > 10%"| IMPROVING["Trend: IMPROVING ⬇️"]
    TREND_CHECK --> |"Change ≤ 10%"| STABLE["Trend: STABLE ➡️"]
    TREND_CHECK --> |"Increase > 10%"| WORSENING["Trend: WORSENING ⬆️"]

    IMPROVING --> GEN_REC
    STABLE --> GEN_REC
    WORSENING --> GEN_REC

    GEN_REC["Generate Recommendations\nbased on Severity + Trend"]
    GEN_REC --> RENDER["Render Dashboard\n(Stats Cards, Charts,\nSeverity Badge, Tabs)"]

    RENDER --> USER_ACTION{"User Interaction?"}
    USER_ACTION --> |"Change Time Filter\n(Today/Week/Month/Range)"| RECALC["Recalculate Stats\nfor Selected Period"]
    USER_ACTION --> |"Change Severity\nSimulation"| RESIM["Override Severity\n& Recalculate"]
    USER_ACTION --> |"Switch Tab\n(Analytics ↔ Recommendations)"| TOGGLE_TAB["Toggle Tab View"]
    USER_ACTION --> |"Pull to Refresh"| FETCH
    USER_ACTION --> |"Set Custom\nDate Range"| RANGE_CALC["Calculate Range Statistics"]

    RECALC --> RENDER
    RESIM --> GEN_REC
    TOGGLE_TAB --> RENDER
    RANGE_CALC --> RENDER

    USER_ACTION --> |"Close App"| END(["🔴 END"])

    style START fill:#10b981,stroke:#065F46,color:#ffffff
    style END fill:#ef4444,stroke:#991B1B,color:#ffffff
```

### Discussion and Explanation

The **Flowchart** illustrates the complete operational flow of the HAGOKILLER application from the moment a user launches it to the moment they close it. It captures every decision point, processing step, and user interaction loop.

#### Phase 1: Application Initialization (Startup Sequence)

1. **App Launch → Splash Screen**: When the user opens the HAGOKILLER app, `SplashScreen.preventAutoHideAsync()` is called to hold the native splash screen, followed immediately by the custom `LoadingScreen` component rendering an animated loading state with the HAGOKILLER branding.

2. **Loading Complete Check**: The loading screen runs a timed animation (approximately 3 seconds). Once complete, the `onLoadingComplete` callback transitions the app state from `'loading'` to `'name-input'`.

3. **Name Input**: The `NameInputScreen` renders a text input field prompting the user to enter their name. The user must type at least one character and press the continue button. This establishes the user profile for personalized greetings.

4. **Profile Storage**: Upon submission, the user's name is stored in the component state (and would be persisted to `tbluserprofile` in a production deployment). The app state transitions to `'dashboard'`.

#### Phase 2: Data Acquisition (BLE + Event Fetching)

5. **BLE Service Initialization**: The `MockBLEService` class is instantiated. In production, this would scan for nearby ESP32 BLE devices, establish a GATT connection, and subscribe to snoring event characteristic notifications.

6. **Connection Decision Point**: If the BLE connection succeeds, the app proceeds to fetch sleep events. If it fails, the user is given the option to retry or fall back to cached/mock data for demonstration purposes.

7. **Fetch Sleep Events**: The `fetchSleepEvents()` method retrieves the complete event history (up to 90 days of simulated data in the mock implementation). Each event contains: `id`, `timestamp`, `duration`, `severity`, `interventionTriggered`, and `interventionDuration`.

#### Phase 3: Data Processing Pipeline

8. **Daily Statistics Calculation**: For each calendar day, the `calculateDailyStats()` function filters events by date and computes: total snore event count, average snore duration, intervention activation count, and peak snoring hour (the hour with the highest event frequency).

9. **Monthly Statistics Calculation**: `calculateMonthlyStats()` aggregates events within a calendar month to produce monthly totals for event counts, average durations, and intervention counts.

10. **Severity Classification**: The threshold-based classifier evaluates the daily event count and average duration:
    - **Normal** (🟢): ≤ 3 events AND average duration ≤ 30 seconds — the user's snoring is within healthy limits.
    - **Bad** (🟡): ≤ 10 events AND average duration ≤ 60 seconds — elevated snoring requiring lifestyle adjustments.
    - **Danger** (🔴): > 10 events OR average duration > 60 seconds — critical snoring levels requiring medical evaluation.

11. **Trend Calculation**: `calculateTrend()` compares the two most recent monthly statistics to determine the direction of change. A decrease greater than 10% indicates "Improving"; an increase greater than 10% indicates "Worsening"; otherwise the pattern is "Stable".

12. **Recommendation Generation**: Based on the severity level and trend direction, `getRecommendations()` produces a structured advice object with a recommendation summary, an ordered list of actionable health items, and a trend-specific motivational or warning message.

#### Phase 4: Dashboard Rendering & User Interaction Loop

13. **Dashboard Rendering**: The `DashboardScreen` assembles all processed data into the mobile UI:
    - Header with greeting and severity badge
    - Severity simulation dropdown (for demo/testing)
    - Time period filter bar (Today, Week, Month, Range)
    - Tab bar (Analytics | Recommendations)
    - Stats cards grid (4 key metrics)
    - Snore pattern chart (line graph)
    - Monthly trend comparison rows
    - Footer with sync status and medical disclaimer

14. **User Interaction Loop**: The dashboard is fully interactive. Users can:
    - **Change Time Filter**: Selecting a different period (Today, Week, Month, Custom Range) recalculates statistics for that window and updates the chart.
    - **Simulate Severity**: The dropdown allows testing different severity scenarios, overriding the computed severity for demonstration.
    - **Switch Tabs**: Toggling between Analytics and Recommendations views.
    - **Pull-to-Refresh**: Re-fetches sleep events from the BLE service and reprocesses all data.
    - **Set Custom Date Range**: Specifies a from/to date for targeted analysis.
    - **Close App**: Terminates the session.

---

### Graphviz DOT Code — Flowchart

```dot
digraph HAGOKILLER_Flowchart {
    graph [pad="0.5", nodesep="0.4", ranksep="0.6", bgcolor="#ffffff",
           splines=ortho, fontname="Helvetica"];
    node [fontname="Helvetica", fontsize=10, style=filled];
    edge [fontname="Helvetica", fontsize=8, color="#4B5563", arrowsize=0.7];

    // ─── TERMINATORS ─── (Rounded rectangles)
    node [shape=oval, fillcolor="#10b981", color="#065F46", fontcolor="#ffffff",
          penwidth=2, width=1.8];
    START [label="START:\nApp Launch"];

    node [fillcolor="#ef4444", color="#991B1B"];
    END [label="END:\nClose App"];

    // ─── PROCESS BOXES ─── (Rectangles)
    node [shape=box, fillcolor="#EDE9FE", color="#7C3AED", fontcolor="#1E293B",
          penwidth=1.5, width=2.2, height=0.5];

    SPLASH    [label="Display Splash /\nLoading Screen"];
    NAMEINPUT [label="Display Name\nInput Screen"];
    STORE     [label="Store User Profile\n(userName, createdAt)"];
    INIT_BLE  [label="Initialize BLE Service\n& Connect to Pillow"];
    MOCK      [label="Use Mock / Cached\nSleep Data"];
    FETCH     [label="Fetch Sleep Events\nfrom Smart Pillow"];
    PROCESS   [label="Process Raw\nSleep Events"];
    CALC_D    [label="Calculate Daily Statistics\n(events, avgDur, interventions, peakHr)"];
    CALC_M    [label="Calculate Monthly\nStatistics"];
    CALC_T    [label="Calculate Month-over-\nMonth Trend"];
    GEN_REC   [label="Generate Recommendations\n(Severity + Trend)"];
    RENDER    [label="Render Dashboard\n(Cards, Charts, Tabs)"];
    RECALC    [label="Recalculate Stats\nfor Period"];
    RESIM     [label="Override Severity\n& Recalculate"];
    TOGGLE    [label="Toggle Tab View"];
    RANGE     [label="Calculate Range\nStatistics"];

    // ─── SEVERITY OUTPUTS ───
    node [shape=box, width=1.6, height=0.45];
    NORMAL [label="NORMAL\n(<=3 events, avg <=30s)", fillcolor="#D1FAE5", color="#059669"];
    BAD    [label="BAD\n(<=10 events, avg <=60s)", fillcolor="#FEF3C7", color="#D97706"];
    DANGER [label="DANGER\n(>10 events or avg >60s)", fillcolor="#FEE2E2", color="#DC2626"];

    // ─── TREND OUTPUTS ───
    IMPROVING [label="IMPROVING\n(Decrease >10%)", fillcolor="#D1FAE5", color="#059669"];
    STABLE    [label="STABLE\n(Change <=10%)", fillcolor="#FEF3C7", color="#D97706"];
    WORSENING [label="WORSENING\n(Increase >10%)", fillcolor="#FEE2E2", color="#DC2626"];

    // ─── DECISION DIAMONDS ───
    node [shape=diamond, fillcolor="#DBEAFE", color="#1D4ED8", fontcolor="#1E293B",
          penwidth=2, width=1.6, height=1.0];

    D_LOADED   [label="Loading\nComplete?"];
    D_SUBMIT   [label="Name\nSubmitted?"];
    D_BLE      [label="BLE\nConnected?"];
    D_RETRY    [label="Retry?"];
    D_SEVERITY [label="Classify\nSeverity"];
    D_TREND    [label="Trend\nDirection?"];
    D_ACTION   [label="User\nInteraction?"];

    // ─── FLOW ───
    START -> SPLASH;
    SPLASH -> D_LOADED;
    D_LOADED -> SPLASH [label="No"];
    D_LOADED -> NAMEINPUT [label="Yes"];
    NAMEINPUT -> D_SUBMIT;
    D_SUBMIT -> NAMEINPUT [label="No"];
    D_SUBMIT -> STORE [label="Yes"];
    STORE -> INIT_BLE;
    INIT_BLE -> D_BLE;
    D_BLE -> FETCH [label="Yes"];
    D_BLE -> D_RETRY [label="No"];
    D_RETRY -> INIT_BLE [label="Yes"];
    D_RETRY -> MOCK [label="No"];
    MOCK -> PROCESS;
    FETCH -> PROCESS;
    PROCESS -> CALC_D;
    CALC_D -> CALC_M;
    CALC_M -> D_SEVERITY;

    D_SEVERITY -> NORMAL [label="<=3 & <=30s"];
    D_SEVERITY -> BAD [label="<=10 & <=60s"];
    D_SEVERITY -> DANGER [label=">10 or >60s"];

    NORMAL -> CALC_T;
    BAD -> CALC_T;
    DANGER -> CALC_T;

    CALC_T -> D_TREND;
    D_TREND -> IMPROVING [label="Decrease >10%"];
    D_TREND -> STABLE [label="Change <=10%"];
    D_TREND -> WORSENING [label="Increase >10%"];

    IMPROVING -> GEN_REC;
    STABLE -> GEN_REC;
    WORSENING -> GEN_REC;

    GEN_REC -> RENDER;
    RENDER -> D_ACTION;

    D_ACTION -> RECALC [label="Change\nFilter"];
    D_ACTION -> RESIM [label="Simulate\nSeverity"];
    D_ACTION -> TOGGLE [label="Switch\nTab"];
    D_ACTION -> FETCH [label="Refresh"];
    D_ACTION -> RANGE [label="Date\nRange"];
    D_ACTION -> END [label="Close"];

    RECALC -> RENDER;
    RESIM -> GEN_REC;
    TOGGLE -> RENDER;
    RANGE -> RENDER;
}
```

---

## 4.5.4 Use Case Diagram

### Diagram (Mermaid)

```mermaid
graph LR
    subgraph HAGOKILLER System
        UC1["Login\n(Enter Name)"]
        UC2["Create / Update\nUser Profile"]
        UC3["Set Sleep Goal"]
        UC4["Connect to\nSmart Pillow"]
        UC5["Scan for\nBLE Devices"]
        UC6["View Dashboard\nAnalytics"]
        UC7["View Snoring\nEvent Statistics"]
        UC8["View Snore\nPattern Charts"]
        UC9["Filter by\nTime Period"]
        UC10["Set Custom\nDate Range"]
        UC11["View Severity\nClassification"]
        UC12["Simulate\nSeverity Level"]
        UC13["View Health\nRecommendations"]
        UC14["View Monthly\nTrend Analysis"]
        UC15["Pull to\nRefresh Data"]
        UC16["Detect\nSnoring Event"]
        UC17["Classify Snore\nSeverity (AI)"]
        UC18["Trigger Pillow\nIntervention"]
        UC19["Transmit\nSensor Data"]
        UC20["Aggregate Daily\nStatistics"]
        UC21["Aggregate Monthly\nStatistics"]
        UC22["Calculate\nTrend"]
        UC23["Generate\nRecommendations"]
    end

    USER["👤 User / Patient"]
    PILLOW["🛏️ IoT Smart Pillow"]

    %% User Use Cases
    USER --- UC1
    USER --- UC2
    USER --- UC3
    USER --- UC6
    USER --- UC7
    USER --- UC8
    USER --- UC9
    USER --- UC10
    USER --- UC11
    USER --- UC12
    USER --- UC13
    USER --- UC14
    USER --- UC15

    %% Pillow Use Cases
    PILLOW --- UC16
    PILLOW --- UC17
    PILLOW --- UC18
    PILLOW --- UC19

    %% Include relationships
    UC6 -.->|"<<include>>"| UC7
    UC6 -.->|"<<include>>"| UC8
    UC6 -.->|"<<include>>"| UC11
    UC6 -.->|"<<include>>"| UC14
    UC9 -.->|"<<include>>"| UC20
    UC9 -.->|"<<include>>"| UC21

    %% Extend relationships
    UC4 -.->|"<<extend>>"| UC5
    UC12 -.->|"<<extend>>"| UC6
    UC10 -.->|"<<extend>>"| UC9
    UC15 -.->|"<<extend>>"| UC19

    %% System internal
    UC16 -.->|"<<include>>"| UC17
    UC17 -.->|"<<extend>>"| UC18
    UC20 -.->|"<<include>>"| UC22
    UC21 -.->|"<<include>>"| UC22
    UC22 -.->|"<<include>>"| UC23
```

### Discussion and Explanation

The **Use Case Diagram** identifies all the functional capabilities of the HAGOKILLER system from the perspective of its two primary actors, and defines the relationships between use cases using UML stereotypes (`<<include>>` and `<<extend>>`).

#### Actors

1. **User / Patient (👤)**
   - The human end-user who interacts with the HAGOKILLER mobile application. This actor represents anyone using the smart pillow system to monitor their snoring patterns and receive health insights. The user's primary goals are to track their sleep quality, understand their snoring severity, and receive actionable health recommendations.

2. **IoT Smart Pillow (🛏️)**
   - The hardware actor — the ESP32-based smart pillow with embedded INMP441 microphones and an Edge AI classifier. This actor autonomously detects snoring events, classifies their severity, and transmits sensor data to the mobile application via Bluetooth Low Energy. It also physically intervenes by inflating an internal air mechanism when critical snoring is detected.

#### Use Cases — User Actor

| # | Use Case | Description |
|:--|:---------|:------------|
| UC1 | **Login (Enter Name)** | The user enters their name on the NameInputScreen to create a session identity. This is the first interaction upon app launch and personalizes the dashboard greeting. |
| UC2 | **Create / Update User Profile** | The user establishes their profile with demographics (name, age) and preferences. Profile data is persisted in `tbluserprofile` for session continuity. |
| UC3 | **Set Sleep Goal** | The user configures their target sleep duration (e.g., 8 hours/night). This value is used to calculate sleep quality scores and generate contextual recommendations. |
| UC6 | **View Dashboard Analytics** | The primary use case. The user views the complete analytics dashboard including stats cards, pattern charts, severity badges, and trend reports. This **includes** UC7, UC8, UC11, and UC14 as mandatory sub-use-cases. |
| UC7 | **View Snoring Event Statistics** | The user views the four key metric cards: total snoring events, average duration (seconds), intervention count, and peak snoring hour. |
| UC8 | **View Snore Pattern Charts** | The user views the line chart visualization showing snoring event distribution across the selected time period (7-day or 30-day patterns). |
| UC9 | **Filter by Time Period** | The user selects a time window (Today, Week, Month, Custom Range) to scope the displayed analytics. This **includes** UC20 and UC21 since changing the filter triggers statistical recalculation. |
| UC10 | **Set Custom Date Range** | The user specifies explicit from/to dates for targeted analysis. This **extends** UC9 as an optional, more granular alternative to preset filters. |
| UC11 | **View Severity Classification** | The user views their computed severity level (Normal 🟢, Bad 🟡, or Danger 🔴) displayed as a color-coded badge in the header and throughout the dashboard. |
| UC12 | **Simulate Severity Level** | The user manually selects a severity level from the dropdown simulator to preview how the dashboard and recommendations change under different conditions. This **extends** UC6 as an optional testing/demo feature. |
| UC13 | **View Health Recommendations** | The user switches to the Recommendations tab to view severity-specific health advice, actionable items (e.g., "Schedule appointment with sleep specialist"), and trend-based motivational messages. |
| UC14 | **View Monthly Trend Analysis** | The user views the monthly comparison section showing event counts per month, severity badges, directional arrows (↑↓), and the overall trend label (Improving/Stable/Worsening). |
| UC15 | **Pull to Refresh Data** | The user pulls down on the scroll view to trigger a data refresh. This **extends** UC19 by requesting the smart pillow to retransmit the latest sensor data. |

#### Use Cases — IoT Smart Pillow Actor

| # | Use Case | Description |
|:--|:---------|:------------|
| UC4 | **Connect to Smart Pillow** | Establishes a BLE connection between the mobile app and the ESP32 hardware. **Extended by** UC5 (Scan for BLE Devices) which optionally scans for available nearby devices before connecting. |
| UC5 | **Scan for BLE Devices** | Scans the Bluetooth environment for available ESP32 smart pillow devices. This is an optional step that extends UC4. |
| UC16 | **Detect Snoring Event** | The smart pillow's INMP441 microphone captures acoustic signals during sleep and identifies snoring episodes. This **includes** UC17 (Classify Snore Severity) as a mandatory follow-up step. |
| UC17 | **Classify Snore Severity (AI)** | The ESP32's Edge AI model classifies each detected snoring event into severity levels (low, medium, high) based on acoustic characteristics. This **extends** to UC18 (Trigger Pillow Intervention) when severity exceeds the threshold. |
| UC18 | **Trigger Pillow Intervention** | When snoring severity is classified as high, the smart pillow activates its air-inflation mechanism to gently reposition the user's head. This is a conditional extension of UC17. |
| UC19 | **Transmit Sensor Data** | The smart pillow transmits collected snoring event data (timestamps, durations, severity classifications, intervention flags) to the mobile app over the BLE connection. |

#### System-Internal Use Cases

| # | Use Case | Description |
|:--|:---------|:------------|
| UC20 | **Aggregate Daily Statistics** | The system processes raw sleep events to compute daily totals (event count, average duration, intervention count, peak hour). **Included by** UC9 when the user changes the time filter. |
| UC21 | **Aggregate Monthly Statistics** | The system compiles monthly aggregates from event data. **Included by** UC9 and **includes** UC22. |
| UC22 | **Calculate Trend** | Compares consecutive monthly statistics to determine the improvement/deterioration direction. **Included by** UC20 and UC21, and **includes** UC23. |
| UC23 | **Generate Recommendations** | Maps the computed severity level and trend direction to a catalog of health recommendations. **Included by** UC22. |

#### Use Case Relationships

- **`<<include>>`** (mandatory composition): UC6 always includes UC7, UC8, UC11, UC14 — viewing the dashboard inherently displays all analytics sub-components. UC16 always includes UC17 — detecting a snoring event always triggers AI classification.
- **`<<extend>>`** (optional extension): UC12 extends UC6 — severity simulation is an optional testing feature. UC10 extends UC9 — custom date ranges are an optional alternative to preset filters. UC17 extends to UC18 — intervention is only triggered when severity warrants it.

---

### Graphviz DOT Code — Use Case Diagram

```dot
digraph HAGOKILLER_UseCase {
    graph [pad="0.5", nodesep="0.4", ranksep="0.8", bgcolor="#ffffff",
           splines=true, fontname="Helvetica", rankdir=LR];
    node [fontname="Helvetica", fontsize=9];
    edge [fontname="Helvetica", fontsize=7, color="#4B5563"];

    // ─── ACTORS ───
    node [shape=box, style="filled,bold", penwidth=2];

    USER [label="User / Patient", fillcolor="#DBEAFE", color="#1D4ED8"];

    PILLOW [label="IoT Smart Pillow", fillcolor="#FEF9C3", color="#B45309"];

    // ─── SYSTEM BOUNDARY ───
    subgraph cluster_system {
        label=<<font point-size="14"><b>HAGOKILLER System</b></font>>;
        labelloc="t";
        style="dashed,rounded";
        color="#3b82f6";
        penwidth=2;
        bgcolor="#F8FAFC";

        // ─── USE CASES ─── (Ellipses)
        node [shape=ellipse, style="filled,bold", fillcolor="#DBEAFE", color="#1D4ED8",
              penwidth=1.5, fontsize=9, width=1.8, height=0.55];

        UC1  [label="Login\n(Enter Name)"];
        UC2  [label="Create / Update\nUser Profile"];
        UC3  [label="Set Sleep Goal"];
        UC4  [label="Connect to\nSmart Pillow"];
        UC5  [label="Scan for\nBLE Devices"];
        UC6  [label="View Dashboard\nAnalytics"];
        UC7  [label="View Snoring\nEvent Statistics"];
        UC8  [label="View Snore\nPattern Charts"];
        UC9  [label="Filter by\nTime Period"];
        UC10 [label="Set Custom\nDate Range"];
        UC11 [label="View Severity\nClassification"];
        UC12 [label="Simulate\nSeverity Level"];
        UC13 [label="View Health\nRecommendations"];
        UC14 [label="View Monthly\nTrend Analysis"];
        UC15 [label="Pull to\nRefresh Data"];

        node [fillcolor="#FEF9C3", color="#B45309"];
        UC16 [label="Detect\nSnoring Event"];
        UC17 [label="Classify Snore\nSeverity (AI)"];
        UC18 [label="Trigger Pillow\nIntervention"];
        UC19 [label="Transmit\nSensor Data"];

        node [fillcolor="#F3E8FF", color="#7C3AED"];
        UC20 [label="Aggregate Daily\nStatistics"];
        UC21 [label="Aggregate Monthly\nStatistics"];
        UC22 [label="Calculate\nTrend"];
        UC23 [label="Generate\nRecommendations"];
    }

    // ─── ACTOR → USE CASE ASSOCIATIONS ─── (Solid lines)
    edge [color="#1D4ED8", arrowhead=none, penwidth=1.5, style=solid];

    USER -> UC1;
    USER -> UC2;
    USER -> UC3;
    USER -> UC6;
    USER -> UC7;
    USER -> UC8;
    USER -> UC9;
    USER -> UC10;
    USER -> UC11;
    USER -> UC12;
    USER -> UC13;
    USER -> UC14;
    USER -> UC15;

    edge [color="#B45309"];
    PILLOW -> UC4;
    PILLOW -> UC16;
    PILLOW -> UC19;

    // ─── INCLUDE RELATIONSHIPS ─── (Dashed arrows)
    edge [style=dashed, color="#059669", fontcolor="#065F46", arrowhead=open, penwidth=1.0];

    UC6  -> UC7  [label="  <<include>>"];
    UC6  -> UC8  [label="  <<include>>"];
    UC6  -> UC11 [label="  <<include>>"];
    UC6  -> UC14 [label="  <<include>>"];
    UC9  -> UC20 [label="  <<include>>"];
    UC9  -> UC21 [label="  <<include>>"];
    UC16 -> UC17 [label="  <<include>>"];
    UC20 -> UC22 [label="  <<include>>"];
    UC21 -> UC22 [label="  <<include>>"];
    UC22 -> UC23 [label="  <<include>>"];

    // ─── EXTEND RELATIONSHIPS ─── (Dashed arrows, different color)
    edge [style=dashed, color="#DC2626", fontcolor="#991B1B", arrowhead=open];

    UC5  -> UC4  [label="  <<extend>>"];
    UC12 -> UC6  [label="  <<extend>>"];
    UC10 -> UC9  [label="  <<extend>>"];
    UC15 -> UC19 [label="  <<extend>>"];
    UC17 -> UC18 [label="  <<extend>>"];
}
```

---

## Summary of Diagrams

| Diagram | Purpose | Section |
|:--------|:--------|:--------|
| **Context Diagram** | Identifies external entities (User, Smart Pillow) and all data flows crossing the system boundary | 4.5.1 |
| **Data Flow Diagram** | Decomposes the system into 9 internal processes, 6 data stores, and traces data movement through the processing pipeline | 4.5.2 |
| **Flowchart** | Maps the complete operational flow from app launch through data processing to the interactive dashboard loop | 4.5.3 |
| **Use Case Diagram** | Catalogs 23 functional use cases across 2 actors with `<<include>>` and `<<extend>>` relationships | 4.5.4 |

---

> **Rendering Instructions**: 
> - **Mermaid diagrams** render natively in GitHub, GitLab, VS Code (with Mermaid extension), and most modern markdown viewers.
> - **Graphviz DOT code** can be pasted into [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/) or rendered locally using `dot -Tpng input.dot -o output.png`.

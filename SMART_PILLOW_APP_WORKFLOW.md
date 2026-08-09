# Smart Pillow App Workflow

This document explains the step-by-step workflow of how the HAGOKILLER mobile app interacts with the smart pillow system.

## 1. App Launch

- The user opens the app.
- The loading screen appears while the app initializes.
- The system prepares the user interface and checks for available device connections.

## 2. User Profile Setup

- The app prompts the user to enter their name.
- The user may optionally add birthdate and sleep goal information.
- This profile is saved so the app can personalize sleep data and recommendations.

## 3. Device Pairing

- The user enters the 7-digit pairing PIN shown on the smart pillow.
- The app validates the PIN format.
- If the PIN is correct, the app connects to the smart pillow through BLE.

## 4. Connection Established

- Once paired, the smart pillow and mobile app establish a secure connection.
- The app confirms that the device is ready for monitoring.
- The user can now begin using the system.

## 5. Monitoring Sleep Activity

- The smart pillow continuously listens for snoring sounds using its microphone.
- The device analyzes the sound to detect possible snoring events.
- If snoring is detected, the pillow may trigger an intervention.

## 6. Intervention Trigger

- When snoring is detected repeatedly, the pillow activates its intervention system.
- The air pump inflates the air bladder to gently raise the head position.
- This helps reduce airway blockage and improve breathing.

## 7. Data Logging

- Every detected snoring event is recorded.
- The system stores details such as time, duration, severity, and whether intervention was used.
- This data is saved locally and can be synced with the app.

## 8. App Data Sync and Display

- The mobile app receives sleep event data from the smart pillow.
- The data is displayed on the dashboard in easy-to-read charts and cards.
- Users can see snoring frequency, intervention count, and sleep trends.

## 9. Review and Insights

- The app shows daily and monthly sleep summaries.
- Users can view detailed logs and understand their sleep patterns.
- The system may provide recommendations based on the detected severity.

## 10. Ongoing Monitoring

- The smart pillow continues monitoring while the app stays connected.
- The user can check updates anytime from the app.
- The system keeps working in the background to support better sleep.

## Summary

The smart pillow app works as a closed-loop system:

1. It connects to the pillow.
2. It monitors snoring events.
3. It triggers intervention when needed.
4. It logs and displays sleep data.
5. It helps the user track and improve their sleep experience.

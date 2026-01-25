# Firebase Setup Guide

This guide explains how to set up the Firebase environment for local development using the Firebase Local Emulator Suite. This allows you to develop and test the application without connecting to the live production database.

## Prerequisites

1.  **Firebase CLI**: Install the Firebase CLI globally.
    ```bash
    npm install -g firebase-tools
    ```

2.  **Java**: The emulators require Java (JDK 11 or higher).
    *   **Download**: We recommend [Eclipse Temurin (OpenJDK)](https://adoptium.net/).
    *   **Verify**: Run `java -version` in your terminal to ensure it's installed and accessible.

## 1. Setting up Environment Variables

To tell the app to connect to the local emulators instead of the real Firebase services, you need to update your `.env` file in the `app/` directory.

Add or update the following line in `app/.env`:

```env
EXPO_PUBLIC_USE_EMULATORS=true
```

## 2. Starting the Emulators

The emulators are configured in the `cloud-functions` directory.

1.  Open a terminal.
2.  Navigate to the `cloud-functions` directory:
    ```bash
    cd cloud-functions
    ```
3.  Start the emulators:
    ```bash
    npm run serve
    ```

You should see output indicating that ALL emulators are running:
*   **Authentication**: 9099
*   **Functions**: 5001
*   **Firestore**: 8080
*   **Database**: 9000
*   **Storage**: 9199

## 3. Running the App

Now, whenever you run the Expo app (`npx expo start`), it will connect to these local emulators.

*   **Android Emulator**: Connects via `10.0.2.2`.
*   **iOS Simulator**: Connects via `localhost`.
*   **Web**: Connects via `localhost`.

## 4. Troubleshooting

*   **"Network Error"**: Ensure the emulators are running and that no other process is using the emulator ports.
*   **Data Persistence**: Emulator data is wiped when you stop the emulators. To export/import data, check the Firebase Emulator docs.

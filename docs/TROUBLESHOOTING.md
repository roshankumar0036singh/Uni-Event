# Troubleshooting Guide

This guide contains diagnostic workflows, verification steps, and solutions for common issues encountered during the development, deployment, or run-time phases of the UniEvent platform. Use this document as your primary reference when debugging client-side crashes, push notification failures, database security rules, or serverless function latency.

## Table of Contents

- [1. App Crashes on Startup](#1-app-crashes-on-startup)
  - [Symptoms](#symptoms)
  - [Root Causes](#root-causes)
  - [Resolution Steps](#resolution-steps)
- [2. Cannot Receive Push Notifications](#2-cannot-receive-push-notifications)
  - [Symptoms](#symptoms-1)
  - [Root Causes](#root-causes-1)
  - [Resolution Steps](#resolution-steps-1)
- [3. Firestore Permission Denied (403/Forbidden)](#3-firestore-permission-denied-403forbidden)
  - [Symptoms](#symptoms-2)
  - [Root Causes](#root-causes-2)
  - [Resolution Steps](#resolution-steps-2)
- [4. Cloud Functions Running Very Slow (Latency & Timeout Issues)](#4-cloud-functions-running-very-slow-latency--timeout-issues)
  - [Symptoms](#symptoms-3)
  - [Root Causes](#root-causes-3)
  - [Resolution Steps](#resolution-steps-3)
- [5. General Diagnostics & Debug Commands Reference](#5-general-diagnostics--debug-commands-reference)

---

## 1. App Crashes on Startup

### Symptoms
- The client application (web, Android, or iOS) exits immediately upon launching, displays a blank white screen, or throws an unhandled exception before the login page renders.
- Bundler console output shows standard runtime failures such as `Uncaught Error: Firebase API key is missing`.

### Root Causes
1. **Invalid or Missing Firebase/Expo Environment Variables**: The client application initializes the Firebase SDK during the bootstrapping phase (`App.js`). If any configuration keys are undefined or malformed, the SDK initialization throws a critical runtime error.
2. **Stale Metro Bundler or Dependency Cache**: The Expo CLI/Metro packager has cached outdated files, environment variables, or conflicting package versions.
3. **Invalid Client Configuration in `app.json`**: App schemes, bundle identifiers, or plugins are misaligned.

### Resolution Steps

1. **Verify Your Environment Variables Configuration**
   - Ensure you have a `.env` file located in the [app](../app/) folder:
     ```bash
     # Verify if the environment configuration file exists
     ls -la app/.env
     ```
   - **Crucial Requirement**: For Expo SDK projects, all frontend environment variables *must* be prefixed with `EXPO_PUBLIC_` for the Metro bundler to expose them to client-side code at runtime.
     - Check your `app/.env` against [app/.env.example](../app/.env.example):
       ```env
       EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
       EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
       EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
       EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
       EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
       EXPO_PUBLIC_FIREBASE_APP_ID=1:your_sender_id:web:your_app_id
       EXPO_PUBLIC_USE_EMULATORS=true
       ```
   - Ensure there are no surrounding quotes (e.g. `EXPO_PUBLIC_FIREBASE_API_KEY="key"`) or trailing spaces in the `.env` values, as these will be parsed literally by the Firebase SDK and trigger verification failures.
   - For an in-depth guide on obtaining these credentials, refer to the [Environment Variables Setup Guide](./ENV_SETUP.md).

2. **Clear Metro Bundler Cache and Restart**
   - Clean the packager's cache to force it to reload the newly configured environment variables:
     ```bash
     cd app
     npx expo start --clear
     ```

3. **Perform a Deep Dependency Clean**
   - If cache clearing is insufficient, completely prune package installations and reinstall:
     ```bash
     # For Windows (PowerShell)
     cd app
     Remove-Item -Recurse -Force node_modules, package-lock.json
     npm cache clean --force
     npm install

     # For macOS/Linux
     cd app
     rm -rf node_modules package-lock.json
     npm cache clean --force
     npm install
     ```

4. **Synchronize Client Configuration**
   - Inspect [app/app.json](../app/app.json) to ensure the `bundleIdentifier` (iOS) and `package` (Android) match your registers on the Firebase Console exactly.

---

## 2. Cannot Receive Push Notifications

### Symptoms
- Users do not receive event notifications or manual reminders, despite the backend functions processing the request without errors.
- Client logs report failures when invoking `Notifications.getExpoPushTokenAsync()`.

### Root Causes
1. **Simulator/Emulator Network and Hardware Restrictions**: Standard iOS Simulators do *not* support remote push notifications unless running on specialized Xcode 14+ configurations with active APNs integration. Android emulators without Google Play Services fail to generate tokens.
2. **Missing Firebase Cloud Messaging (FCM) Configurations**: Missing credentials or server keys on Android builds.
3. **Invalid or Expired Apple Push Notification Service (APNs) Credentials**: Standalone iOS builds failing to establish trust with Apple's push gateways.
4. **Missing Client Permissions**: The client has not explicitly requested or been granted notifications permissions by the user.

### Resolution Steps

1. **Verify Token Generation on a Physical Device**
   - Run the application on a **physical mobile device** using **Expo Go** or a development build.
   - Check the console logs during startup to confirm the device generates a valid push token (formatted like `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`).
   - *Reference details regarding this system are located in the [Event Notification Architecture Guide](./notifications_architecture.md).*

2. **Configure Firebase Cloud Messaging (FCM) for Android**
   - Ensure you download `google-services.json` from the Firebase Console (Project Settings → General → Your Apps → Android App).
   - Place `google-services.json` directly under `app/google-services.json` and verify its reference in [app/app.json](../app/app.json):
     ```json
     "android": {
       "googleServicesFile": "./google-services.json",
       "package": "com.hack2skill.eventloop"
     }
     ```

3. **Configure Apple Push Notification Service (APNs) for iOS**
   - Standalone iOS builds require a trusted handshake. Go to the [Apple Developer Portal](https://developer.apple.com/) and generate an **APNs Auth Key (.p8 file)** or an **APNs Certificate**.
   - Go to your **Firebase Console** → **Project Settings** → **Cloud Messaging** → **Apple app share credentials** and upload the `.p8` key or certificate.
   - Use EAS CLI to sync push credentials:
     ```bash
     cd app
     eas credentials
     ```

4. **Isolate Gateway Performance with the Expo Push Tool**
   - Copy your generated push token from your device debug logs.
   - Open the official [Expo Push Notification Tool](https://expo.dev/notifications).
   - Paste the token, fill in a dummy title and body, and click **Send Notification**.
   - **Diagnosis**:
     - *If the notification arrives:* The device, OS permissions, and Expo Gateway are configured correctly. The issue lies within the Cloud Functions scheduler logic.
     - *If the notification fails:* Inspect OS permission settings or the push token itself.

5. **Examine Cloud Scheduler Logs**
   - Verify the scheduling cron jobs are running and identifying upcoming event participants:
     ```bash
     firebase functions:log --only checkUpcomingEvents
     ```

---

## 3. Firestore Permission Denied (403/Forbidden)

### Symptoms
- Frontend consoles throw: `[FirebaseError: Missing or insufficient permissions.]` or `Firestore (10.0.0): FirebaseError: [code=permission-denied]`.
- Specific pages or components fail to load records, or form submissions fail silently/expressively with authentication exceptions.

### Root Causes
1. **Strict or Incorrect Firestore Security Rules**: Rules configured in [firestore.rules](../firestore.rules) reject the client query parameters.
2. **Unauthenticated Sessions**: The rule checks for `request.auth != null`, but the client session is either uninitialized, expired, or pointing to a different emulator/project instance.
3. **Role-Based Access Control (RBAC) Mismatch**: The client is attempting an administrative action (e.g. creating/canceling events) but lacks `isAdmin: true` or `role: 'admin'` fields within their personal database document.

### Resolution Steps

1. **Inspect `firestore.rules` Against the Failed Operation**
   - Open [firestore.rules](../firestore.rules) and locate the collection matching the failed call:
     ```javascript
     // Example Rules Block
     match /events/{eventId} {
       allow read: if true;
       allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
     }
     ```
   - Verify that your query perfectly matches the conditions. For instance, querying `db.collection("events")` without being authenticated or without the `isAdmin` flag will raise a `permission-denied` error immediately.

2. **Verify User Authorization State on the Client**
   - Log the authentication state immediately prior to making the Firestore database query:
     ```javascript
     import { getAuth } from 'firebase/auth';
     
     const auth = getAuth();
     console.log("Active Auth UID:", auth.currentUser?.uid);
     ```
   - If the output prints `null` or `undefined`, the security rules requiring an active user session will reject the transaction. Execute standard login routines before database query invocations.

3. **Verify the Role Field via Emulator Suite UI**
   - If you are running the project in Emulator mode (`EXPO_PUBLIC_USE_EMULATORS=true`):
     1. Open your browser and navigate to the **Local Firestore Emulator UI** at `http://localhost:4000/firestore`.
     2. Locate the `/users` collection.
     3. Select the document corresponding to your logged-in `UID`.
     4. Confirm the document contains the required administrative flag: `isAdmin: true` or `role: "admin"`. If missing, add it manually in the emulator interface to test admin features.
   - Review [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for more details on local database manipulation.

4. **Verify Firestore Composite Indexes**
   - Complex queries with multiple filters (e.g., sorting events by date and filtering by category) can trigger false "permission denied" or missing index errors.
   - Review [firestore.indexes.json](../firestore.indexes.json) or run index deployment commands:
     ```bash
     firebase deploy --only firestore:indexes
     ```

---

## 4. Cloud Functions Running Very Slow (Latency & Timeout Issues)

### Symptoms
- Backend tasks (ticket booking, processing reminders, sending confirmation emails) take upwards of 5 to 10 seconds to respond.
- The functions occasionally fail with `Function execution took 60000 ms, finished with status: 'timeout'`.

### Root Causes
1. **Serverless "Cold Starts"**: Firebase scales down Cloud Functions instances to zero when inactive. The next execution must allocate hardware and initialize the Node.js container, creating a latency bottleneck.
2. **Oversized Execution Bundles**: Importing massive libraries globally within `index.ts` instead of lazy-loading them, or bundling unnecessary development files into the cloud package.
3. **Quota and Rate Limit Bottlenecks**: Exceeding the standard outbound network quotas, third-party email API limits (e.g. Resend or EmailJS), or standard CPU resources allocated to the container.
4. **Inefficient or Unoptimized Database Queries**: Missing database limits, pagination, or nesting queries inside a large loop (the `N+1` query problem).

### Resolution Steps

1. **Mitigate Cold Starts in Production**
   - Adjust instance resource limits and configure a minimum pool of active instances for high-frequency runtime endpoints. In your Cloud Function settings (`cloud-functions/src/`), define `minInstances` and target CPU memory configuration:
     ```typescript
     import { onRequest } from "firebase-functions/v2/https";

     export const checkUpcomingEvents = onRequest({
       minInstances: 1,      // Eliminates cold starts by keeping 1 instance always active
       memory: "512MiB",     // Default is 256MiB; scale up to 512MiB/1GiB if CPU intensive
       timeoutSeconds: 120   // Extend function timeout for long-running operations
     }, async (req, res) => {
       // Function handler code
     });
     ```

2. **Implement Lazy Loading inside Function Handlers**
   - Reduce initial execution startup delays by avoiding global, heavy module imports. Import large libraries (like `pdf-lib` or `expo-server-sdk`) only within the specific function scope where they are utilized:
     ```typescript
     // INefficient:
     // import { PDFDocument } from 'pdf-lib'; // Imported on EVERY function initialization

     // Efficient:
     export const generateTicketPDF = onRequest(async (req, res) => {
       const { PDFDocument } = await import('pdf-lib'); // Lazy-loaded dynamically
       const pdfDoc = await PDFDocument.create();
       // ...
     });
     ```

3. **Verify Third-Party APIs and Network Egress**
   - If using **Resend** or **EmailJS**, check their administrative dashboards to ensure you have not exhausted your daily/monthly API quota limits.
   - Check if your Firebase project is on the **Spark (Free)** plan. The Spark plan blocks outbound network requests to non-Google APIs, causing external REST endpoints (like Resend or EmailJS) to timeout or fail on production servers. You *must* upgrade to the pay-as-you-go **Blaze Plan** to allow outbound requests.

4. **Profile Performance Using Console Timers**
   - Inject duration trackers inside your local development routines to isolate code latency:
     ```typescript
     console.time("db_fetch_participants");
     const participants = await db.collection("events").doc(eventId).collection("participants").get();
     console.timeEnd("db_fetch_participants");
     ```

---

## 5. General Diagnostics & Debug Commands Reference

Use these terminal commands to quickly audit, diagnose, and repair your local development environment.

| Category | Diagnostic Goal | Platform | Command |
| :--- | :--- | :--- | :--- |
| **Port Conflict** | Find processes occupying emulator port `5001` (Functions) | **Windows** | `netstat -ano \| findstr :5001` |
| | | **macOS / Linux** | `lsof -i :5001` |
| **Port Conflict** | Kill a process blocking standard ports (e.g., PID `1234`) | **Windows** | `taskkill /F /PID 1234` |
| | | **macOS / Linux** | `kill -9 1234` |
| **Firebase CLI** | Clean local cache and re-authenticate your CLI account | **All OS** | `firebase logout && firebase login` |
| **Firebase CLI** | List all configured Firebase projects and active projects | **All OS** | `firebase projects:list` |
| **Firebase CLI** | Set the current active project context | **All OS** | `firebase use <project-id>` |
| **Emulators** | Start local emulators with specific data persistence | **All OS** | `firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data` |
| **Expo CLI** | Run development server with direct local IP binding | **All OS** | `npx expo start --lan` |
| **Expo CLI** | Fetch system diagnostics for environmental reporting | **All OS** | `npx expo-env-info` |

---

## Additional Official Documentation Resources

- [Firebase Local Emulator Suite Guide](https://firebase.google.com/docs/emulator-suite)
- [Firebase Firestore Security Rules Reference](https://firebase.google.com/docs/rules/rules-and-auth)
- [Expo Push Notifications System Overview](https://docs.expo.dev/push-notifications/overview/)
- [Firebase Cloud Functions Performance Optimization](https://firebase.google.com/docs/functions/manage-costs-and-performance)
- [Expo Environment Variables Reference Guide](https://docs.expo.dev/guides/environment-variables/)

---

*Need additional support? Contact project maintainers or open a detailed ticket on [UniEvent GitHub Issues](https://github.com/roshankumar0036singh/Uni-Event/issues).*

# Setup Guide - UniEvent

This guide will walk you through setting up the UniEvent platform for local development.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Firebase Configuration](#firebase-configuration)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **npm** (comes with Node.js) or **yarn**
   - Verify: `npm --version`

3. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase --version
   ```

4. **Java Development Kit (JDK 11+)**
   - Required for Firebase Emulators
   - Download: https://adoptium.net/
   - Verify: `java -version`

5. **Git**
   - Download: https://git-scm.com/
   - Verify: `git --version`

### Optional (for mobile development)

- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Expo Go** app on your mobile device

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/roshankumar0036singh/Uni-Event.git
cd Uni-Event
```

### 2. Install Dependencies

**Frontend (Expo App)**:
```bash
cd app
npm install
```

**Backend (Cloud Functions)**:
```bash
cd ../cloud-functions
npm install
```

---

## Firebase Configuration

### Option 1: Use Firebase Emulators (Recommended for Development)

The project is pre-configured to use Firebase Emulators for local development. No Firebase project setup required!

**What you get:**
- Local Authentication
- Local Firestore Database
- Local Cloud Functions
- Local Storage
- Local Realtime Database

**Data Persistence:**
Emulator data is automatically saved to `./emulator-data` when you stop the emulators.

### Option 2: Connect to a Real Firebase Project

If you want to use a production Firebase project:

1. **Create a Firebase Project**:
   - Go to https://console.firebase.google.com/
   - Click "Add Project"
   - Follow the setup wizard

2. **Enable Required Services**:
   - **Authentication**: Enable Email/Password and Google Sign-In
   - **Firestore Database**: Create in production mode
   - **Cloud Functions**: Enable billing (Blaze plan)
   - **Storage**: Enable default bucket
   - **Realtime Database**: Create database

3. **Get Firebase Config**:
   - Go to Project Settings → General
   - Scroll to "Your apps" → Web app
   - Copy the `firebaseConfig` object

4. **Update `.env`** (see next section)

---

## Environment Variables

### 1. Copy the Template

```bash
cd app
cp .env.example .env
```

### 2. Fill in the Values

Open `app/.env` and configure:

#### Firebase Configuration

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FCM_VAPID_KEY=your_vapid_key
```

#### Google OAuth (for Google Sign-In)

Get these from [Google Cloud Console](https://console.cloud.google.com/):

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id.apps.googleusercontent.com
```

**Important**: Add authorized redirect URIs in Google Cloud Console:
- `http://localhost:19006` (for web development)
- `https://auth.expo.io/@your-username/centralized-event-platform` (for Expo Go)

#### EmailJS (Optional - for email notifications)

Get from [EmailJS Dashboard](https://www.emailjs.com/):

```env
EXPO_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
EXPO_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
EXPO_PUBLIC_EMAILJS_TEMPLATE_UNIVERSAL=your_template_id
EXPO_PUBLIC_EMAILJS_TEMPLATE_FEEDBACK=your_feedback_template_id
```

#### Development Settings

```env
# Set to 'true' to use Firebase Emulators
EXPO_PUBLIC_USE_EMULATORS=true
```

### 3. Cloud Functions Environment

Create `cloud-functions/.env`:

```env
RESEND_API_KEY=your_resend_api_key
EMAIL_SENDER=noreply@yourdomain.com
ADMIN_UID=your_admin_user_id
```

---

## Running the Application

### Start Firebase Emulators

```bash
cd cloud-functions
npm run serve
```

**Expected Output:**
```
✔  functions: Emulator started at http://localhost:5001
✔  firestore: Emulator started at http://localhost:8080
✔  auth: Emulator started at http://localhost:9099
✔  storage: Emulator started at http://localhost:9199
✔  database: Emulator started at http://localhost:9000
✔  ui: Emulator UI started at http://localhost:4000
```

**Emulator UI**: Visit http://localhost:4000 to view/manage emulator data

### Start the Frontend

**In a new terminal**:

```bash
cd app
npm start
```

**Run on Different Platforms:**
- Press `w` - Open in web browser
- Press `a` - Open on Android (requires Android Studio/device)
- Press `i` - Open on iOS Simulator (macOS only)
- Scan QR code with Expo Go app (on physical device)

---

## Testing

### Run Unit Tests

```bash
cd app
npm test
```

### Run Linter

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run format
```

### Build Cloud Functions

```bash
cd cloud-functions
npm run build
```

---

## Troubleshooting

### Issue: "Firebase Emulators not starting"

**Solution**:
1. Ensure Java 11+ is installed: `java -version`
2. Check if ports are already in use:
   ```bash
   # Windows
   netstat -ano | findstr :5001
   
   # macOS/Linux
   lsof -i :5001
   ```
3. Kill conflicting processes or change ports in `firebase.json`

### Issue: "Module not found" errors

**Solution**:
```bash
# Clear cache and reinstall
cd app
rm -rf node_modules package-lock.json
npm install

cd ../cloud-functions
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Google Sign-In fails with redirect_uri_mismatch"

**Solution**:
1. Check that `http://localhost:19006` is added to Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs
2. Ensure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` matches the Web Client ID from Google Cloud Console

### Issue: "Emulator data is lost on restart"

**Solution**:
The emulators are configured to auto-export data to `./emulator-data` on exit. Ensure you stop the emulator with `Ctrl+C` (not force-kill) to trigger the export.

### Issue: "Cannot connect to emulators from mobile device"

**Solution**:
1. Ensure your device is on the same network as your development machine
2. Update `firebaseConfig.js` to use your machine's local IP instead of `localhost`:
   ```javascript
   const EMULATOR_HOST = Platform.OS === 'android' ? '192.168.x.x' : 'localhost';
   ```

### Issue: "Warning banner 'Running in emulator mode' won't go away"

**Solution**:
This is a known Firebase SDK behavior. The warning is suppressed in the code but may still appear. It's safe to ignore during development.

---

## Next Steps

- **Create your first event**: Sign up as a user, then promote yourself to admin via Firestore Emulator UI
- **Explore the codebase**: Check out `app/src/screens/` for UI components
- **Read the docs**: See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for emulator details
- **Join the community**: Check [CONTRIBUTING.md](../CONTRIBUTING.md) to start contributing

---

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Need help?** Open an issue on [GitHub](https://github.com/roshankumar0036singh/Uni-Event/issues)

# Firebase Authentication Setup for Local Development

## Problem

The backend server needs credentials to access Firebase services (Firestore, Auth, etc.) when running locally.

## Solutions

### **Option 1: Use Live Firebase (Simplest)**

Download a service account key from Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **eventloop-c3310**
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the JSON file as `serviceAccountKey.json` in `cloud-functions/` folder
7. Update `server.ts` line 19 to uncomment:
    ```typescript
    credential: admin.credential.cert(require('./serviceAccountKey.json'));
    ```
8. Rebuild: `npm run build`
9. Restart: `npm start`

**⚠️ Important:** Add `serviceAccountKey.json` to `.gitignore`!

---

### **Option 2: Use Emulator (No Credentials Needed)**

Requires Java to be installed.

1. Install Java if not installed
2. Run: `npm run serve` (uses Firebase emulators)
3. Your frontend should connect to `http://localhost:5001` instead of `http://localhost:3000`

---

### **Option 3: Application Default Credentials**

If you have Google Cloud SDK installed:

```bash
gcloud auth application-default login
```

Then restart the server.

---

## Current Setup

The server is configured to:

- Use Firestore emulator on `localhost:8080` for local development
- Use live Firebase in production

Since the emulator needs Java, **Option 1** (service account key) is recommended for quick setup.

# Environment Variables Setup Guide
 
This guide walks you through obtaining every API key and credential required to run UniEvent locally. All values go into your `app/.env` file.
 
If you haven't created your `.env` file yet, run:
 
```bash
cp app/.env.example app/.env
```
 
Then follow the steps below for each group of variables.
 
---
 
## Table of Contents
 
- [Firebase Configuration](#1-firebase-configuration)
- [Google OAuth Client IDs](#2-google-oauth-client-ids)
- [EmailJS (Optional)](#3-emailjs-optional)
- [Final .env Reference](#final-env-reference)
---
 
## 1. Firebase Configuration
 
These variables connect the app to your Firebase project for authentication, database, storage, and cloud functions.
 
**Variables:**
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```
 
**Steps:**
 
1. Go to [Firebase Console](https://console.firebase.google.com) and sign in with your Google account.
2. Click **"Add project"** and follow the setup steps (you can disable Google Analytics if not needed).
3. Once inside your project, click the **gear icon** (top-left, next to "Project Overview") and select **Project Settings**.
4. Scroll down to the **"Your apps"** section and click the **Web icon (`</>`)** to register a new web app.
5. Give your app a nickname (e.g., `uni-event-dev`) and click **Register app**.
6. You'll see a `firebaseConfig` object like this:
```js
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:XXXXXXXXXXXXXXXX"
};
```
 
7. Copy each value into your `.env` file:
```env
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=000000000000
FIREBASE_APP_ID=1:000000000000:web:XXXXXXXXXXXXXXXX
```
 
> For emulator-specific Firebase setup (Firestore rules, functions), also refer to [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).
 
---
 
## 2. Google OAuth Client IDs
 
These are required for Google Sign-In to work on each platform (Web, Android, iOS).
 
**Variables:**
```
GOOGLE_CLIENT_ID_WEB
GOOGLE_CLIENT_ID_ANDROID
GOOGLE_CLIENT_ID_IOS
```
 
**Steps:**
 
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Make sure you're on the **same project** as your Firebase project (select it from the top dropdown).
3. In the left sidebar, go to **APIs & Services** → **Credentials**.
4. Click **"+ Create Credentials"** → **OAuth Client ID**.
> If prompted to configure the OAuth consent screen first, fill in the required fields (App name, support email) and save.
 
**For Web Client ID:**
- Application type: **Web application**
- Add `http://localhost:19006` to **Authorized JavaScript origins** (for local Expo web dev)
- Click **Create** and copy the **Client ID**
```env
GOOGLE_CLIENT_ID_WEB=XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
```

 **For Android and iOS Client ID:**
- Use the same Web Client ID you generated above for both variables.

```env
GOOGLE_CLIENT_ID_ANDROID=XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
```

> Simply copy the same Web Client ID into all three variables.

---
 
## 3. EmailJS (Optional)
 
EmailJS is used for sending automated emails (e.g., event confirmation, reminders). This is optional — the app will run without it, but email features will be disabled.
 
**Variables:**
```
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_ID
EMAILJS_PUBLIC_KEY
```
 
**Steps:**
 
1. Go to [emailjs.com](https://www.emailjs.com) and create a free account.
**For Service ID:**
- In the dashboard, go to **Email Services** → **Add New Service**
- Choose your email provider (Gmail, Outlook, etc.) and connect your account
- Once connected, the **Service ID** is shown on the service card (e.g., `service_xxxxxxx`)
```env
EMAILJS_SERVICE_ID=service_xxxxxxx
```
 
**For Template ID:**
- Go to **Email Templates** → **Create New Template**
- Design your email template (you can use variables like `{{event_name}}`, `{{user_name}}`)
- Save the template — the **Template ID** is shown at the top (e.g., `template_xxxxxxx`)
```env
EMAILJS_TEMPLATE_ID=template_xxxxxxx
```
 
**For Public Key:**
- Go to **Account** → **API Keys**
- Copy your **Public Key**
```env
EMAILJS_PUBLIC_KEY=XXXXXXXXXXXXXXXXXXXX
```
 
---
 
## Final .env Reference
 
Once you've followed all the steps above, your `app/.env` file should look like this:
 
```env
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=000000000000
FIREBASE_APP_ID=1:000000000000:web:XXXXXXXXXXXXXXXX
 
# Google OAuth (use the same Web Client ID for all three)
GOOGLE_CLIENT_ID_WEB=XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
 
# EmailJS (Optional)
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx
EMAILJS_PUBLIC_KEY=XXXXXXXXXXXXXXXXXXXX
```
 
> **Important:** Never commit your `.env` file to GitHub. It is already listed in `.gitignore` — keep it that way.
 
---
 
If you run into any issues while setting up your credentials, open a [GitHub Issue](https://github.com/roshankumar0036singh/Uni-Event/issues) and the maintainers will help you out.

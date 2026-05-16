import { handleZoomWebhook } from './zoomWebhook';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';

// Load environment variables
dotenv.config();
// Initialize Firebase Admin (ensure service account is available or uses default credentials)
// For Render, we might need to rely on strict env vars or a service account file
if (admin.apps.length === 0) {
  // Try to load credentials from environment variable
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (credentialsJson) {
    try {
      const serviceAccount = JSON.parse(credentialsJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized with service account from env');
    } catch (error) {
      console.error('❌ Failed to parse service account JSON:', error);
      admin.initializeApp();
    }
  } else {
    // Fallback to default credentials
    admin.initializeApp();
    console.log('⚠️  Firebase Admin initialized with default credentials');
  }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Auth Middleware to mimic Firebase Callable Context
const validateFirebaseIdToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))) {
    res.status(403).send('Unauthorized');
    return;
  }

  const idToken = req.headers.authorization.split('Bearer ')[1];
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedIdToken;
    next();
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
  }
};

// setRole Implementation (adapted from setRole.ts logic)
app.post('/api/setRole', validateFirebaseIdToken, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;

  // 1. Check Auth (already done by middleware, but check existence)
  if (!user) {
    return res.status(401).json({ error: 'unauthenticated', message: 'The function must be called while authenticated.' });
  }

  // 2. Check Admin
  // Note: We use the token claims. 
  // IMPORTANT: For the very first admin, manual entry in DB or claims is needed.
  if (!user.admin) {
    return res.status(403).json({ error: 'permission-denied', message: 'Only admins can set roles.' });
  }

  const { uid, role } = req.body;

  // 3. Validation
  if (!uid || !role) {
    return res.status(400).json({ error: 'invalid-argument', message: "The function must be called with 'uid' and 'role' arguments." });
  }

  const validRoles = ["admin", "club", "student"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'invalid-argument', message: `Role must be one of: ${validRoles.join(", ")}` });
  }

  // 4. Logic
  const claims: { [key: string]: boolean } = {};
  if (role === "admin") claims.admin = true;
  if (role === "club") claims.club = true;

  try {
    await admin.auth().setCustomUserClaims(uid, claims);

    // Optional: Update Firestore
    await admin.firestore().collection("users").doc(uid).set(
      { role },
      { merge: true }
    );

    return res.json({ result: { success: true } }); // Structure matches Callable response
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'internal', message: 'Error setting role' });
  }
});

// Send Certificates Endpoint
import { sendCertificatesForEvent } from './certificateService';

app.post('/api/sendCertificates', validateFirebaseIdToken, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  const { eventId } = req.body;

  if (!user) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  if (!eventId) {
    return res.status(400).json({ error: 'invalid-argument', message: 'eventId is required' });
  }

  try {
    const result = await sendCertificatesForEvent(eventId, user.uid);
    return res.json({ result });
  } catch (error: any) {
    console.error("Certificate Error:", error);
    return res.status(500).json({ error: 'internal', message: error.message });
  }
});

// Basic Health Check
app.get('/', (req, res) => {
  res.send('UniEvent Backend is Running');
});
app.post('/api/sendDailyDigest', validateFirebaseIdToken, async (req: express.Request, res: express.Response) => {
  try {
    // Optional: Check if admin
    const user = (req as any).user;
    // Check for admin claim (boolean) or role property (string)
    if (!user.admin && user.role !== 'admin') {
      res.status(403).json({ message: 'Unauthorized: Only admins can trigger this.' });
      return;
    }

    // const { sendDailyDigest } = require('./dailyDigest'); // Unused

    // Since sendDailyDigest is an onCall, we can reuse logic or extract logic.
    // But onCall expects (data, context).
    // Let's just run logic here or duplicate/extract.
    // Actually, better to import the Logic function if I separated it.
    // But since I wrote it as `functions.https.onCall`, it's not directly callable as a plain JS function easily without mock.

    // Let's rewrite dailyDigest to be a shared function or just call it if it was separate.
    // For simplicity in this structure, I will copy the logic or simpler: use the firebase-admin directly here 
    // OR better: Invoke the function? No.

    // I will implement the logic directly here for the API endpoint to ensure it works smoothly with Express req/res.

    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const eventsRef = db.collection('events');
    const snapshot = await eventsRef
      .where('startAt', '>=', today.toISOString())
      .where('startAt', '<', tomorrow.toISOString())
      .get();

    const count = snapshot.size;

    if (count > 0) {
      const usersSnapshot = await db.collection('users').get();
      const messages: any[] = [];
      const batch = db.batch();

      // Lazy import Expo to ensure it works
      const { Expo } = require('expo-server-sdk');
      const expo = new Expo();

      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const pushToken = userData.pushToken;

        // In-App
        const notifRef = userDoc.ref.collection('notifications').doc();
        batch.set(notifRef, {
          title: 'Daily Digest 📅',
          body: `There are ${count} events happening today!`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false
        });

        if (pushToken && Expo.isExpoPushToken(pushToken)) {
          messages.push({
            to: pushToken,
            sound: 'default',
            title: 'Daily Digest 📅',
            body: `There are ${count} events happening today!`,
            data: { url: '/home' },
          });
        }
      });

      await batch.commit();

      if (messages.length > 0) {
        let chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
          try { await expo.sendPushNotificationsAsync(chunk); } catch (e) { console.error(e); }
        }
      }
    }

    res.json({ success: true, count, message: `Digest sent for ${count} events to all users.` });
  } catch (error) {
    console.error("Digest Error", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Zoom Webhook — capture raw body before JSON parsing
app.post(
  '/api/zoom/webhook',
  express.raw({ type: 'application/json' }),
  async (req: express.Request, res: express.Response) => {
    const rawBody = req.body.toString('utf8');
    const parsedBody = JSON.parse(rawBody);
    const result = await handleZoomWebhook(rawBody, parsedBody, req.headers);
    res.status(result.status).json(result.data);
  }
);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

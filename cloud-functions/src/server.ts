import { handleZoomWebhook } from './zoomWebhook';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin (ensure service account is available or uses default credentials)
if (admin.apps.length === 0) {
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
    admin.initializeApp();
    console.log('⚠️  Firebase Admin initialized with default credentials');
  }
}

const app = express();
app.use(cors({ origin: true }));

// =========================================================================
// 1. ZOOM WEBHOOK ROUTE (Must sit ABOVE global express.json() middleware)
// =========================================================================
app.post(
  '/api/zoom/webhook',
  express.raw({ type: 'application/json' }),
  async (req: express.Request, res: express.Response) => {
    try {
      // Ensure middleware captured a raw Buffer stream properly
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: 'Invalid webhook body stream structure' });
      }

      const rawBody = req.body.toString('utf8');
      const parsedBody = JSON.parse(rawBody);
      
      const result = await handleZoomWebhook(rawBody, parsedBody, req.headers);
      return res.status(result.status).json(result.data);
    } catch (error) {
      console.error('❌ Error handling Zoom webhook parser:', error);
      return res.status(400).json({ error: 'Invalid JSON payload format' });
    }
  }
);

// =========================================================================
// 2. GLOBAL PARSERS & MIDDLEWARE (Applies to all routes underneath)
// =========================================================================
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

  if (!user) {
    return res.status(401).json({ error: 'unauthenticated', message: 'The function must be called while authenticated.' });
  }

  if (!user.admin) {
    return res.status(403).json({ error: 'permission-denied', message: 'Only admins can set roles.' });
  }

  const { uid, role } = req.body;

  if (!uid || !role) {
    return res.status(400).json({ error: 'invalid-argument', message: "The function must be called with 'uid' and 'role' arguments." });
  }

  const validRoles = ["admin", "club", "student"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'invalid-argument', message: `Role must be one of: ${validRoles.join(", ")}` });
  }

  const claims: { [key: string]: boolean } = {};
  if (role === "admin") claims.admin = true;
  if (role === "club") claims.club = true;

  try {
    await admin.auth().setCustomUserClaims(uid, claims);

    await admin.firestore().collection("users").doc(uid).set(
      { role },
      { merge: true }
    );

    return res.json({ result: { success: true } });
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
    const user = (req as any).user;
    if (!user.admin && user.role !== 'admin') {
      res.status(403).json({ message: 'Unauthorized: Only admins can trigger this.' });
      return;
    }

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

      const { Expo } = require('expo-server-sdk');
      const expo = new Expo();

      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const pushToken = userData.pushToken;

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

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
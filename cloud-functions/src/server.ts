import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';
import { checkAndUpdateRateLimit } from './utils/rateLimiter';
import { getTodayEventCount } from './dailyDigest';
import { sendPushNotifications } from './utils/push';
import { Expo } from 'expo-server-sdk';
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
                credential: admin.credential.cert(serviceAccount),
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
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: true }));
app.use('/api', ipWhitelist);
app.use(express.json());

// Auth Middleware to mimic Firebase Callable Context
const validateFirebaseIdToken = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
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

// Rate Limiting Middleware for Server Endpoints
const rateLimitMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => {
    const user = (req as any).user;
    if (!user) {
        return next();
    }

    try {
        // Determine if the operation is event creation or regular write
        const isEventCreation = req.path === '/api/createEvent';
        const limitResult = await checkAndUpdateRateLimit(user.uid, isEventCreation);

        if (!limitResult.allowed) {
            return res.status(limitResult.statusCode).json({
                error: 'too-many-requests',
                message: limitResult.message,
            });
        }
        next();
    } catch (error) {
        console.error('Rate limiter middleware error:', error);
        return res.status(503).json({
            error: 'rate-limit-unavailable',
            message: 'Rate limiting is temporarily unavailable. Please retry shortly.',
        });
    }
};

// setRole Implementation (adapted from setRole.ts logic)
app.post(
    '/api/setRole',
    validateFirebaseIdToken,
    rateLimitMiddleware,
    async (req: express.Request, res: express.Response) => {
        const user = (req as any).user;

        // 1. Check Auth (already done by middleware, but check existence)
        if (!user) {
            return res
                .status(401)
                .json({
                    error: 'unauthenticated',
                    message: 'The function must be called while authenticated.',
                });
        }

        // 2. Check Admin
        // Note: We use the token claims.
        // IMPORTANT: For the very first admin, manual entry in DB or claims is needed.
        if (!user.admin) {
            return res
                .status(403)
                .json({ error: 'permission-denied', message: 'Only admins can set roles.' });
        }

        const { uid, role } = req.body;

        // 3. Validation
        if (!uid || !role) {
            return res
                .status(400)
                .json({
                    error: 'invalid-argument',
                    message: "The function must be called with 'uid' and 'role' arguments.",
                });
        }

        const validRoles = ['admin', 'club', 'student'];
        if (!validRoles.includes(role)) {
            return res
                .status(400)
                .json({
                    error: 'invalid-argument',
                    message: `Role must be one of: ${validRoles.join(', ')}`,
                });
        }

        // 4. Logic
        const claims: { [key: string]: boolean } = {};
        if (role === 'admin') claims.admin = true;
        if (role === 'club') claims.club = true;

        try {
            await admin.auth().setCustomUserClaims(uid, claims);

            // Optional: Update Firestore
            await admin.firestore().collection('users').doc(uid).set({ role }, { merge: true });

            return res.json({ result: { success: true } }); // Structure matches Callable response
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'internal', message: 'Error setting role' });
        }
    },
);

// Send Certificates Endpoint
import { sendCertificatesForEvent } from './certificateService';
import { ipWhitelist } from './middleware/ipWhitelist';

app.post(
    '/api/sendCertificates',
    validateFirebaseIdToken,
    rateLimitMiddleware,
    async (req: express.Request, res: express.Response) => {
        const user = (req as any).user;
        const { eventId } = req.body;

        if (!user) {
            return res.status(401).json({ error: 'unauthenticated' });
        }

        if (!eventId) {
            return res
                .status(400)
                .json({ error: 'invalid-argument', message: 'eventId is required' });
        }

        try {
            const result = await sendCertificatesForEvent(eventId, user.uid);
            return res.json({ result });
        } catch (error: any) {
            console.error('Certificate Error:', error);
            return res.status(500).json({ error: 'internal', message: error.message });
        }
    },
);

// Basic Health Check
app.get('/', (req, res) => {
    res.send('UniEvent Backend is Running');
});

// Certificate Verification Endpoint
app.get('/api/certificate', async (req: express.Request, res: express.Response) => {
    const { eventId, participantId } = req.query;

    if (typeof eventId !== 'string' || typeof participantId !== 'string') {
        res.status(400).send('Invalid eventId or participantId format');
        return;
    }

    if (!eventId.trim() || !participantId.trim()) {
        res.status(400).send('eventId and participantId cannot be empty');
        return;
    }

    if (eventId.includes('/') || participantId.includes('/')) {
        res.status(400).send('Invalid eventId or participantId content');
        return;
    }

    try {
        const participantRef = admin
            .firestore()
            .collection(`events/${eventId}/participants`)
            .doc(participantId);
        const doc = await participantRef.get();

        if (!doc.exists) {
            res.status(404).send('Certificate not found');
            return;
        }

        const data = doc.data();
        if (data?.certificateRevoked) {
            res.status(403).send('Certificate has been revoked by the owner.');
            return;
        }

        const storagePath = `certificates/${eventId}/${participantId}.pdf`;
        const file = admin.storage().bucket().file(storagePath);
        const [exists] = await file.exists();
        if (!exists) {
            res.status(404).send('Certificate file not found in storage');
            return;
        }

        // Generate a short-lived (15 min) signed URL and redirect
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
        });

        res.redirect(url);
    } catch (error) {
        console.error('Error serving certificate:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post(
    '/api/sendDailyDigest',
    validateFirebaseIdToken,
    rateLimitMiddleware,
    async (req: express.Request, res: express.Response) => {
        try {
            // Optional: Check if admin
            const user = (req as any).user;
            // Check for admin claim (boolean) or role property (string)
            if (!user.admin && user.role !== 'admin') {
                res.status(403).json({ message: 'Unauthorized: Only admins can trigger this.' });
                return;
            }

            const db = admin.firestore();
            const count = await getTodayEventCount(db);

            if (count > 0) {
                const PAGE_SIZE = 500;
                let lastDoc: admin.firestore.DocumentSnapshot | null = null;
                let processedCount = 0;

                while (true) {
                    let query: admin.firestore.Query = db
                        .collection('users')
                        .orderBy(admin.firestore.FieldPath.documentId())
                        .limit(PAGE_SIZE);

                    if (lastDoc) {
                        query = query.startAfter(lastDoc);
                    }

                    const usersSnapshot = await query.get();
                    if (usersSnapshot.empty) break;

                    const batch = db.batch();
                    const messages: any[] = [];

                    usersSnapshot.forEach(userDoc => {
                        const userData = userDoc.data();
                        if (userData.digestOptIn === false) return;

                        const pushToken = userData.pushToken;

                        // In-App
                        const notifRef = userDoc.ref.collection('notifications').doc();
                        batch.set(notifRef, {
                            title: 'Daily Digest 📅',
                            body: `There are ${count} events happening today!`,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            read: false,
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
                    await sendPushNotifications(messages);

                    processedCount += usersSnapshot.size;
                    lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
                    if (usersSnapshot.size < PAGE_SIZE) break;
                }
            }

            res.json({
                success: true,
                count,
                message: `Digest sent for ${count} events to all users.`,
            });
        } catch (error) {
            console.error('Digest Error', error);
            res.status(500).json({ error: (error as Error).message });
        }
    },
);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

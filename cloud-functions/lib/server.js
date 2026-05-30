"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const rateLimiter_1 = require("./utils/rateLimiter");
// Load environment variables
dotenv_1.default.config();
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
        }
        catch (error) {
            console.error('❌ Failed to parse service account JSON:', error);
            admin.initializeApp();
        }
    }
    else {
        // Fallback to default credentials
        admin.initializeApp();
        console.log('⚠️  Firebase Admin initialized with default credentials');
    }
}
const app = (0, express_1.default)();
app.disable('x-powered-by');
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Auth Middleware to mimic Firebase Callable Context
const validateFirebaseIdToken = async (req, res, next) => {
    var _a;
    if (!((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.startsWith('Bearer '))) {
        res.status(403).send('Unauthorized');
        return;
    }
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedIdToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedIdToken;
        next();
    }
    catch (error) {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    }
};
// Rate Limiting Middleware for Server Endpoints
const rateLimitMiddleware = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        return next();
    }
    try {
        // Determine if the operation is event creation or regular write
        const isEventCreation = req.path === '/api/createEvent';
        const limitResult = await (0, rateLimiter_1.checkAndUpdateRateLimit)(user.uid, isEventCreation);
        if (!limitResult.allowed) {
            return res.status(limitResult.statusCode).json({
                error: 'too-many-requests',
                message: limitResult.message
            });
        }
        next();
    }
    catch (error) {
        console.error('Rate limiter middleware error:', error);
        return res.status(503).json({
            error: 'rate-limit-unavailable',
            message: 'Rate limiting is temporarily unavailable. Please retry shortly.'
        });
    }
};
// setRole Implementation (adapted from setRole.ts logic)
app.post('/api/setRole', validateFirebaseIdToken, rateLimitMiddleware, async (req, res) => {
    const user = req.user;
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
    const claims = {};
    if (role === "admin")
        claims.admin = true;
    if (role === "club")
        claims.club = true;
    try {
        await admin.auth().setCustomUserClaims(uid, claims);
        // Optional: Update Firestore
        await admin.firestore().collection("users").doc(uid).set({ role }, { merge: true });
        return res.json({ result: { success: true } }); // Structure matches Callable response
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'internal', message: 'Error setting role' });
    }
});
// Send Certificates Endpoint
const certificateService_1 = require("./certificateService");
app.post('/api/sendCertificates', validateFirebaseIdToken, rateLimitMiddleware, async (req, res) => {
    const user = req.user;
    const { eventId } = req.body;
    if (!user) {
        return res.status(401).json({ error: 'unauthenticated' });
    }
    if (!eventId) {
        return res.status(400).json({ error: 'invalid-argument', message: 'eventId is required' });
    }
    try {
        const result = await (0, certificateService_1.sendCertificatesForEvent)(eventId, user.uid);
        return res.json({ result });
    }
    catch (error) {
        console.error("Certificate Error:", error);
        return res.status(500).json({ error: 'internal', message: error.message });
    }
});
// Basic Health Check
app.get('/', (req, res) => {
    res.send('UniEvent Backend is Running');
});
app.post('/api/sendDailyDigest', validateFirebaseIdToken, rateLimitMiddleware, async (req, res) => {
    try {
        // Optional: Check if admin
        const user = req.user;
        // Check for admin claim (boolean) or role property (string)
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
            const messages = [];
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
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
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
                    try {
                        await expo.sendPushNotificationsAsync(chunk);
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
            }
        }
        res.json({ success: true, count, message: `Digest sent for ${count} events to all users.` });
    }
    catch (error) {
        console.error("Digest Error", error);
        res.status(500).json({ error: error.message });
    }
});
// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

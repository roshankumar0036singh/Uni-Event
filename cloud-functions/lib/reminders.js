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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkReminders = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
/**
 * Scheduled function to check for reminders.
 * Runs every minute.
 */
const { Expo } = require('expo-server-sdk');
const expo = new Expo();
/**
 * Scheduled function to check for reminders.
 * Runs every minute.
 */
exports.checkReminders = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    // Find reminders that need to be sent (remindAt <= now) and haven't been sent yet
    const remindersRef = db.collection('reminders');
    const q = remindersRef.where('remindAt', '<=', now).where('sent', '==', false);
    const snapshot = await q.get();
    if (snapshot.empty) {
        return null;
    }
    const batch = db.batch();
    const messages = [];
    // We need to fetch user tokens
    // To handle many reminders, we might need efficient querying, but loop is fine for now 
    for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const userId = data.userId;
        // 1. Create in-app notification
        const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            title: 'Event Reminder',
            body: `Your event is starting soon!`,
            eventId: data.eventId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        // 2. Prepare Push Notification
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const pushToken = userData === null || userData === void 0 ? void 0 : userData.pushToken;
            if (pushToken && Expo.isExpoPushToken(pushToken)) {
                messages.push({
                    to: pushToken,
                    sound: 'default',
                    title: 'Event Reminder ⏰',
                    body: `Your event is starting!`,
                    data: { eventId: data.eventId, url: `/event/${data.eventId}` },
                });
            }
        }
        // 3. Mark reminder as sent
        batch.update(docSnapshot.ref, { sent: true });
    }
    // Send Pushes
    if (messages.length > 0) {
        let chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
            }
            catch (error) {
                console.error("Error sending chunks", error);
            }
        }
    }
    await batch.commit();
    console.log(`Processed ${snapshot.size} reminders.`);
    return null;
});
//# sourceMappingURL=reminders.js.map
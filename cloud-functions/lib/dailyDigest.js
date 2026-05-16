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
exports.sendDailyDigest = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const { Expo } = require('expo-server-sdk');
const expo = new Expo();
exports.sendDailyDigest = functions.https.onCall(async (data, context) => {
    // Only allow admin to trigger manual digest if needed, or open for now
    // if (!context.auth || !context.auth.token.admin) {
    //   throw new functions.https.HttpsError('permission-denied', 'Only admin');
    // }
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    // efficient query for "today's events"
    const eventsRef = db.collection('events');
    const snapshot = await eventsRef
        .where('startAt', '>=', today.toISOString())
        .where('startAt', '<', tomorrow.toISOString())
        .get();
    const count = snapshot.size;
    if (count === 0) {
        return { success: true, message: "No events today." };
    }
    // Broadcast
    const usersSnapshot = await db.collection('users').get();
    const messages = [];
    const batch = db.batch();
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
                data: { url: '/home' }, // Deep link to home or events feed
            });
        }
    });
    await batch.commit();
    // Send Pushes
    if (messages.length > 0) {
        let chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
            }
            catch (error) {
                console.error("Error sending digest chunks", error);
            }
        }
    }
    return { success: true, count };
});
//# sourceMappingURL=dailyDigest.js.map
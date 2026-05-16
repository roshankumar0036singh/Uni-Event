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
exports.onEventCreate = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const { Expo } = require('expo-server-sdk');
const expo = new Expo();
exports.onEventCreate = functions.firestore
    .document("events/{eventId}")
    .onCreate(async (snapshot, context) => {
    const eventId = context.params.eventId;
    const eventData = snapshot.data();
    if (!eventData)
        return;
    console.log(`New event created: ${eventId}`, eventData.title);
    const db = admin.firestore();
    // Initialize metrics
    await snapshot.ref.update({
        metrics: {
            views: 0,
            remindersSet: 0,
            registrations: 0,
            attendance: 0,
        },
    });
    // Broadcast Notification Logic
    // Fetch all users with push tokens
    // Ideally use topics or pagination for large user bases
    const usersSnapshot = await db.collection('users').get();
    const messages = [];
    const batch = db.batch();
    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        // 1. In-App Notification
        const notifRef = userDoc.ref.collection('notifications').doc();
        batch.set(notifRef, {
            title: 'New Event Alert! 📢',
            body: `Check out: "${eventData.title}"`,
            eventId: eventId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        // 2. Push Notification
        const pushToken = userData.pushToken;
        if (pushToken && Expo.isExpoPushToken(pushToken)) {
            messages.push({
                to: pushToken,
                sound: 'default',
                title: 'New Event Alert! 📢',
                body: `New Event: ${eventData.title}`,
                data: { eventId: eventId, url: `/event/${eventId}` },
            });
        }
    });
    await batch.commit();
    // Send Push Notifications
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
    console.log(`Sent notifications to ${usersSnapshot.size} users.`);
});
//# sourceMappingURL=onEventCreate.js.map
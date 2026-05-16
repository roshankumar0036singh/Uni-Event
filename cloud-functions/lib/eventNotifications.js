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
exports.checkUpcomingEvents = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const expo = new expo_server_sdk_1.Expo();
/**
 * Scheduled function to check for upcoming events (10 mins before).
 * Runs every minute.
 */
exports.checkUpcomingEvents = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const db = admin.firestore();
    // 1. Get events starting soon that haven't been notified
    const eventsRef = db.collection('events');
    // Note: ISO string comparison in Firestore works lexicographically.
    // However, in EventDetail.js we saw `new Date(event.startAt)`. 
    // If stored as ISO String, string comparison works.
    // But we need to be careful. Let's assume standard ISO.
    // Actually, checking "starts in 10 mins" with a "notified" flag is safer.
    // Let's refine query: "startAt" <= now + 10m AND "status" == 'active' AND "notified" != true
    // Wait, simpler query:
    // Get all active events starting between NOW and NOW+15m.
    // Filter locally for "notified" to save writes if we want, or just update "notified" flag in DB.
    // Creating a buffer of 10-15 mins to catch them.
    const startRange = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endRange = new Date(Date.now() + 11 * 60 * 1000).toISOString();
    const eventsSnapshot = await eventsRef
        .where('startAt', '>=', startRange)
        .where('startAt', '<=', endRange)
        .where('status', '==', 'active')
        .get();
    if (eventsSnapshot.empty) {
        return null;
    }
    const messages = [];
    const batch = db.batch();
    for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        if (eventData.notified10Min)
            continue; // Skip if already notified
        const eventId = eventDoc.id;
        // Get Participants
        const participantsSnapshot = await db.collection(`events/${eventId}/participants`).get();
        const participantIds = participantsSnapshot.docs.map(doc => doc.id);
        if (participantIds.length > 0) {
            // Get User Tokens (in chunks of 10 to avoid "in" query limits if needed, but for now simple)
            // Firestore "in" supports up to 10. For larger, we iterate.
            // Efficient way: store pushToken in participant doc? 
            // EventDetail.js stores { userId, email, name, joinedAt }. No pushToken.
            // So we must fetch users.
            const userDocs = await Promise.all(participantIds.map(uid => db.collection('users').doc(uid).get()));
            for (const userDoc of userDocs) {
                if (!userDoc.exists)
                    continue;
                const userData = userDoc.data();
                const pushToken = userData === null || userData === void 0 ? void 0 : userData.pushToken;
                if (pushToken && expo_server_sdk_1.Expo.isExpoPushToken(pushToken)) {
                    messages.push({
                        to: pushToken,
                        sound: 'default',
                        title: 'Event Starting Soon!',
                        body: `${eventData.title} is starting in 10 minutes.`,
                        data: { eventId: eventId, url: `/event/${eventId}` },
                    });
                }
            }
        }
        // Mark event as notified
        batch.update(eventDoc.ref, { notified10Min: true });
    }
    // Send Notifications
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
        try {
            await expo.sendPushNotificationsAsync(chunk);
        }
        catch (error) {
            console.error(error);
        }
    }
    await batch.commit();
    return null;
});
//# sourceMappingURL=eventNotifications.js.map
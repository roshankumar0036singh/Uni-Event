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
const push_1 = require("./utils/push");
async function getUpcomingEvents(db) {
    const startRange = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endRange = new Date(Date.now() + 11 * 60 * 1000).toISOString();
    return db
        .collection('events')
        .where('startAt', '>=', startRange)
        .where('startAt', '<=', endRange)
        .where('status', '==', 'active')
        .get();
}
async function buildMessagesForEvent(db, eventDoc) {
    const eventData = eventDoc.data();
    if (eventData.notified10Min)
        return [];
    const participantsSnapshot = await db.collection(`events/${eventDoc.id}/participants`).get();
    const participantIds = participantsSnapshot.docs.map(doc => doc.id);
    if (participantIds.length === 0)
        return [];
    const userDocs = await Promise.all(participantIds.map(uid => db.collection('users').doc(uid).get()));
    return userDocs.flatMap(userDoc => {
        var _a;
        if (!userDoc.exists)
            return [];
        const pushToken = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.pushToken;
        if (!pushToken || !expo_server_sdk_1.Expo.isExpoPushToken(pushToken))
            return [];
        return [
            {
                to: pushToken,
                sound: 'default',
                title: 'Event Starting Soon!',
                body: `${eventData.title} is starting in 10 minutes.`,
                data: { eventId: eventDoc.id, url: `/event/${eventDoc.id}` },
            },
        ];
    });
}
/**
 * Scheduled function to check for upcoming events (10 mins before).
 * Runs every minute.
 */
exports.checkUpcomingEvents = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
    const db = admin.firestore();
    const eventsSnapshot = await getUpcomingEvents(db);
    if (eventsSnapshot.empty) {
        return { processed: 0, notificationsSent: 0 };
    }
    const batch = db.batch();
    let notificationsSent = 0;
    for (const eventDoc of eventsSnapshot.docs) {
        const messages = await buildMessagesForEvent(db, eventDoc);
        if (messages.length === 0)
            continue;
        try {
            await (0, push_1.sendPushNotifications)(messages);
            notificationsSent += messages.length;
            batch.update(eventDoc.ref, { notified10Min: true });
        }
        catch (error) {
            console.error(`Failed to send notifications for event ${eventDoc.id}:`, error);
            // Do not mark as notified so we can retry on the next run
        }
    }
    await batch.commit();
    return { processed: eventsSnapshot.size, notificationsSent };
});

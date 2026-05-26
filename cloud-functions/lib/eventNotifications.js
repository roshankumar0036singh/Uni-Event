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
const participants_1 = require("./lib/participants");
const expo = new expo_server_sdk_1.Expo();
async function gatherMessagesForEvent(db, eventDoc) {
    const eventData = eventDoc.data();
    if (eventData.notified10Min)
        return [];
    const eventId = eventDoc.id;
    const participants = (await (0, participants_1.getParticipantContacts)(db, eventId));
    const participantIds = participants.map((p) => p.id);
    if (participantIds.length === 0)
        return [];
    const userDocs = await Promise.all(participantIds.map((uid) => db.collection('users').doc(uid).get()));
    const messages = [];
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
                data: { eventId, url: `/event/${eventId}` },
            });
        }
    }
    return messages;
}
async function sendMessagesOrThrow(messages) {
    const chunks = expo.chunkPushNotifications(messages);
    let sentChunks = 0;
    let failedChunks = 0;
    for (const chunk of chunks) {
        try {
            await expo.sendPushNotificationsAsync(chunk);
            sentChunks += 1;
        }
        catch (error) {
            failedChunks += 1;
            console.error('Failed to send notification chunk', {
                chunkSize: chunk.length,
                error,
            });
        }
    }
    return {
        sentChunks,
        failedChunks,
        allChunksSucceeded: failedChunks === 0,
    };
}
exports.checkUpcomingEvents = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
    const db = admin.firestore();
    const startRange = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endRange = new Date(Date.now() + 11 * 60 * 1000).toISOString();
    const eventsSnapshot = await db
        .collection('events')
        .where('startAt', '>=', startRange)
        .where('startAt', '<=', endRange)
        .where('status', '==', 'active')
        .get();
    if (eventsSnapshot.empty)
        return { processed: 0, notificationsSent: 0 };
    const batch = db.batch();
    let totalMessages = 0;
    const successfulEventRefs = [];
    for (const eventDoc of eventsSnapshot.docs) {
        const msgs = await gatherMessagesForEvent(db, eventDoc);
        if (msgs.length === 0)
            continue;
        try {
            const result = await sendMessagesOrThrow(msgs);
            if (result.allChunksSucceeded) {
                successfulEventRefs.push(eventDoc.ref);
                totalMessages += msgs.length;
            }
        }
        catch (error) {
            console.error('Unexpected error while sending notifications for event', eventDoc.id, error);
        }
    }
    for (const ref of successfulEventRefs) {
        batch.update(ref, { notified10Min: true });
    }
    await batch.commit();
    return { processed: eventsSnapshot.size, notificationsSent: totalMessages };
});
//# sourceMappingURL=eventNotifications.js.map
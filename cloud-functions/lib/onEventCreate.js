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
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
const push_1 = require("./utils/push");
const BATCH_SIZE = 500;
async function processUserBatch(db, eventId, eventTitle, startAfter) {
    let query = db.collection('users')
        .select('pushToken')
        .limit(BATCH_SIZE);
    if (startAfter) {
        query = query.startAfter(startAfter);
    }
    const snapshot = await query.get();
    if (snapshot.empty)
        return { count: 0, hasMore: false, cursor: undefined };
    const messages = [];
    const batch = db.batch();
    snapshot.forEach(userDoc => {
        const pushToken = userDoc.get('pushToken');
        if (pushToken) {
            const notifRef = userDoc.ref.collection('notifications').doc(`${eventId}_${userDoc.id}`);
            batch.set(notifRef, {
                title: 'New Event Alert! 📢',
                body: `Check out: "${eventTitle}"`,
                eventId: eventId,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                read: false
            });
        }
    });
    // Collect push messages before committing the batch so push failures
    // don't leave partial in-app notifications.
    snapshot.forEach(userDoc => {
        const pushToken = userDoc.get('pushToken');
        if (pushToken) {
            messages.push({
                to: pushToken,
                sound: 'default',
                title: 'New Event Alert! 📢',
                body: `New Event: ${eventTitle}`,
                data: { eventId: eventId, url: `/event/${eventId}` },
            });
        }
    });
    await (0, push_1.sendPushNotifications)(messages);
    await batch.commit();
    const hasMore = snapshot.size === BATCH_SIZE;
    return {
        count: snapshot.size,
        hasMore,
        cursor: hasMore ? snapshot.docs[snapshot.docs.length - 1] : undefined,
    };
}
exports.onEventCreate = functions.firestore
    .document("events/{eventId}")
    .onCreate(async (snapshot, context) => {
    const eventId = context.params.eventId;
    const eventData = snapshot.data();
    if (!eventData)
        return;
    const title = eventData.title || 'Untitled Event';
    console.log(`New event created: ${eventId}`, title);
    const db = admin.firestore();
    await snapshot.ref.update({
        metrics: {
            views: 0,
            remindersSet: 0,
            registrations: 0,
            attendance: 0,
        },
    });
    let totalProcessed = 0;
    let cursor;
    let hasMore = true;
    while (hasMore) {
        const result = await processUserBatch(db, eventId, title, cursor);
        totalProcessed += result.count;
        hasMore = result.hasMore;
        cursor = result.cursor;
    }
    console.log(`Sent notifications to ${totalProcessed} users.`);
});

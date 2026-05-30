import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Expo from 'expo-server-sdk';
import { sendPushNotifications } from './utils/push';

const PAGE_SIZE = 500;

/**
 * Fetches the total number of events occurring today.
 *
 * @param db The Firestore database instance
 * @returns A promise that resolves to the count of today's events
 */
export async function getTodayEventCount(db: admin.firestore.Firestore): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const snapshot = await db.collection('events')
        .where('startAt', '>=', today.toISOString())
        .where('startAt', '<', tomorrow.toISOString())
        .get();

    return snapshot.size;
}

/**
 * Processes a single user document for the daily digest, appending an in-app
 * notification and a push notification payload if the user has opted in.
 *
 * @param userDoc The Firestore query document snapshot for the user
 * @param count The total number of events today
 * @param batch The Firestore batch to write notifications to
 * @param pageMessages An array to push Expo push notification payloads into
 */
function processUserPage(userDoc: admin.firestore.QueryDocumentSnapshot, count: number, batch: admin.firestore.WriteBatch, pageMessages: any[]) {
    const userData = userDoc.data();

    if (userData.digestOptIn === false) {
        return;
    }

    const notifRef = userDoc.ref.collection('notifications').doc();
    batch.set(notifRef, {
        title: 'Daily Digest 📅',
        body: `There are ${count} events happening today!`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
    });

    const pushToken = userData.pushToken;
    if (pushToken && Expo.isExpoPushToken(pushToken)) {
        pageMessages.push({
            to: pushToken,
            sound: 'default',
            title: 'Daily Digest 📅',
            body: `There are ${count} events happening today!`,
            data: { url: '/home' },
        });
    }
}

/**
 * Callable HTTPS function that sends the daily digest to all eligible users.
 * Requires an authenticated admin user.
 */
export const sendDailyDigest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger daily digest.');
    }

    const db = admin.firestore();
    const count = await getTodayEventCount(db);

    if (count === 0) {
        return { success: true, message: "No events today.", count: 0, processed: 0 };
    }

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

        if (usersSnapshot.empty) {
            break;
        }

        const batch = db.batch();
        const pageMessages: any[] = [];

        usersSnapshot.forEach(userDoc => processUserPage(userDoc, count, batch, pageMessages));
        await batch.commit();
        if (pageMessages.length > 0) {
            try {
                await sendPushNotifications(pageMessages);
            } catch (error) {
                functions.logger.error('Daily digest push delivery failed for page', {
                    error,
                    pageSize: usersSnapshot.size,
                    pushMessages: pageMessages.length,
                });
            }
        }

        processedCount += usersSnapshot.size;
        lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];

        if (usersSnapshot.size < PAGE_SIZE) {
            break;
        }
    }

    return { success: true, count, processed: processedCount };
});

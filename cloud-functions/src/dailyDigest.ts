import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import Expo from 'expo-server-sdk';
import { sendPushNotifications } from './utils/push';

const PAGE_SIZE = 500;

function processUserPage(userDoc: admin.firestore.QueryDocumentSnapshot, count: number, batch: admin.firestore.WriteBatch, pageMessages: any[]) {
    const userData = userDoc.data();

    if (userData.digestOptIn === false) {
        return;
    }

    const notifRef = userDoc.ref.collection('notifications').doc();
    batch.set(notifRef, {
        title: 'Daily Digest 📅',
        body: `There are ${count} events happening today!`,
        createdAt: FieldValue.serverTimestamp(),
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

export const sendDailyDigest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger daily digest.');
    }

    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const snapshot = await db.collection('events')
        .where('startAt', '>=', today.toISOString())
        .where('startAt', '<', tomorrow.toISOString())
        .get();

    const count = snapshot.size;

    if (count === 0) {
        return { success: true, message: "No events today.", count: 0, processed: 0 };
    }

    let lastDoc: admin.firestore.DocumentSnapshot | null = null;
    let processedCount = 0;

    while (true) {
        let query: admin.firestore.Query = db
            .collection('users')
            .orderBy(FieldPath.documentId())
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

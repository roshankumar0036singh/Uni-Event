import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import Expo from 'expo-server-sdk';
const expo = new Expo();

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
    const messages: any[] = [];
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
            } catch (error) {
                console.error("Error sending digest chunks", error);
            }
        }
    }

    return { success: true, count };
});

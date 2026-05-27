import { Expo } from 'expo-server-sdk';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const expo = new Expo();

type PushMessage = {
    to: string;
    sound: 'default';
    title: string;
    body: string;
    data: { eventId: string; url: string };
};

async function getUpcomingEvents(db: admin.firestore.Firestore) {
    const startRange = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endRange = new Date(Date.now() + 11 * 60 * 1000).toISOString();

    return db
        .collection('events')
        .where('startAt', '>=', startRange)
        .where('startAt', '<=', endRange)
        .where('status', '==', 'active')
        .get();
}

async function buildMessagesForEvent(
    db: admin.firestore.Firestore,
    eventDoc: admin.firestore.QueryDocumentSnapshot,
) {
    const eventData = eventDoc.data();
    if (eventData.notified10Min) return [] as PushMessage[];

    const participantsSnapshot = await db.collection(`events/${eventDoc.id}/participants`).get();
    const participantIds = participantsSnapshot.docs.map(doc => doc.id);
    if (participantIds.length === 0) return [] as PushMessage[];

    const userDocs = await Promise.all(
        participantIds.map(uid => db.collection('users').doc(uid).get()),
    );

    return userDocs.flatMap<PushMessage>(userDoc => {
        if (!userDoc.exists) return [] as PushMessage[];

        const pushToken = userDoc.data()?.pushToken;
        if (!pushToken || !Expo.isExpoPushToken(pushToken)) return [] as PushMessage[];

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

async function sendPushNotifications(messages: PushMessage[]) {
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        const errors: any[] = [];
        tickets.forEach((t, i) => {
            if (t.status === 'error') {
                errors.push({ ticket: t, index: i });
            }
        });
        if (errors.length > 0) {
            console.error('Push ticket errors:', JSON.stringify(errors, null, 2));
            throw new Error('One or more push notifications failed');
        }
    }
}

/**
 * Scheduled function to check for upcoming events (10 mins before).
 * Runs every minute.
 */
export const checkUpcomingEvents = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
    const db = admin.firestore();
    const eventsSnapshot = await getUpcomingEvents(db);

    if (eventsSnapshot.empty) {
        return { processed: 0, notificationsSent: 0 };
    }

    const batch = db.batch();
    let notificationsSent = 0;

    for (const eventDoc of eventsSnapshot.docs) {
        const messages = await buildMessagesForEvent(db, eventDoc);
        if (messages.length === 0) continue;

        try {
            await sendPushNotifications(messages);
            notificationsSent += messages.length;
            batch.update(eventDoc.ref, { notified10Min: true });
        } catch (error) {
            console.error(`Failed to send notifications for event ${eventDoc.id}:`, error);
            // Do not mark as notified so we can retry on the next run
        }
    }

    await batch.commit();
    return { processed: eventsSnapshot.size, notificationsSent };
});

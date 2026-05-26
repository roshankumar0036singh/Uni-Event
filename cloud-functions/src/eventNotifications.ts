import { Expo } from 'expo-server-sdk';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getParticipantContacts, Participant } from './lib/participants';

const expo = new Expo();

async function gatherMessagesForEvent(
    db: admin.firestore.Firestore,
    eventDoc: admin.firestore.QueryDocumentSnapshot,
): Promise<any[]> {
    const eventData = eventDoc.data();
    if (eventData.notified10Min) return [];

    const eventId = eventDoc.id;
    const participants = (await getParticipantContacts(db, eventId)) as Participant[];
    const participantIds = participants.map((p: Participant) => p.id);

    if (participantIds.length === 0) return [];

    const userDocs = await Promise.all(
        participantIds.map((uid: string) => db.collection('users').doc(uid).get()),
    );

    const messages: any[] = [];
    for (const userDoc of userDocs) {
        if (!userDoc.exists) continue;
        const userData = userDoc.data() as any;
        const pushToken = userData?.pushToken;
        if (pushToken && Expo.isExpoPushToken(pushToken)) {
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

async function sendMessagesOrThrow(messages: any[]) {
    const chunks = expo.chunkPushNotifications(messages);
    let sentChunks = 0;
    let failedChunks = 0;

    for (const chunk of chunks) {
        try {
            await expo.sendPushNotificationsAsync(chunk);
            sentChunks += 1;
        } catch (error) {
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

export const checkUpcomingEvents = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
    const db = admin.firestore();
    const startRange = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endRange = new Date(Date.now() + 11 * 60 * 1000).toISOString();

    const eventsSnapshot = await db
        .collection('events')
        .where('startAt', '>=', startRange)
        .where('startAt', '<=', endRange)
        .where('status', '==', 'active')
        .get();

    if (eventsSnapshot.empty) return { processed: 0, notificationsSent: 0 };

    const batch = db.batch();
    let totalMessages = 0;
    const successfulEventRefs: admin.firestore.DocumentReference[] = [];

    for (const eventDoc of eventsSnapshot.docs) {
        const msgs = await gatherMessagesForEvent(db, eventDoc);
        if (msgs.length === 0) continue;

        try {
            const result = await sendMessagesOrThrow(msgs);
            if (result.allChunksSucceeded) {
                successfulEventRefs.push(eventDoc.ref);
                totalMessages += msgs.length;
            }
        } catch (error) {
            console.error('Unexpected error while sending notifications for event', eventDoc.id, error);
        }
    }

    for (const ref of successfulEventRefs) {
        batch.update(ref, { notified10Min: true });
    }

    await batch.commit();
    return { processed: eventsSnapshot.size, notificationsSent: totalMessages };
});

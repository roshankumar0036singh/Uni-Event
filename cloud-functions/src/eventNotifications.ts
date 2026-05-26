import { Expo } from 'expo-server-sdk';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getParticipantContacts, Participant } from './lib/participants';

const expo = new Expo();

async function gatherMessagesForEvent(
    db: admin.firestore.Firestore,
    eventDoc: FirebaseFirestore.QueryDocumentSnapshot,
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

    const allMessagesPromises = eventsSnapshot.docs.map(async eventDoc => {
        const msgs = await gatherMessagesForEvent(db, eventDoc);
        if (msgs.length > 0) batch.update(eventDoc.ref, { notified10Min: true });
        totalMessages += msgs.length;
        return msgs;
    });

    const allMessagesArrays = await Promise.all(allMessagesPromises);
    const messages = allMessagesArrays.flat();

    // Send Notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
        try {
            await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
            console.error(error);
        }
    }

    await batch.commit();
    return { processed: eventsSnapshot.size, notificationsSent: totalMessages };
});

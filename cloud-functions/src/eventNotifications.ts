import { Expo } from 'expo-server-sdk';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getParticipantContacts } from './lib/participants';

const expo = new Expo();

/**
 * Scheduled function to check for upcoming events (10 mins before).
 * Runs every minute.
 */
export const checkUpcomingEvents = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async context => {
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
            if (eventData.notified10Min) continue; // Skip if already notified

            const eventId = eventDoc.id;

            // Get Participants (use shared helper to dedupe reads)
            const participants = await getParticipantContacts(db, eventId);
            const participantIds = participants.map(p => p.id);

            if (participantIds.length > 0) {
                // Get User Tokens (in chunks of 10 to avoid "in" query limits if needed, but for now simple)
                // Firestore "in" supports up to 10. For larger, we iterate.
                // Efficient way: store pushToken in participant doc?
                // EventDetail.js stores { userId, email, name, joinedAt }. No pushToken.
                // So we must fetch users.

                const userDocs = await Promise.all(
                    participantIds.map(uid => db.collection('users').doc(uid).get()),
                );

                for (const userDoc of userDocs) {
                    if (!userDoc.exists) continue;
                    const userData = userDoc.data();
                    const pushToken = userData?.pushToken;

                    if (pushToken && Expo.isExpoPushToken(pushToken)) {
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
            } catch (error) {
                console.error(error);
            }
        }

        await batch.commit();
        return null;
    });

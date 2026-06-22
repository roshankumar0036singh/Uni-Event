import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export const onParticipantCancel = functions.firestore
    .document('events/{eventId}/participants/{userId}')
    .onDelete(async (snap, context) => {
        const { eventId } = context.params;
        const db = admin.firestore();

        const eventRef = db.collection('events').doc(eventId);
        const waitlistRef = eventRef.collection('waitlist');

        let promotedUserId: string | null = null;
        let eventTitle: string | null = null;

        try {
            await db.runTransaction(async transaction => {
                const eventDoc = await transaction.get(eventRef);
                if (!eventDoc.exists) return;

                const eventData = eventDoc.data()!;
                const maxParticipants = eventData.maxParticipants;
                eventTitle = eventData.title;

                // If there's no maxParticipants, we don't need a waitlist logic
                if (!maxParticipants) return;

                const participantsSnapshot = await transaction.get(
                    eventRef.collection('participants'),
                );

                // If the event is still full or over capacity after the delete, do nothing
                if (participantsSnapshot.size >= maxParticipants) return;

                // We have a free spot! Get the first person in the waitlist.
                const waitlistSnapshot = await transaction.get(
                    waitlistRef.orderBy('joinedAt', 'asc').limit(1),
                );

                if (waitlistSnapshot.empty) return; // No one in waitlist

                const nextWaitlistDoc = waitlistSnapshot.docs[0];
                const nextUser = nextWaitlistDoc.data();
                promotedUserId = nextWaitlistDoc.id;

                // Move them from waitlist to participants
                const newParticipantRef = eventRef.collection('participants').doc(promotedUserId);
                const userParticipatingRef = db
                    .collection('users')
                    .doc(promotedUserId)
                    .collection('participating')
                    .doc(eventId);

                transaction.set(newParticipantRef, nextUser);
                transaction.set(userParticipatingRef, {
                    eventId: eventId,
                    joinedAt: new Date().toISOString(),
                });
                transaction.delete(nextWaitlistDoc.ref);
            });

            // Send Push Notification
            if (promotedUserId && eventTitle) {
                const userDoc = await db.collection('users').doc(promotedUserId).get();
                const pushToken = userDoc.data()?.pushToken;

                if (pushToken && Expo.isExpoPushToken(pushToken)) {
                    await expo.sendPushNotificationsAsync([
                        {
                            to: pushToken,
                            sound: 'default',
                            title: 'You are off the waitlist! 🎉',
                            body: `A spot opened up for ${eventTitle} and you have been automatically registered.`,
                            data: { eventId: eventId, url: `/event/${eventId}` },
                        },
                    ]);
                }
            }
        } catch (error) {
            console.error('Error processing waitlist promotion:', error);
        }
    });

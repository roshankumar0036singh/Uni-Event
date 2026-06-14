import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { isExpoPushToken, sendPushNotifications } from './utils/push';

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 500;
const USER_LOOKUP_BATCH_SIZE = 100;

type PushNotificationPayload = {
    eventId?: unknown;
    title?: unknown;
    message?: unknown;
};

type ValidatedPayload = {
    eventId: string;
    title: string;
    message: string;
};

const validatePayload = (data: PushNotificationPayload): ValidatedPayload => {
    const eventId = typeof data?.eventId === 'string' ? data.eventId.trim() : '';
    const title = typeof data?.title === 'string' ? data.title.trim() : '';
    const message = typeof data?.message === 'string' ? data.message.trim() : '';

    if (!eventId) {
        throw new functions.https.HttpsError('invalid-argument', 'eventId is required.');
    }
    if (!title || title.length > MAX_TITLE_LENGTH) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `Title must be between 1 and ${MAX_TITLE_LENGTH} characters.`,
        );
    }
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
        );
    }

    return { eventId, title, message };
};

const getParticipantUserIds = (participantsSnapshot: admin.firestore.QuerySnapshot): string[] => {
    const userIds = participantsSnapshot.docs
        .map(participant => {
            const participantData = participant.data();
            return typeof participantData.userId === 'string'
                ? participantData.userId
                : participant.id;
        })
        .filter((userId): userId is string => Boolean(userId));

    return [...new Set(userIds)];
};

const getUserDocuments = async (
    db: admin.firestore.Firestore,
    userIds: string[],
): Promise<admin.firestore.DocumentSnapshot[]> => {
    const userDocuments: admin.firestore.DocumentSnapshot[] = [];

    for (let index = 0; index < userIds.length; index += USER_LOOKUP_BATCH_SIZE) {
        const batch = userIds.slice(index, index + USER_LOOKUP_BATCH_SIZE);
        const references = batch.map(userId => db.collection('users').doc(userId));
        const snapshots = await db.getAll(...references);
        userDocuments.push(...snapshots);
    }

    return userDocuments;
};

const countSuccessfulTickets = (tickets: ExpoPushTicket[]) =>
    tickets.filter(ticket => ticket.status === 'ok').length;

export const sendEventPushNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be logged in to send notifications.',
        );
    }

    const { eventId, title, message } = validatePayload(data);
    const db = admin.firestore();
    const eventRef = db.collection('events').doc(eventId);
    const eventSnapshot = await eventRef.get();

    if (!eventSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Event not found.');
    }

    const eventData = eventSnapshot.data() || {};
    const isAdmin = context.auth.token.admin === true;
    const isOwner = eventData.ownerId === context.auth.uid;

    if (!isAdmin && !isOwner) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only the event organizer can notify attendees.',
        );
    }

    if (eventData.deletedAt != null || eventData.status === 'deleted') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Notifications cannot be sent for a deleted event.',
        );
    }

    const participantsSnapshot = await eventRef.collection('participants').get();
    const participantUserIds = getParticipantUserIds(participantsSnapshot);

    const userDocuments = await getUserDocuments(db, participantUserIds);
    const pushTokens = new Set<string>();

    userDocuments.forEach(userDocument => {
        if (!userDocument.exists) return;

        const pushToken = userDocument.data()?.pushToken;
        if (typeof pushToken === 'string' && isExpoPushToken(pushToken)) {
            pushTokens.add(pushToken);
        }
    });

    const messages: ExpoPushMessage[] = [...pushTokens].map(pushToken => ({
        to: pushToken,
        sound: 'default',
        title,
        body: message,
        data: {
            eventId,
            url: `/event/${eventId}`,
            type: 'organizer-update',
        },
    }));

    const tickets = await sendPushNotifications(messages);
    const sentCount = countSuccessfulTickets(tickets);
    const targetedCount = messages.length;
    const failedCount = Math.max(targetedCount - sentCount, 0);
    const skippedCount = Math.max(participantUserIds.length - targetedCount, 0);

    try {
        await eventRef.collection('notificationHistory').add({
            title,
            message,
            sentBy: context.auth.uid,
            participantCount: participantUserIds.length,
            targetedCount,
            sentCount,
            failedCount,
            skippedCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error(`Failed to record notification history for event ${eventId}:`, error);
    }

    return {
        success: true,
        participantCount: participantUserIds.length,
        targetedCount,
        sentCount,
        failedCount,
        skippedCount,
    };
});

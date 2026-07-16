import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

function validateRatings(eventRating?: any, clubRating?: any) {
    if (
        eventRating !== undefined &&
        (typeof eventRating !== 'number' || eventRating < 1 || eventRating > 5)
    ) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid event rating');
    }
    if (
        clubRating !== undefined &&
        (typeof clubRating !== 'number' || clubRating < 1 || clubRating > 5)
    ) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid club rating');
    }
}

async function verifyAttendedUser(eventId: string, userId: string) {
    const checkInSnap = await db
        .collection('events')
        .doc(eventId)
        .collection('checkIns')
        .doc(userId)
        .get();
    if (!checkInSnap.exists) {
        throw new functions.https.HttpsError(
            'permission-denied',
            `User ${userId} did not check in to event ${eventId}`,
        );
    }
}

async function verifyAbsentUser(eventId: string, userId: string) {
    const participantSnap = await db
        .collection('events')
        .doc(eventId)
        .collection('participants')
        .doc(userId)
        .get();
    if (!participantSnap.exists) {
        throw new functions.https.HttpsError(
            'permission-denied',
            `User ${userId} is not registered for event ${eventId}`,
        );
    }
}

function applyFeedbackUpdates(
    batch: admin.firestore.WriteBatch,
    params: {
        eventId: string;
        userId: string;
        attended: boolean;
        eventRating?: number;
        clubRating?: number;
        safeClubId: string;
        safeRequestId?: string;
    },
) {
    const { eventId, userId, attended, eventRating, clubRating, safeClubId, safeRequestId } =
        params;

    const statsUpdate: Record<string, admin.firestore.FieldValue | number> = {
        feedbackCount: admin.firestore.FieldValue.increment(1),
    };

    if (attended) {
        statsUpdate.totalAttendees = admin.firestore.FieldValue.increment(1);
        if (eventRating) {
            statsUpdate.totalEventRating = admin.firestore.FieldValue.increment(eventRating);
            statsUpdate.eventRatingCount = admin.firestore.FieldValue.increment(1);
        }
    } else {
        statsUpdate.totalNoShows = admin.firestore.FieldValue.increment(1);
    }

    const eventRef = db.collection('events').doc(eventId);
    batch.set(eventRef, { stats: statsUpdate }, { merge: true });

    if (attended && clubRating && safeClubId) {
        const clubRef = db.collection('users').doc(safeClubId);
        batch.set(
            clubRef,
            {
                reputation: {
                    totalPoints: admin.firestore.FieldValue.increment(clubRating),
                    totalRatings: admin.firestore.FieldValue.increment(1),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                },
            },
            { merge: true },
        );
    }

    if (attended) {
        const userRef = db.collection('users').doc(userId);
        batch.set(userRef, { points: admin.firestore.FieldValue.increment(5) }, { merge: true });
    }

    if (safeRequestId) {
        const requestRef = db.collection('feedbackRequests').doc(safeRequestId);
        batch.set(
            requestRef,
            {
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
    }
}

async function getAndVerifyEvent(eventId: string, expectedClubId: string) {
    const eventSnap = await db.collection('events').doc(eventId).get();
    if (!eventSnap.exists) {
        throw new functions.https.HttpsError('not-found', `Event ${eventId} not found`);
    }
    const canonicalClubId = eventSnap.data()?.clubId;
    if (canonicalClubId !== expectedClubId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `Club ID mismatch for event ${eventId}`,
        );
    }
    return encodeURIComponent(canonicalClubId);
}

export const onFeedbackSubmit = functions.firestore
    .document('events/{eventId}/feedback/{userId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        if (!data) return;

        const eventId = encodeURIComponent(context.params.eventId);
        const userId = encodeURIComponent(context.params.userId);
        const { attended, eventRating, clubRating, clubId, feedbackRequestId } = data;

        if (typeof clubId !== 'string' || !clubId.trim()) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid clubId');
        }

        let safeRequestId: string | undefined = undefined;
        if (feedbackRequestId !== undefined) {
            if (
                typeof feedbackRequestId !== 'string' ||
                !/^[a-zA-Z0-9_-]+$/.test(feedbackRequestId)
            ) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Invalid feedbackRequestId',
                );
            }
            safeRequestId = encodeURIComponent(feedbackRequestId);
        }

        const safeClubId = await getAndVerifyEvent(eventId, clubId);

        if (safeRequestId) {
            const requestSnap = await db.collection('feedbackRequests').doc(safeRequestId).get();
            if (requestSnap.exists && requestSnap.data()?.userId !== context.params.userId) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    `User ${userId} does not own feedback request ${feedbackRequestId}`,
                );
            }
        }

        if (attended) {
            await verifyAttendedUser(eventId, userId);
        } else {
            await verifyAbsentUser(eventId, userId);
        }

        validateRatings(eventRating, clubRating);

        const batch = db.batch();
        applyFeedbackUpdates(batch, {
            eventId,
            userId,
            attended,
            eventRating,
            clubRating,
            safeClubId,
            safeRequestId,
        });

        try {
            await batch.commit();
            functions.logger.info(
                `Successfully processed feedback for event ${eventId} by user ${userId}`,
            );
        } catch (error) {
            functions.logger.error(
                `Error processing feedback submission for event ${eventId} and user ${userId}:`,
                error,
            );
            throw error;
        }
    });

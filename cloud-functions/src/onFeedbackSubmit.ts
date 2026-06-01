import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export const onFeedbackSubmit = functions.firestore
    .document('events/{eventId}/feedback/{userId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        if (!data) return;

        const eventId = context.params.eventId;
        const userId = context.params.userId;
        const { attended, eventRating, clubRating, clubId, feedbackRequestId } = data;

        // 1. Validate canonical documents
        const eventRef = db.collection('events').doc(eventId);
        const eventSnap = await eventRef.get();
        
        if (!eventSnap.exists) {
            throw new functions.https.HttpsError('not-found', `Event ${eventId} not found`);
        }
        
        if (eventSnap.data()?.clubId !== clubId) {
            throw new functions.https.HttpsError('invalid-argument', `Club ID mismatch for event ${eventId}`);
        }

        if (feedbackRequestId) {
            const requestSnap = await db.collection('feedbackRequests').doc(feedbackRequestId).get();
            if (requestSnap.exists && requestSnap.data()?.userId !== userId) {
                throw new functions.https.HttpsError('permission-denied', `User ${userId} does not own feedback request ${feedbackRequestId}`);
            }
        }

        // Validate rating ranges
        if (eventRating !== undefined && (typeof eventRating !== 'number' || eventRating < 1 || eventRating > 5)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid event rating');
        }
        if (clubRating !== undefined && (typeof clubRating !== 'number' || clubRating < 1 || clubRating > 5)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid club rating');
        }

        const batch = db.batch();

        // 2. Update event stats
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
        batch.set(eventRef, { stats: statsUpdate }, { merge: true });

        // 3. Update club reputation
        if (attended && clubRating && clubId) {
            const clubRef = db.collection('users').doc(clubId);
            batch.set(clubRef, {
                reputation: {
                    totalPoints: admin.firestore.FieldValue.increment(clubRating),
                    totalRatings: admin.firestore.FieldValue.increment(1),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });
        }

        // 4. Award points to user for submitting feedback
        if (attended) {
            const userRef = db.collection('users').doc(userId);
            batch.set(userRef, {
                points: admin.firestore.FieldValue.increment(5)
            }, { merge: true });
        }

        // 5. Mark feedback request as completed
        if (feedbackRequestId) {
            const requestRef = db.collection('feedbackRequests').doc(feedbackRequestId);
            batch.set(requestRef, {
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        try {
            await batch.commit();
            functions.logger.info(`Successfully processed feedback for event ${eventId} by user ${userId}`);
        } catch (error) {
            functions.logger.error(`Error processing feedback submission for event ${eventId} and user ${userId}:`, error);
            throw error;
        }
    });

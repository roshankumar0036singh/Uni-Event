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

        const batch = db.batch();

        // 1. Update event stats
        const eventRef = db.collection('events').doc(eventId);
        const statsUpdate: any = {
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

        // 2. Update club reputation
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

        // 3. Award points to user for submitting feedback
        if (attended) {
            const userRef = db.collection('users').doc(userId);
            batch.set(userRef, {
                points: admin.firestore.FieldValue.increment(5)
            }, { merge: true });
        }

        // 4. Mark feedback request as completed
        if (feedbackRequestId) {
            const requestRef = db.collection('feedbackRequests').doc(feedbackRequestId);
            batch.set(requestRef, {
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        try {
            await batch.commit();
            console.log(`Successfully processed feedback for event ${eventId} by user ${userId}`);
        } catch (error) {
            console.error('Error processing feedback submission:', error);
        }
    });

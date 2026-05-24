import { doc, increment, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Submit feedback for a completed event
 */
export const submitFeedback = async ({
    feedbackRequestId,
    eventId,
    clubId,
    userId,
    attended,
    eventRating,
    clubRating,
    feedback,
}) => {
    try {
        await runTransaction(db, async transaction => {
            // 1. Read before writing to ensure feedback doesn't already exist
            const feedbackRef = doc(db, 'events', eventId, 'feedback', userId);
            const feedbackDoc = await transaction.get(feedbackRef);

            if (feedbackDoc.exists()) {
                throw new Error('Feedback already submitted for this event.');
            }

            // 2. Save feedback
            transaction.set(feedbackRef, {
                userId,
                attended,
                eventRating: attended ? eventRating : null,
                clubRating: attended ? clubRating : null,
                feedback: attended ? feedback : null,
                submittedAt: serverTimestamp(),
                eventId,
                clubId,
            });

            // 3. Update event stats
            const eventRef = doc(db, 'events', eventId);
            const statsUpdate = {
                feedbackCount: increment(1),
            };

            if (attended) {
                statsUpdate.totalAttendees = increment(1);
                if (eventRating) {
                    statsUpdate.totalEventRating = increment(eventRating);
                    statsUpdate.eventRatingCount = increment(1);
                }
            } else {
                statsUpdate.totalNoShows = increment(1);
            }

            transaction.set(eventRef, { stats: statsUpdate }, { merge: true });

            // 4. Update club reputation
            if (attended && clubRating) {
                const clubRef = doc(db, 'users', clubId);
                const clubDoc = await transaction.get(clubRef);

                if (clubDoc.exists()) {
                    transaction.update(clubRef, {
                        'reputation.totalPoints': increment(clubRating),
                        'reputation.totalRatings': increment(1),
                        'reputation.lastUpdated': serverTimestamp(),
                    });
                } else {
                    transaction.set(
                        clubRef,
                        {
                            reputation: {
                                totalPoints: clubRating,
                                totalRatings: 1,
                                lastUpdated: serverTimestamp(),
                            },
                        },
                        { merge: true },
                    );
                }
            }

            // 5. Award points to user
            if (attended) {
                const userRef = doc(db, 'users', userId);
                transaction.update(userRef, {
                    points: increment(5),
                });
            }

            // 6. Mark feedback request as completed
            if (feedbackRequestId) {
                const requestRef = doc(db, 'feedbackRequests', feedbackRequestId);
                transaction.update(requestRef, {
                    status: 'completed',
                    completedAt: serverTimestamp(),
                });
            }
        });

        console.log('Feedback submitted successfully');
        return { success: true };
    } catch (error) {
        console.error('Error submitting feedback:', error);
        throw error;
    }
};

/**
 * Calculate average rating from reputation data
 */
export const calculateAverageRating = reputation => {
    if (!reputation || !reputation.totalRatings || reputation.totalRatings === 0) {
        return 0;
    }
    return (reputation.totalPoints / reputation.totalRatings).toFixed(1);
};

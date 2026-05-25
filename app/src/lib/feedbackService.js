import { doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
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
    const batch = writeBatch(db);

    try {
        // 1. Save feedback to event's feedback subcollection
        const feedbackRef = doc(db, 'events', eventId, 'feedback', userId);
        batch.set(feedbackRef, {
            userId,
            attended,
            eventRating: attended ? eventRating : null,
            clubRating: attended ? clubRating : null,
            feedback: attended ? feedback : null,
            submittedAt: serverTimestamp(),
            eventId,
            clubId,
        });

        // 2. Update event stats
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

        // Use set with merge to ensure 'stats' map is created if it doesn't exist
        batch.set(eventRef, { stats: statsUpdate }, { merge: true });

        // 3. Update club reputation (if attended and rated)
        if (attended && clubRating) {
            const clubRef = doc(db, 'users', clubId);

            // Use setDoc with merge to handle missing documents
            const clubDoc = await getDoc(clubRef);
            if (clubDoc.exists()) {
                batch.update(clubRef, {
                    'reputation.totalPoints': increment(clubRating),
                    'reputation.totalRatings': increment(1),
                    'reputation.lastUpdated': serverTimestamp(),
                });
            } else {
                // If club document doesn't exist, create it with reputation
                batch.set(
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

        // 4. Award points to user for submitting feedback
        if (attended) {
            const userRef = doc(db, 'users', userId);
            batch.update(userRef, {
                points: increment(5), // Award 5 points for giving feedback
            });
        }

        // 5. Mark feedback request as completed
        if (feedbackRequestId) {
            const requestRef = doc(db, 'feedbackRequests', feedbackRequestId);
            batch.update(requestRef, {
                status: 'completed',
                completedAt: serverTimestamp(),
            });
        }

        // Commit all changes
        await batch.commit();
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

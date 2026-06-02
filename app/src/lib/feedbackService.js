import logger from './logger';
import { doc, serverTimestamp, runTransaction } from 'firebase/firestore';
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
        const feedbackRef = doc(db, 'events', eventId, 'feedback', userId);

        const payload = {
            userId,
            attended,
            eventRating: attended ? eventRating : null,
            clubRating: attended ? clubRating : null,
            feedback: attended ? feedback : null,
            submittedAt: serverTimestamp(),
            eventId,
            clubId,
        };

        if (feedbackRequestId) {
            payload.feedbackRequestId = feedbackRequestId;
        }

        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(feedbackRef);
            if (snap.exists()) {
                throw new Error('Feedback already submitted');
            }
            transaction.set(feedbackRef, payload);
        });

        logger.debug('Feedback submitted successfully');
        return { success: true };
    } catch (error) {
        logger.error('Error submitting feedback:', error);
        throw error;
    }
};

/**
 * Calculate average rating from reputation data
 */
export const calculateAverageRating = reputation => {
    if (!reputation) {
        return 0;
    }

    const decayedRatings = Number(reputation.decayedRatings || 0);
    const decayedPoints = Number(reputation.decayedPoints || 0);
    if (decayedRatings > 0) {
        return Number((decayedPoints / decayedRatings).toFixed(1));
    }

    const totalRatings = Number(reputation.totalRatings || 0);
    const totalPoints = Number(reputation.totalPoints || 0);
    if (totalRatings > 0) {
        return Number((totalPoints / totalRatings).toFixed(1));
    }

    return 0;
};

/**
 * Calculate the display count for total ratings, falling back to decayedRatings if necessary
 */
export const calculateDisplayCount = reputation => {
    if (!reputation) return 0;

    if (reputation.totalRatings > 0) {
        return Number(reputation.totalRatings);
    }

    // Fallback: if totalRatings is missing but we have decayed ratings, estimate count
    if (reputation.decayedRatings > 0) {
        return Math.ceil(Number(reputation.decayedRatings));
    }

    return 0;
};

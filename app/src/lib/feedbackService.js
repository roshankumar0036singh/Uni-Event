import logger from './logger';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
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

        await setDoc(feedbackRef, payload);
        
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
    if (!reputation || !reputation.totalRatings || reputation.totalRatings === 0) {
        return 0;
    }
    return (reputation.totalPoints / reputation.totalRatings).toFixed(1);
};

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';
import logger from './logger';

export const sendEventPushNotification = async (eventId, title, message) => {
    try {
        const sendNotification = httpsCallable(functions, 'sendEventPushNotification');
        const response = await sendNotification({
            eventId,
            title: title.trim(),
            message: message.trim(),
        });

        return response.data;
    } catch (error) {
        logger.error('Failed to send event push notification:', error);
        throw error;
    }
};

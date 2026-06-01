import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import logger from './logger';

// Configure how notifications behave when the app is in the foreground
// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

async function getWebPushToken() {
    try {
        const { getWebMessaging, VAPID_KEY } = require('./firebaseConfig');
        const { getToken } = require('firebase/messaging');
        const messaging = await getWebMessaging();

        if (!messaging) {
            logger.info('Firebase Messaging is not supported in this browser.');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            logger.info('Web Notification permission denied');
            return;
        }

        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register(
                '/firebase-messaging-sw.js',
            );
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration,
            });
            logger.debug('Web Push Token:', token);
            return token;
        }
    } catch (e) {
        logger.error('Error getting web push token:', e);
    }
}

async function getDevicePushToken() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        logger.info('Failed to get push token for push notification!');
        return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
        logger.info(
            'No EAS Project ID found. Push notifications will not work, but local reminders will.',
        );
        return;
    }

    try {
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        return token;
    } catch (e) {
        logger.error('Error getting push token:', e);
    }
}

// Request permissions and get the push token
export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Platform.OS === 'web') {
        return getWebPushToken();
    }

    if (!Device.isDevice) {
        logger.info('Must use physical device for Push Notifications');
        return;
    }

    return getDevicePushToken();
}

// Schedule a local notification
export async function scheduleEventReminder(event) {
    if (!event?.startAt) return;

    const eventDate = new Date(event.startAt);
    const triggerDate = new Date(eventDate.getTime() - 10 * 60000); // 10 minutes before

    // If the event is already less than 10 mins away (or passed), don't schedule, or schedule immediately?
    // Let's schedule immediately if within 10 mins but not passed, otherwise skip.
    // For simplicity, strict 10 mins before rule, or immediately if between now and start.
    const now = new Date();
    if (triggerDate <= now) {
        if (eventDate > now) {
            // Event is soon, trigger soon (e.g., 5 seconds from now)
            if (Platform.OS === 'web') {
                logger.debug('Simulating immediate notification on web');
                return 'web-mock-id-immediate-' + event.id;
            }
            return await Notifications.scheduleNotificationAsync({
                content: {
                    title: `Reminder: ${event.title}`,
                    body: `Your event starts in less than 10 minutes!`,
                    data: { eventId: event.id },
                },
                trigger: { seconds: 2 },
            });
        }
        return null; // Already passed
    }

    if (isNaN(triggerDate.getTime())) {
        logger.error('Invalid event date:', event.startAt);
        return null;
    }

    logger.debug(`Scheduling for: ${triggerDate.toLocaleString()} (Now: ${now.toLocaleString()})`);

    if (Platform.OS === 'web') {
        logger.debug('Local notifications scheduled (simulated on web):', {
            title: `App Reminder: ${event.title}`,
            trigger: triggerDate,
        });
        // For web, we could return a mock ID or use Notification API directly,
        // but preventing crash is priority.
        return 'web-mock-id-' + event.id;
    }

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: `App Reminder: ${event.title}`,
            body: `Starting at ${eventDate.toLocaleTimeString()} (in 10 mins).`,
            data: { eventId: event.id },
            sound: true,
        },
        trigger: { date: triggerDate },
    });

    logger.debug('Scheduled notification ID:', id);
    return id;
}

// Debug function to trigger immediately
export async function testNotification() {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Test Notification',
            body: 'This is a test notification to verify permissions.',
        },
        trigger: null, // immediate
    });
}

// Clear all pending notifications
export async function cancelAllNotifications() {
    if (Platform.OS === 'web') {
        logger.debug('Cancelled all notifications (simulated on web)');
        return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    logger.debug('All scheduled notifications cancelled');
}

export async function cancelScheduledNotification(id) {
    if (!id) return;
    if (Platform.OS === 'web') {
        logger.debug('Cancelled notification (simulated on web):', id);
        return;
    }
    await Notifications.cancelScheduledNotificationAsync(id);
    logger.debug('Cancelled notification:', id);
}
export async function triggerBuddyMatchNotification(event, matchCount) {
    if (!event) return;

    const title = 'Buddy Match Found!';
    const body =
        matchCount === 1
            ? `1 student is also looking for a buddy at "${event.title}"!`
            : `${matchCount} students are also looking for buddies at "${event.title}"!`;

    if (Platform.OS === 'web') {
        logger.debug('Buddy match notification (simulated on web):', { title, body });
        // Use browser Notification API if permission was granted
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
        return 'web-buddy-' + event.id;
    }

    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: { eventId: event.id, type: 'buddy_match' },
                sound: true,
            },
            trigger: null,
        });
        logger.debug('Buddy match notification sent:', id);
        return id;
    } catch (error) {
        logger.error('Error sending buddy match notification:', error);
        return null;
    }
}

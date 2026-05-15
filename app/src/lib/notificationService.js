import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications behave when the app is in the foreground
// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// Request permissions and get the push token
export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Platform.OS === 'web') {
        try {
            const { messaging, VAPID_KEY } = require('./firebaseConfig');
            const { getToken } = require('firebase/messaging');

            // Request permission specifically for Web
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                // Register SW explicitly
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.register(
                        '/firebase-messaging-sw.js',
                    );
                    token = await getToken(messaging, {
                        vapidKey: VAPID_KEY,
                        serviceWorkerRegistration: registration,
                    });
                    console.log('Web Push Token:', token);
                }
            } else {
                console.log('Web Notification permission denied');
            }
        } catch (e) {
            console.error('Error getting web push token:', e);
        }
        return token;
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        // Get the token using the project ID from app config
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            console.log(
                'No EAS Project ID found. Push notifications will not work, but local reminders will.',
            );
        } else {
            try {
                token = (
                    await Notifications.getExpoPushTokenAsync({
                        projectId: projectId,
                    })
                ).data;
            } catch (e) {
                console.error('Error getting push token:', e);
            }
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

// Schedule a local notification
export async function scheduleEventReminder(event) {
    if (!event || !event.startAt) return;

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
                console.log('Simulating immediate notification on web');
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
        console.error('Invalid event date:', event.startAt);
        return null;
    }

    console.log(`Scheduling for: ${triggerDate.toLocaleString()} (Now: ${now.toLocaleString()})`);

    if (Platform.OS === 'web') {
        console.log('Local notifications scheduled (simulated on web):', {
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

    console.log('Scheduled notification ID:', id);
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
        console.log('Cancelled all notifications (simulated on web)');
        return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All scheduled notifications cancelled');
}

export async function cancelScheduledNotification(id) {
    if (!id) return;
    if (Platform.OS === 'web') {
        console.log('Cancelled notification (simulated on web):', id);
        return;
    }
    await Notifications.cancelScheduledNotificationAsync(id);
    console.log('Cancelled notification:', id);
}

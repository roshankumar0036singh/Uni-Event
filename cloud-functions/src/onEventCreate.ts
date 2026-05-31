import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from 'firebase-admin/firestore';

const { Expo } = require('expo-server-sdk');
const expo = new Expo();

export const onEventCreate = functions.firestore
  .document("events/{eventId}")
  .onCreate(async (snapshot, context) => {
    const eventId = context.params.eventId;
    const eventData = snapshot.data();

    if (!eventData) return;

    console.log(`New event created: ${eventId}`, eventData.title);

    const db = admin.firestore();

    // Initialize metrics
    await snapshot.ref.update({
      metrics: {
        views: 0,
        remindersSet: 0,
        registrations: 0,
        attendance: 0,
      },
    });

    // Broadcast Notification Logic
    // Fetch all users with push tokens
    // Ideally use topics or pagination for large user bases
    const usersSnapshot = await db.collection('users').get();
    
    const messages: any[] = [];
    const batch = db.batch();

    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        
        // 1. In-App Notification
        const notifRef = userDoc.ref.collection('notifications').doc();
        batch.set(notifRef, {
            title: 'New Event Alert! 📢',
            body: `Check out: "${eventData.title}"`,
            eventId: eventId,
            createdAt: FieldValue.serverTimestamp(),
            read: false
        });

        // 2. Push Notification
        const pushToken = userData.pushToken;
        if (pushToken && Expo.isExpoPushToken(pushToken)) {
            messages.push({
                to: pushToken,
                sound: 'default',
                title: 'New Event Alert! 📢',
                body: `New Event: ${eventData.title}`,
                data: { eventId: eventId, url: `/event/${eventId}` },
            });
        }
    });

    await batch.commit();

    // Send Push Notifications
    if (messages.length > 0) {
        let chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
            } catch (error) {
                console.error("Error sending chunks", error);
            }
        }
    }
    console.log(`Sent notifications to ${usersSnapshot.size} users.`);
  });

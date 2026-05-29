import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { sendPushNotifications } from './utils/push';
const { Expo } = require('expo-server-sdk');

/**
 * Scheduled function to check for reminders.
 * Runs every minute.
 */
export const checkReminders = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    // Find reminders that need to be sent (remindAt <= now) and haven't been sent yet
    const remindersRef = db.collection('reminders');
    const q = remindersRef.where('remindAt', '<=', now).where('sent', '==', false);
    
    const snapshot = await q.get();
    
    if (snapshot.empty) {
        return null;
    }
    
    const batch = db.batch();
    const messages = [];
    
    // We need to fetch user tokens
    // To handle many reminders, we might need efficient querying, but loop is fine for now 
    for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const userId = data.userId;
        
        // 1. Create in-app notification
        const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            title: 'Event Reminder',
            body: `Your event is starting soon!`,
            eventId: data.eventId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        // 2. Prepare Push Notification
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
             const userData = userDoc.data();
             const pushToken = userData?.pushToken;
             
             if (pushToken && Expo.isExpoPushToken(pushToken)) {
                 messages.push({
                    to: pushToken,
                    sound: 'default',
                    title: 'Event Reminder ⏰',
                    body: `Your event is starting!`,
                    data: { eventId: data.eventId, url: `/event/${data.eventId}` },
                 });
             }
        }

        // 3. Mark reminder as sent
        batch.update(docSnapshot.ref, { sent: true });
    }
    
    // Send Pushes
    if (messages.length > 0) {
        await sendPushNotifications(messages);
    }
    
    await batch.commit();
    console.log(`Processed ${snapshot.size} reminders.`);
    return null;
});

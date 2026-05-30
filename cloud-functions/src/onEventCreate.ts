import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const BATCH_SIZE = 500;

interface BatchResult {
  count: number;
  lastDoc: admin.firestore.DocumentSnapshot | undefined;
}

async function processUserBatch(
  db: admin.firestore.Firestore,
  eventId: string,
  eventTitle: string,
  startAfter?: admin.firestore.DocumentSnapshot
): Promise<BatchResult> {
  let query = db.collection('users')
    .select('pushToken')
    .limit(BATCH_SIZE);

  if (startAfter) {
    query = query.startAfter(startAfter);
  }

  const snapshot = await query.get();
  if (snapshot.empty) return { count: 0, lastDoc: undefined };

  const messages: any[] = [];
  const batch = db.batch();

  snapshot.forEach(userDoc => {
    const pushToken = userDoc.get('pushToken');

    const notifRef = userDoc.ref.collection('notifications').doc();
    batch.set(notifRef, {
      title: 'New Event Alert! 📢',
      body: `Check out: "${eventTitle}"`,
      eventId: eventId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    if (pushToken && Expo.isExpoPushToken(pushToken)) {
      messages.push({
        to: pushToken,
        sound: 'default',
        title: 'New Event Alert! 📢',
        body: `New Event: ${eventTitle}`,
        data: { eventId: eventId, url: `/event/${eventId}` },
      });
    }
  });

  await batch.commit();

  if (messages.length > 0) {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Error sending chunk", error);
      }
    }
  }

  return {
    count: snapshot.size,
    lastDoc: snapshot.docs[snapshot.docs.length - 1],
  };
}

export const onEventCreate = functions.firestore
  .document("events/{eventId}")
  .onCreate(async (snapshot, context) => {
    const eventId = context.params.eventId;
    const eventData = snapshot.data();

    if (!eventData) return;

    const title = eventData.title || 'Untitled Event';
    console.log(`New event created: ${eventId}`, title);

    const db = admin.firestore();

    await snapshot.ref.update({
      metrics: {
        views: 0,
        remindersSet: 0,
        registrations: 0,
        attendance: 0,
      },
    });

    let totalProcessed = 0;
    let cursor: admin.firestore.DocumentSnapshot | undefined;

    do {
      const result = await processUserBatch(db, eventId, title, cursor);
      totalProcessed += result.count;
      cursor = result.lastDoc;
    } while (cursor);

    console.log(`Sent notifications to ${totalProcessed} users.`);
  });

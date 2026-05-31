import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from 'firebase-admin/firestore';
import { sendPushNotifications } from "./utils/push";

const BATCH_SIZE = 500;

interface BatchResult {
  count: number;
  hasMore: boolean;
  cursor: admin.firestore.DocumentSnapshot | undefined;
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
  if (snapshot.empty) return { count: 0, hasMore: false, cursor: undefined };

  const messages: any[] = [];
  const batch = db.batch();

  snapshot.forEach(userDoc => {
    const pushToken = userDoc.get('pushToken');

    if (pushToken) {
      const notifRef = userDoc.ref.collection('notifications').doc(`${eventId}_${userDoc.id}`);
      batch.set(notifRef, {
        title: 'New Event Alert! 📢',
        body: `Check out: "${eventTitle}"`,
        eventId: eventId,
        createdAt: FieldValue.serverTimestamp(),
        read: false
      });
    }
  });

  // Collect push messages before committing the batch so push failures
  // don't leave partial in-app notifications.
  snapshot.forEach(userDoc => {
    const pushToken = userDoc.get('pushToken');
    if (pushToken) {
      messages.push({
        to: pushToken,
        sound: 'default',
        title: 'New Event Alert! 📢',
        body: `New Event: ${eventTitle}`,
        data: { eventId: eventId, url: `/event/${eventId}` },
      });
    }
  });

  await sendPushNotifications(messages);
  await batch.commit();

  const hasMore = snapshot.size === BATCH_SIZE;
  return {
    count: snapshot.size,
    hasMore,
    cursor: hasMore ? snapshot.docs[snapshot.docs.length - 1] : undefined,
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
    let hasMore = true;

    while (hasMore) {
      const result = await processUserBatch(db, eventId, title, cursor);
      totalProcessed += result.count;
      hasMore = result.hasMore;
      cursor = result.cursor;
    }

    console.log(`Sent notifications to ${totalProcessed} users.`);
  });

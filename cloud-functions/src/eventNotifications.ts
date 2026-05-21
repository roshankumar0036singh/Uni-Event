import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const expo = new Expo();
const db = admin.firestore();

export const checkUpcomingEvents = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    const startRange = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endRange   = new Date(Date.now() + 11 * 60 * 1000).toISOString();

    const eventsSnapshot = await db.collection('events')
      .where('startAt',  '>=', startRange)
      .where('startAt',  '<=', endRange)
      .where('status',   '==', 'active')
      .where('notified10Min', '==', false) 
      .get();

    if (eventsSnapshot.empty) return null;

    const batch = db.batch();

    for (const eventDoc of eventsSnapshot.docs) {
      const claimed = await claimEventForNotification(eventDoc.id);
      if (!claimed) {
        console.log(`Event ${eventDoc.id} already claimed by another run, skipping.`);
        continue;
      }


      const topic = db.collection('notificationJobs').doc();
      batch.set(topic, {
        eventId:   eventDoc.id,
        eventTitle: eventDoc.data().title,
        status:    'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    return null;
  });



async function claimEventForNotification(eventId: string): Promise<boolean> {
  const eventRef = db.collection('events').doc(eventId);

  try {
    await db.runTransaction(async (tx) => {
      const eventDoc = await tx.get(eventRef);
      if (!eventDoc.exists) throw new Error('not-found');

      const data = eventDoc.data()!;
      if (data.notified10Min === true) throw new Error('already-claimed');

      tx.update(eventRef, {
        notified10Min:   true,
        notifiedAt:      admin.firestore.FieldValue.serverTimestamp(),
        notifiedByRunAt: new Date().toISOString(),
      });
    });
    return true; 
  } catch (e: any) {
    if (e.message === 'already-claimed' || e.message === 'not-found') {
      return false;
    }
    throw e; 
  }
}

export const processNotificationJob = functions.firestore
  .document('notificationJobs/{jobId}')
  .onCreate(async (snap, context) => {
    const job     = snap.data();
    const eventId = job.eventId;
    const title   = job.eventTitle;

    try {
      await sendNotificationsForEvent(eventId, title);
      await snap.ref.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error(`Failed to process job for event ${eventId}:`, err);
      await snap.ref.update({ status: 'failed', error: String(err) });
    }
  });


async function sendNotificationsForEvent(eventId: string, eventTitle: string) {
  const participantsSnap = await db
    .collection(`events/${eventId}/participants`)
    .get();

  if (participantsSnap.empty) return;


  const tokensFromParticipants = participantsSnap.docs
    .map(doc => doc.data().pushToken as string | undefined)
    .filter((t): t is string => !!t && Expo.isExpoPushToken(t));


  let tokensFromUsers: string[] = [];
  const participantIdsWithoutToken = participantsSnap.docs
    .filter(doc => !doc.data().pushToken)
    .map(doc => doc.id);

  if (participantIdsWithoutToken.length > 0) {
    tokensFromUsers = await fetchTokensInChunks(participantIdsWithoutToken);
  }

  const allTokens = [...tokensFromParticipants, ...tokensFromUsers];
  if (allTokens.length === 0) return;


  const messages: ExpoPushMessage[] = allTokens.map(token => ({
    to:    token,
    sound: 'default',
    title: 'Event Starting Soon! 🕐',
    body:  `${eventTitle} is starting in 10 minutes.`,
    data:  { eventId, url: `/event/${eventId}` },
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      receipts.forEach(r => {
        if (r.status === 'error') {
          console.warn('Push error:', r.message, r.details);
        }
      });
    } catch (err) {
      console.error('Chunk send failed:', err);
    }
  }
}


async function fetchTokensInChunks(userIds: string[]): Promise<string[]> {
  const CHUNK_SIZE = 30;
  const chunks: string[][] = [];

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    chunks.push(userIds.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(chunk =>
      db.collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .select('pushToken') 
        .get()
    )
  );

  return results
    .flatMap(snap => snap.docs)
    .map(doc => doc.data().pushToken as string | undefined)
    .filter((t): t is string => !!t && Expo.isExpoPushToken(t));
}
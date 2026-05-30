import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const CLEANUP_DAYS = 30;

export const permanentCleanup = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const cutoff = admin.firestore.Timestamp.fromMillis(
      Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000
    );

    let totalDeleted = 0;

    try {
      let lastDoc: admin.firestore.DocumentSnapshot | null = null;
      let hasMore = true;

      while (hasMore) {
        let query: admin.firestore.Query = db
          .collection("events")
          .where("deletedAt", "<", cutoff)
          .orderBy("__name__")
          .limit(500);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const eventsSnapshot = await query.get();
        hasMore = eventsSnapshot.docs.length === 500;
        let batch = db.batch();
        let operationCount = 0;

        for (const eventDoc of eventsSnapshot.docs) {
          const eventData = eventDoc.data();
          if (eventData?.ownerId) {
            const ownerRef = db.collection("users").doc(eventData.ownerId);
            batch.update(ownerRef, { eventCount: admin.firestore.FieldValue.increment(-1) });
          }
          batch.delete(eventDoc.ref);
          operationCount++;
        }

        if (operationCount > 0) {
          await batch.commit();
          totalDeleted += operationCount;
        }

        if (hasMore) {
          lastDoc = eventsSnapshot.docs[eventsSnapshot.docs.length - 1];
        }
      }
    } catch (error) {
      console.error(`Permanent cleanup failed after deleting ${totalDeleted} events:`, error);
      throw error;
    }

    console.log(`Permanent cleanup completed. Removed ${totalDeleted} events.`);
  });

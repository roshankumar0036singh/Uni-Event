import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export const permanentCleanup = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let totalDeleted = 0;

    try {
      let lastDoc: admin.firestore.DocumentSnapshot | null = null;
      let hasMore = true;

      while (hasMore) {
        let query: admin.firestore.Query = db
          .collection("events")
          .where("deletedAt", "<", ninetyDaysAgo)
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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export const permanentCleanup = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const eventsSnapshot = await db
      .collection("events")
      .where("deletedAt", "<", ninetyDaysAgo)
      .get();

    let batch = db.batch();
    let operationCount = 0;

    for (const eventDoc of eventsSnapshot.docs) {
      batch.delete(eventDoc.ref);
      operationCount++;

      if (operationCount === 500) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Permanent cleanup completed. Removed ${eventsSnapshot.size} events.`);
    return null;
  });

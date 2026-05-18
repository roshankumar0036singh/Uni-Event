import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export const detectInactiveUsers = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {

    const db = admin.firestore();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usersSnapshot = await db.collection("users").get();

    const batch = db.batch();

    for (const userDoc of usersSnapshot.docs) {

      const userData = userDoc.data();

      // Skip users without lastActive
      if (!userData.lastActive) {
        continue;
      }

      let lastActiveDate: Date;

      // Firestore Timestamp support
      if (typeof userData.lastActive.toDate === "function") {
        lastActiveDate = userData.lastActive.toDate();
      } else {
        lastActiveDate = new Date(userData.lastActive);
      }

      const isInactive = lastActiveDate < thirtyDaysAgo;

      batch.update(userDoc.ref, {
        isInactive,
        inactiveSince: isInactive
          ? admin.firestore.FieldValue.serverTimestamp()
          : null,
      });
    }

    await batch.commit();

    console.log("Inactive users scan completed.");

    return null;
  });
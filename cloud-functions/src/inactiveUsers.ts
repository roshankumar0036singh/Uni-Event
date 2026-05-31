import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from 'firebase-admin/firestore';

function getLastActiveDate(lastActive: any): Date {
    if (typeof lastActive.toDate === "function") {
      return lastActive.toDate();
    }
  
    return new Date(lastActive);
  }
  

export const detectInactiveUsers = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {

    const db = admin.firestore();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usersSnapshot = await db.collection("users").get();

    let batch = db.batch();
    let operationCount = 0;

    for (const userDoc of usersSnapshot.docs) {

      const userData = userDoc.data();

      // Skip users without lastActive
      if (!userData.lastActive) {
        continue;
      }

      const lastActiveDate = getLastActiveDate(userData.lastActive);

      const isInactive = lastActiveDate < thirtyDaysAgo;

      const updateData: any = {
        isInactive,
      };
      
      if (isInactive) {
        if (!userData.inactiveSince) {
          updateData.inactiveSince =
            FieldValue.serverTimestamp();
        }
      } else {
        updateData.inactiveSince = null;
      }
      
      batch.update(userDoc.ref, updateData);
      operationCount++;

        if (operationCount === 500) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
    }
    }

    try {
        if (operationCount > 0) {
          await batch.commit();
        }
      
        console.log("Inactive users scan completed.");
      
      } catch (error) {
        console.error("Error committing inactivity batch:", error);
      }


    return null;
  });
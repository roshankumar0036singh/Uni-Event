import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { awardDedicatedStudentCertificate } from "./dedicatedStudentCertificate";
import { Timestamp } from "@google-cloud/firestore";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const attendanceStreak = onDocumentCreated(
  "events/{eventId}/checkIns/{userId}",
  async (event) => {
    const userId = event.data?.data()?.userId;
    
    if (!userId) {
      console.error("No userId in checkIn document");
      return;
    }
    
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists) {
        return;
      }

      const user = userSnap.data() || {};

      const currentStreak: number = user.currentStreak || 0;
      const longestStreak: number = user.longestStreak || 0;
      const lastAttendanceAt: admin.firestore.Timestamp | null =
        user.lastAttendanceAt || null;

      const now = Timestamp.fromDate(new Date());

      let newStreak = 1;

      if (lastAttendanceAt) {
        const diffMs = now.toMillis() - lastAttendanceAt.toMillis();

        console.log("diffMs:", diffMs);

        if (diffMs < WEEK_MS) {
          //already attended within current 7-day window
          return;
        } else if (diffMs < WEEK_MS * 2) {
          //attended during the next consecutive week
          newStreak = currentStreak + 1;
        } else {
          //missed a week -> streak resets to 1
          newStreak = 1;
        }
      }

      const newLongestStreak = Math.max(longestStreak, newStreak);

      tx.update(userRef, {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastAttendanceAt: now,
      });

      console.log("previous currentStreak:", currentStreak);
      console.log("lastAttendanceAt:", lastAttendanceAt);
      console.log("newStreak:", newStreak);
      console.log("newLongestStreak:", newLongestStreak);
    });

    //dedicated student certificate award
    const db2 = admin.firestore();
    const updatedSnap = await db2.collection("users").doc(userId).get();
    const updatedStreak: number = updatedSnap.data()?.currentStreak || 0;

    if (updatedStreak >= 4) {
      await awardDedicatedStudentCertificate(userId);
    }
  }
);
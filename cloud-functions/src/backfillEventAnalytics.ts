import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldPath } from 'firebase-admin/firestore';
import { enforceAppCheck } from "./middleware/appCheck";

const normalizeCounterKey = (value: unknown) => {
  if (value == null) return "Unknown";
  if (typeof value !== "string" && typeof value !== "number") return "Unknown";
  const raw = String(value).trim();
  if (!raw) return "Unknown";
  return raw.replace(/[./#[\]$]/g, "_");
};

export const backfillEventAnalyticsCounters = functions.https.onCall(
  async (data, context) => {
    if (!context.auth?.token?.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin privileges required."
      );
    }
    enforceAppCheck(context);

    const db = admin.firestore();
    const limit = Math.min(Math.max(Number(data?.limit) || 25, 1), 100);
    const startAfterId = typeof data?.startAfterId === "string" ? data.startAfterId : null;

    let query = db
      .collection("events")
      .orderBy(FieldPath.documentId())
      .limit(limit);

    if (startAfterId) {
      const startSnap = await db.collection("events").doc(startAfterId).get();
      if (!startSnap.exists) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "startAfterId does not exist."
        );
      }
      query = query.startAfter(startSnap);
    }

    const eventSnap = await query.get();
    let updated = 0;

    for (const docSnap of eventSnap.docs) {
      const eventData = docSnap.data() || {};
      const missingCounters =
        eventData.participantCount == null ||
        eventData.branchCounts == null ||
        eventData.yearCounts == null;

      if (!missingCounters) continue;

      const participantsSnap = await docSnap.ref.collection("participants").get();
      const participantCount = participantsSnap.size;
      const branchCounts: Record<string, number> = {};
      const yearCounts: Record<string, number> = {};

      participantsSnap.forEach(participantDoc => {
        const participant = participantDoc.data() || {};
        const branchKey = normalizeCounterKey(participant.branch);
        const yearKey = normalizeCounterKey(participant.year);

        branchCounts[branchKey] = (branchCounts[branchKey] || 0) + 1;
        yearCounts[yearKey] = (yearCounts[yearKey] || 0) + 1;
      });

      const updatePayload: Record<string, unknown> = {
        participantCount,
        branchCounts,
        yearCounts,
      };

      if (eventData.stats?.totalRegistrations == null) {
        updatePayload["stats.totalRegistrations"] = participantCount;
      }

      await docSnap.ref.set(updatePayload, { merge: true });
      updated += 1;
    }

    const lastDoc = eventSnap.docs[eventSnap.docs.length - 1];

    return {
      processed: eventSnap.size,
      updated,
      lastId: lastDoc ? lastDoc.id : null,
    };
  }
);

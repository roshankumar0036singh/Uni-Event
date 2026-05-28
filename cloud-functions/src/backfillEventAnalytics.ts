import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

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

    const db = admin.firestore();
    const limit = Math.min(Math.max(Number(data?.limit) || 25, 1), 100);
    const startAfterId = typeof data?.startAfterId === "string" ? data.startAfterId : null;
    const pageSize = 100;

    let query = db
      .collection("events")
      .orderBy(admin.firestore.FieldPath.documentId())
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
      const eventStartedAt = Date.now();
      const eventData = docSnap.data() || {};
      const missingCounters =
        eventData.participantCount == null ||
        eventData.branchCounts == null ||
        eventData.yearCounts == null ||
        eventData.stats?.attendeeCount == null ||
        eventData.stats?.showUpRatio == null;

      if (!missingCounters) continue;

      const branchCounts: Record<string, number> = {};
      const yearCounts: Record<string, number> = {};
      let participantCount = 0;

      let lastParticipantSnap: admin.firestore.DocumentSnapshot | null = null;

      while (true) {
        let participantsQuery = docSnap.ref
          .collection("participants")
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(pageSize);

        if (lastParticipantSnap) {
          participantsQuery = participantsQuery.startAfter(lastParticipantSnap);
        }

        const participantsSnap = await participantsQuery.get();

        if (participantsSnap.empty) {
          break;
        }

        participantCount += participantsSnap.size;

        participantsSnap.forEach(participantDoc => {
          const participant = participantDoc.data() || {};
          const branchKey = normalizeCounterKey(participant.branch);
          const yearKey = normalizeCounterKey(participant.year);

          branchCounts[branchKey] = (branchCounts[branchKey] || 0) + 1;
          yearCounts[yearKey] = (yearCounts[yearKey] || 0) + 1;
        });

        lastParticipantSnap = participantsSnap.docs[participantsSnap.docs.length - 1];

        if (participantsSnap.size < pageSize) {
          break;
        }
      }

      const checkedInCount = Number(eventData.stats?.totalCheckedIn || 0);
      const showUpRatio = participantCount > 0 ? checkedInCount / participantCount : 0;

      const updatePayload: Record<string, unknown> = {
        participantCount,
        branchCounts,
        yearCounts,
        stats: {
          ...(eventData.stats || {}),
          totalRegistrations: eventData.stats?.totalRegistrations ?? participantCount,
          totalCheckedIn: checkedInCount,
          attendeeCount: checkedInCount,
          showUpRatio,
        },
      };

      await docSnap.ref.set(updatePayload, { merge: true });
      updated += 1;

      const elapsedMs = Date.now() - eventStartedAt;
      if (elapsedMs > 5000) {
        console.warn(
          `Backfill for event ${docSnap.id} took ${elapsedMs}ms while reading ${participantCount} participants.`
        );
      }
    }

    const lastDoc = eventSnap.docs[eventSnap.docs.length - 1];

    return {
      processed: eventSnap.size,
      updated,
      lastId: lastDoc ? lastDoc.id : null,
    };
  }
);

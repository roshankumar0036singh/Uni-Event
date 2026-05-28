import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

/* eslint-disable prefer-array-at */

const normalizeCounterKey = (value: unknown) => {
  if (value == null) return "Unknown";
  if (typeof value !== "string" && typeof value !== "number") return "Unknown";
  const raw = String(value).trim();
  if (!raw) return "Unknown";
  return raw.replace(/[./#[\]$]/g, "_");
};

const computeParticipantAggregates = async (
  eventRef: admin.firestore.DocumentReference,
  pageSize: number,
) => {
  const branchCounts: Record<string, number> = {};
  const yearCounts: Record<string, number> = {};
  let participantCount = 0;

  let lastParticipantSnap: admin.firestore.DocumentSnapshot | null = null;

  while (true) {
    let participantsQuery = eventRef
      .collection("participants")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);

    if (lastParticipantSnap) {
      participantsQuery = participantsQuery.startAfter(lastParticipantSnap);
    }

    const participantsSnap = await participantsQuery.get();
    if (participantsSnap.empty) break;

    participantCount += participantsSnap.size;

    participantsSnap.forEach(participantDoc => {
      const participant = participantDoc.data() || {};
      const branchKey = normalizeCounterKey(participant.branch);
      const yearKey = normalizeCounterKey(participant.year);

      branchCounts[branchKey] = (branchCounts[branchKey] || 0) + 1;
      yearCounts[yearKey] = (yearCounts[yearKey] || 0) + 1;
    });

    lastParticipantSnap = participantsSnap.docs[participantsSnap.docs.length - 1] ?? null;
    if (participantsSnap.size < pageSize) break;
  }

  return { participantCount, branchCounts, yearCounts };
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
        eventData.stats?.totalRegistrations == null ||
        eventData.stats?.attendeeCount == null ||
        eventData.stats?.showUpRatio == null;

      if (!missingCounters) continue;

      const { participantCount, branchCounts, yearCounts } = await computeParticipantAggregates(
        docSnap.ref,
        pageSize,
      );

      const checkedInCount = Number(eventData.stats?.totalCheckedIn || 0);
      const showUpRatio = participantCount > 0 ? checkedInCount / participantCount : 0;

      const baseStats = eventData.stats ?? {};

      const updatePayload: Record<string, unknown> = {
        participantCount,
        branchCounts,
        yearCounts,
        stats: {
          ...baseStats,
          totalRegistrations: baseStats.totalRegistrations ?? participantCount,
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

    // eslint-disable-next-line prefer-array-at
    const lastDoc = eventSnap.docs[eventSnap.docs.length - 1] ?? null;

    return {
      processed: eventSnap.size,
      updated,
      lastId: lastDoc ? lastDoc.id : null,
    };
  }
);

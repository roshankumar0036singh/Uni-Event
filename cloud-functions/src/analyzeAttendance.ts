import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { calculateDistance } from "./utils/distance";
import { createFraudResult } from "./utils/fraudScore";

const db = admin.firestore();

export const analyzeAttendance = onDocumentCreated(
  "events/{eventId}/checkIns/{userId}",
  async (event) => {
    const snap = event.data;

    if (!snap) return;

    const attendance = snap.data();

    const {
      userId,
      latitude,
      longitude,
      deviceId,
      checkedInAt,
      qrId,
    } = attendance;

    const eventId = event.params.eventId;

    const result = createFraudResult();

    await checkRapidDuplicate(
      eventId,
      event.params.userId,
      qrId,
      checkedInAt,
      result
    );

    await checkImpossibleDistance(
      eventId,
      latitude,
      longitude,
      result
    );

    await checkDeviceAbuse(
      deviceId,
      result
    );

    await checkMultipleEvents(
      userId,
      checkedInAt,
      eventId,
      result
    );

    if (result.fraudScore >= 60) {
      const reportId =
        `${eventId}_${event.params.userId}`;

      await db
        .collection("fraudReports")
        .doc(reportId)
        .set(
          {
            attendanceId:
              event.params.userId,

            userId,
            eventId,

            fraudScore:
              result.fraudScore,

            reasons:
              result.reasons,

            resolved: false,

            createdAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
  }
);

async function checkRapidDuplicate(
  eventId: string,
  currentUserId: string,
  qrId: string,
  checkedInAt: any,
  result: any
) {
  const snapshot = await db
    .collection("events")
    .doc(eventId)
    .collection("checkIns")
    .where("qrId", "==", qrId)
    .get();

  snapshot.forEach((doc) => {
    // Skip current check-in
    if (doc.id === currentUserId) {
      return;
    }

    const data = doc.data();

    if (!data.checkedInAt) return;

    const currentTime =
      checkedInAt?.toDate
        ? checkedInAt.toDate().getTime()
        : new Date(checkedInAt).getTime();

    const existingTime =
      data.checkedInAt?.toDate
        ? data.checkedInAt.toDate().getTime()
        : new Date(
            data.checkedInAt
          ).getTime();

    const diff = Math.abs(
      currentTime - existingTime
    );

    if (diff < 30000) {
      result.fraudScore += 40;

      result.reasons.push(
        "Rapid repeated QR check-in"
      );
    }
  });
}

async function checkImpossibleDistance(
  eventId: string,
  latitude: number,
  longitude: number,
  result: any
) {
  const eventDoc = await db
    .collection("events")
    .doc(eventId)
    .get();

  const eventData = eventDoc.data();

  if (!eventData) return;

  if (
    eventData.latitude == null ||
    eventData.longitude == null ||
    latitude == null ||
    longitude == null
  ) {
    return;
  }

  const distance = calculateDistance(
    latitude,
    longitude,
    eventData.latitude,
    eventData.longitude
  );

  if (distance > 500) {
    result.fraudScore += 30;

    result.reasons.push(
      "Attendance too far from venue"
    );
  }
}

async function checkDeviceAbuse(
  deviceId: string,
  result: any
) {
  const snapshot = await db
    .collectionGroup("checkIns")
    .where("deviceId", "==", deviceId)
    .get();

  const users = new Set();

  snapshot.forEach((doc) => {
    users.add(doc.data().userId);
  });

  if (users.size >= 3) {
    result.fraudScore += 50;

    result.reasons.push(
      "Multiple accounts using same device"
    );
  }
}

async function checkMultipleEvents(
  userId: string,
  checkedInAt: any,
  currentEventId: string,
  result: any
) {
  const snapshot = await db
    .collectionGroup("checkIns")
    .where("userId", "==", userId)
    .get();

  snapshot.forEach((doc) => {
    const data = doc.data();

    const currentTime =
      checkedInAt?.toDate
        ? checkedInAt.toDate().getTime()
        : new Date(checkedInAt).getTime();

    const existingTime =
      data.checkedInAt?.toDate
        ? data.checkedInAt.toDate().getTime()
        : new Date(
            data.checkedInAt
          ).getTime();

    const diff = Math.abs(
      currentTime - existingTime
    );

    if (
      diff < 60000 &&
      data.eventId !== currentEventId
    ) {
      result.fraudScore += 50;

      result.reasons.push(
        "Multiple event check-ins simultaneously"
      );
    }
  });
}
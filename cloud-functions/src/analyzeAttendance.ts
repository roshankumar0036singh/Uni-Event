import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { calculateDistance } from './utils/distance';
import { createFraudResult } from './utils/fraudScore';

const db = admin.firestore();

const BATCH_SIZE = 100;

/**
 * Runs a Firestore query in bounded batches of BATCH_SIZE documents using
 * cursor pagination, invoking `visit` for every document (Issue #328).
 * Large result sets (10k+ docs) are streamed instead of materialized all
 * at once, avoiding memory exhaustion in the function runtime.
 */
async function forEachInBatches(
    query: admin.firestore.Query<admin.firestore.DocumentData>,
    visit: (
        doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>,
    ) => void | Promise<void>,
): Promise<void> {
    let lastDoc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData> | undefined;

    for (;;) {
        const pageQuery = lastDoc ? query.startAfter(lastDoc) : query;

        const snapshot = await pageQuery.limit(BATCH_SIZE).get();

        if (snapshot.empty) break;

        for (const doc of snapshot.docs) {
            await visit(doc);
        }

        if (snapshot.size < BATCH_SIZE) break;

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
}

export const analyzeAttendance = onDocumentCreated(
    'events/{eventId}/checkIns/{userId}',
    async event => {
        const snap = event.data;

        if (!snap) return;

        const attendance = snap.data();

        const { userId, latitude, longitude, deviceId, checkedInAt, qrId } = attendance;

        const eventId = event.params.eventId;

        const result = createFraudResult();

        await checkRapidDuplicate(eventId, event.params.userId, qrId, checkedInAt, result);

        await checkImpossibleDistance(eventId, latitude, longitude, result);

        await checkDeviceAbuse(deviceId, result);

        await checkMultipleEvents(userId, checkedInAt, eventId, result);

        if (result.fraudScore >= 60) {
            const reportId = `${eventId}_${event.params.userId}`;

            await db.collection('fraudReports').doc(reportId).set(
                {
                    attendanceId: event.params.userId,

                    userId,
                    eventId,

                    fraudScore: result.fraudScore,

                    reasons: result.reasons,

                    resolved: false,

                    createdAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
        }
    },
);

async function checkRapidDuplicate(
    eventId: string,
    currentUserId: string,
    qrId: string,
    checkedInAt: any,
    result: any,
) {
    const query = db
        .collection('events')
        .doc(eventId)
        .collection('checkIns')
        .where('qrId', '==', qrId);

    await forEachInBatches(query, doc => {
        // Skip current check-in
        if (doc.id === currentUserId) {
            return;
        }

        const data = doc.data();

        if (!data.checkedInAt) return;

        const currentTime = checkedInAt?.toDate
            ? checkedInAt.toDate().getTime()
            : new Date(checkedInAt).getTime();

        const existingTime = data.checkedInAt?.toDate
            ? data.checkedInAt.toDate().getTime()
            : new Date(data.checkedInAt).getTime();

        const diff = Math.abs(currentTime - existingTime);

        if (diff < 30000) {
            result.fraudScore += 40;

            result.reasons.push('Rapid repeated QR check-in');
        }
    });
}

async function checkImpossibleDistance(
    eventId: string,
    latitude: number,
    longitude: number,
    result: any,
) {
    const eventDoc = await db.collection('events').doc(eventId).get();

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
        eventData.longitude,
    );

    if (distance > 500) {
        result.fraudScore += 30;

        result.reasons.push('Attendance too far from venue');
    }
}

async function checkDeviceAbuse(deviceId: string, result: any) {
    const query = db.collectionGroup('checkIns').where('deviceId', '==', deviceId);

    const users = new Set();

    await forEachInBatches(query, doc => {
        users.add(doc.data().userId);
    });

    if (users.size >= 3) {
        result.fraudScore += 50;

        result.reasons.push('Multiple accounts using same device');
    }
}

async function checkMultipleEvents(
    userId: string,
    checkedInAt: any,
    currentEventId: string,
    result: any,
) {
    const query = db.collectionGroup('checkIns').where('userId', '==', userId);

    await forEachInBatches(query, doc => {
        const data = doc.data();

        const currentTime = checkedInAt?.toDate
            ? checkedInAt.toDate().getTime()
            : new Date(checkedInAt).getTime();

        const existingTime = data.checkedInAt?.toDate
            ? data.checkedInAt.toDate().getTime()
            : new Date(data.checkedInAt).getTime();

        const diff = Math.abs(currentTime - existingTime);

        if (diff < 60000 && data.eventId !== currentEventId) {
            result.fraudScore += 50;

            result.reasons.push('Multiple event check-ins simultaneously');
        }
    });
}

// cloud-functions/src/verifyAndCheckIn.ts
// Fix for issue #623 – QR check-in identity verification
//
// Drop this file into cloud-functions/src/ and export the function from index.ts:
//   export { verifyAndCheckIn } from "./verifyAndCheckIn";
//
// The function is an HTTPS Callable so the Firebase SDK on the client
// automatically attaches the caller's ID token; context.auth is populated
// server-side without any client involvement.

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface CheckInPayload {
    /** uid embedded in the scanned QR code */
    qrUid: string;
    /** Firestore event document ID embedded in the QR code */
    eventId: string;
}

export const verifyAndCheckIn = functions.https.onCall(async (data: CheckInPayload, context) => {
    // ── 1. Require authentication ──────────────────────────────────────────
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be signed in to check in.',
        );
    }

    const callerUid = context.auth.uid;
    const { qrUid, eventId } = data;

    // ── 2. Validate payload shape ──────────────────────────────────────────
    if (typeof qrUid !== 'string' || !qrUid.trim()) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'qrUid must be a non-empty string.',
        );
    }
    if (typeof eventId !== 'string' || !eventId.trim()) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'eventId must be a non-empty string.',
        );
    }

    // ── 3. IDENTITY CHECK – core fix for issue #623 ───────────────────────
    // The uid in the QR payload must match the authenticated caller.
    // This prevents User B from scanning User A's QR code.
    if (callerUid !== qrUid) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'QR code does not belong to the authenticated user.',
        );
    }

    // ── 4. Verify the event exists ─────────────────────────────────────────
    const db = admin.firestore();
    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Event not found.');
    }

    // ── 5. Verify the user actually RSVPed for this event ─────────────────
    const rsvpRef = db.collection('events').doc(eventId).collection('rsvps').doc(callerUid);
    const rsvpSnap = await rsvpRef.get();

    if (!rsvpSnap.exists) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'You have not RSVPed for this event.',
        );
    }

    // ── 6. Prevent duplicate check-ins ────────────────────────────────────
    const attendanceRef = db
        .collection('events')
        .doc(eventId)
        .collection('attendance')
        .doc(callerUid);
    const attendanceSnap = await attendanceRef.get();

    if (attendanceSnap.exists) {
        // Already checked in – return success idempotently
        return { success: true, alreadyCheckedIn: true };
    }

    // ── 7. Write attendance record & update reputation atomically ─────────
    const userRef = db.collection('users').doc(callerUid);
    const REPUTATION_POINTS = 10; // adjust to match your scoring schema

    await db.runTransaction(async tx => {
        const userSnap = await tx.get(userRef);
        const currentPoints: number = userSnap.exists
            ? (userSnap.data()?.reputationPoints ?? 0)
            : 0;

        // Mark attendance
        tx.set(attendanceRef, {
            uid: callerUid,
            eventId,
            checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
            verifiedByServer: true, // audit flag – distinguishes server-verified records
        });

        // Increment reputation
        tx.update(userRef, {
            reputationPoints: currentPoints + REPUTATION_POINTS,
            attendanceCount: admin.firestore.FieldValue.increment(1),
        });
    });

    return { success: true, alreadyCheckedIn: false };
});

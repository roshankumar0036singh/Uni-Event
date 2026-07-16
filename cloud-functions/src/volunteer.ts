import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { calculatePoints } from './reputation';

// Initialize only once (important for tests + Firebase runtime)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const REMARK_POINTS: Record<string, number> = {
    easy: 5,
    hard: 10,
    major: 20,
};

/**
 * Helper to check if the caller is the owner of the event or an admin
 */
const checkEventOwnership = async (eventId: string, uid: string, isAdmin: boolean) => {
    if (isAdmin) return true;
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Event not found.');
    }
    const eventData = eventDoc.data();
    if (eventData?.ownerId !== uid) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only the event owner or admin can perform this action.',
        );
    }
    return true;
};

/**
 * Drafts a student as a volunteer for an event.
 */
export const draftVolunteer = functions.https.onCall(async (data, context) => {
    let uid = context.auth?.uid;
    const isAdmin = context.auth?.token?.admin === true;

    // Temporary bypass for local testing
    if (!context.auth && process.env.FUNCTIONS_EMULATOR === 'true') {
        uid = 'test_owner_123';
    } else if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    }

    const { eventId, userId } = data;
    if (!eventId || !userId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'eventId and userId are required.',
        );
    }

    await checkEventOwnership(eventId, uid as string, isAdmin);

    const batch = db.batch();

    // 1. Write to the Event's volunteers subcollection
    const eventVolunteerRef = db
        .collection('events')
        .doc(eventId)
        .collection('volunteers')
        .doc(userId);
    batch.set(eventVolunteerRef, {
        status: 'drafted',
        addedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Write to the User's volunteering subcollection (for the My Volunteer Events screen)
    const userVolunteeringRef = db
        .collection('users')
        .doc(userId)
        .collection('volunteering')
        .doc(eventId);
    batch.set(userVolunteeringRef, {
        status: 'drafted',
        addedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return { success: true, message: 'Volunteer drafted successfully.' };
});

/**
 * Awards points to a drafted/active volunteer.
 */
export const awardVolunteerPoints = functions.https.onCall(async (data, context) => {
    let uid = context.auth?.uid;
    const isAdmin = context.auth?.token?.admin === true;

    // Temporary bypass for local testing
    if (!context.auth && process.env.FUNCTIONS_EMULATOR === 'true') {
        uid = 'test_owner_123';
    } else if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    }

    const { eventId, userId, remark } = data;
    if (!eventId || !userId || !remark) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'eventId, userId, and remark are required.',
        );
    }

    const pointsToAward = REMARK_POINTS[remark];
    if (pointsToAward === undefined) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Invalid remark. Must be easy, hard, or major.',
        );
    }

    await checkEventOwnership(eventId, uid as string, isAdmin);

    // Verify volunteer is not dropped
    const volunteerRef = db.collection('events').doc(eventId).collection('volunteers').doc(userId);
    const volunteerDoc = await volunteerRef.get();

    if (!volunteerDoc.exists || volunteerDoc.data()?.status === 'dropped') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'User is not an active/drafted volunteer for this event.',
        );
    }

    await db.runTransaction(async transaction => {
        // Read user data
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }
        const userData = userDoc.data()!;

        // Update volunteer status to active if it was drafted
        transaction.update(volunteerRef, {
            status: 'active',
            updatedAt: FieldValue.serverTimestamp(),
        });

        const userVolunteeringRef = db
            .collection('users')
            .doc(userId)
            .collection('volunteering')
            .doc(eventId);
        transaction.set(
            userVolunteeringRef,
            {
                status: 'active',
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        // Add log entry
        const logRef = db.collection('volunteerLogs').doc();
        transaction.set(logRef, {
            eventId,
            userId,
            awardedBy: uid,
            remark,
            points: pointsToAward,
            action: 'awarded',
            timestamp: FieldValue.serverTimestamp(),
        });

        // Update User's reputation points
        const attendanceCount =
            userData.reputation?.attendanceCount ?? userData.attendanceCount ?? 0;
        const registrationCount =
            userData.reputation?.registrationCount ?? userData.registrationCount ?? 0;
        const remindersSet = userData.reputation?.remindersSet ?? userData.remindersSet ?? 0;

        const currentVolunteerPoints =
            userData.reputation?.volunteerPoints ?? userData.volunteerPoints ?? 0;
        const newVolunteerPoints = currentVolunteerPoints + pointsToAward;

        const totalPoints = calculatePoints(
            attendanceCount,
            registrationCount,
            remindersSet,
            newVolunteerPoints,
        );

        transaction.update(userRef, {
            'reputation.points': totalPoints,
            'reputation.volunteerPoints': newVolunteerPoints,
            'reputation.updatedAt': FieldValue.serverTimestamp(),
            points: totalPoints,
        });
    });

    return { success: true, message: 'Points awarded successfully.' };
});

/**
 * Drops a volunteer from an event and optionally revokes their points.
 */
export const dropVolunteer = functions.https.onCall(async (data, context) => {
    let uid = context.auth?.uid;
    const isAdmin = context.auth?.token?.admin === true;

    // Temporary bypass for local testing
    if (!context.auth && process.env.FUNCTIONS_EMULATOR === 'true') {
        uid = 'test_owner_123';
    } else if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    }

    const { eventId, userId, reason, isFlagged, revokePoints } = data;
    if (!eventId || !userId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'eventId and userId are required.',
        );
    }

    await checkEventOwnership(eventId, uid as string, isAdmin);

    await db.runTransaction(async transaction => {
        const volunteerRef = db
            .collection('events')
            .doc(eventId)
            .collection('volunteers')
            .doc(userId);

        // 1. Perform all READS first
        let netPointsAwarded = 0;
        let userDoc = null;

        if (revokePoints) {
            // Read logs
            const logsSnapshot = await transaction.get(
                db
                    .collection('volunteerLogs')
                    .where('eventId', '==', eventId)
                    .where('userId', '==', userId),
            );

            logsSnapshot.docs.forEach(doc => {
                const logData = doc.data();
                if (logData.action === 'awarded') {
                    netPointsAwarded += logData.points;
                } else if (logData.action === 'reversed') {
                    netPointsAwarded += logData.points; // points should be negative for reversed
                }
            });

            if (netPointsAwarded > 0) {
                // Read user data
                const userRef = db.collection('users').doc(userId);
                userDoc = await transaction.get(userRef);
            }
        }

        // 2. Perform all WRITES second
        transaction.set(
            volunteerRef,
            {
                status: 'dropped',
                droppedReason: reason || null,
                isFlagged: isFlagged || false,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        const userVolunteeringRef = db
            .collection('users')
            .doc(userId)
            .collection('volunteering')
            .doc(eventId);
        transaction.set(
            userVolunteeringRef,
            {
                status: 'dropped',
                droppedReason: reason || null,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        if (revokePoints && netPointsAwarded > 0 && userDoc && userDoc.exists) {
            const userRef = db.collection('users').doc(userId);
            const userData = userDoc.data()!;

            const attendanceCount =
                userData.reputation?.attendanceCount ?? userData.attendanceCount ?? 0;
            const registrationCount =
                userData.reputation?.registrationCount ?? userData.registrationCount ?? 0;
            const remindersSet = userData.reputation?.remindersSet ?? userData.remindersSet ?? 0;
            const currentVolunteerPoints =
                userData.reputation?.volunteerPoints ?? userData.volunteerPoints ?? 0;

            const newVolunteerPoints = Math.max(0, currentVolunteerPoints - netPointsAwarded);

            const totalPoints = calculatePoints(
                attendanceCount,
                registrationCount,
                remindersSet,
                newVolunteerPoints,
            );

            // Add a reversed log entry
            const logRef = db.collection('volunteerLogs').doc();
            transaction.set(logRef, {
                eventId,
                userId,
                awardedBy: uid,
                remark: 'points_revoked',
                points: -netPointsAwarded,
                action: 'reversed',
                reason: reason || 'Volunteer dropped',
                timestamp: FieldValue.serverTimestamp(),
            });

            // Update User's reputation points
            transaction.update(userRef, {
                'reputation.points': totalPoints,
                'reputation.volunteerPoints': newVolunteerPoints,
                'reputation.updatedAt': FieldValue.serverTimestamp(),
                points: totalPoints,
            });
        }
    });

    return { success: true, message: 'Volunteer dropped successfully.' };
});

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
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Event not found.');
    }
    if (isAdmin) return true;
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

    if (!context.auth) {
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

    await db.runTransaction(async transaction => {
        const userRef = db.collection('users').doc(userId);
        const eventVolunteerRef = db
            .collection('events')
            .doc(eventId)
            .collection('volunteers')
            .doc(userId);

        const [userDoc, eventVolunteerDoc] = await Promise.all([
            transaction.get(userRef),
            transaction.get(eventVolunteerRef),
        ]);

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        if (eventVolunteerDoc.exists) {
            const status = eventVolunteerDoc.data()?.status;
            if (status === 'active' || status === 'dropped') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'User is already active or dropped.',
                );
            }
        }

        const userVolunteeringRef = db
            .collection('users')
            .doc(userId)
            .collection('volunteering')
            .doc(eventId);

        transaction.set(eventVolunteerRef, {
            status: 'drafted',
            addedBy: uid,
            updatedAt: FieldValue.serverTimestamp(),
        });

        transaction.set(userVolunteeringRef, {
            status: 'drafted',
            addedBy: uid,
            updatedAt: FieldValue.serverTimestamp(),
        });
    });

    return { success: true, message: 'Volunteer drafted successfully.' };
});

/**
 * Awards points to a drafted/active volunteer.
 */
export const awardVolunteerPoints = functions.https.onCall(async (data, context) => {
    let uid = context.auth?.uid;
    const isAdmin = context.auth?.token?.admin === true;

    if (!context.auth) {
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

    const volunteerRef = db.collection('events').doc(eventId).collection('volunteers').doc(userId);

    await db.runTransaction(async transaction => {
        const volunteerDoc = await transaction.get(volunteerRef);

        const status = volunteerDoc.data()?.status;
        if (!volunteerDoc.exists || (status !== 'drafted' && status !== 'active')) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'User is not an active/drafted volunteer for this event.',
            );
        }

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

    if (!context.auth) {
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

        const volunteerDoc = await transaction.get(volunteerRef);

        const status = volunteerDoc.data()?.status;
        if (!volunteerDoc.exists || (status !== 'drafted' && status !== 'active')) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'User is not an active/drafted volunteer for this event.',
            );
        }

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

/**
 * Searches for users to draft as volunteers or enriches a list of user IDs.
 */
export const searchVolunteerCandidates = functions.https.onCall(async (data, context) => {
    let uid = context.auth?.uid;
    const isAdmin = context.auth?.token?.admin === true;

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
    }

    const { eventId, searchQuery, userIds } = data;
    if (!eventId) {
        throw new functions.https.HttpsError('invalid-argument', 'eventId is required.');
    }

    await checkEventOwnership(eventId, uid as string, isAdmin);

    const results: Array<{ id: string; displayName?: string; email?: string }> = [];

    // Mode 1: Enrich specific userIds
    if (Array.isArray(userIds) && userIds.length > 0) {
        const fetchPromises = userIds.map(async id => {
            const userDoc = await db.collection('users').doc(id).get();
            if (userDoc.exists) {
                const ud = userDoc.data();
                results.push({
                    id,
                    displayName: ud?.displayName,
                    email: ud?.email,
                });
            }
        });
        await Promise.all(fetchPromises);
        return { users: results };
    }

    // Mode 2: Search by query (email or display name)
    if (searchQuery && typeof searchQuery === 'string') {
        const query = searchQuery.trim().toLowerCase();
        const usersRef = db.collection('users');

        let snapshot = await usersRef.where('email', '==', query).limit(10).get();

        if (snapshot.empty) {
            snapshot = await usersRef
                .where('displayName', '>=', searchQuery.trim())
                .where('displayName', '<=', searchQuery.trim() + '\uf8ff')
                .limit(10)
                .get();
        }

        snapshot.forEach(doc => {
            const ud = doc.data();
            results.push({
                id: doc.id,
                displayName: ud?.displayName,
                email: ud?.email,
            });
        });

        return { users: results };
    }

    return { users: [] };
});

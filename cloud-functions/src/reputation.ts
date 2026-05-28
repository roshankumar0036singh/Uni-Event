import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize only once (important for tests + Firebase runtime)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Calculates reputation points:
 * - Attendance: 10 points each
 * - Registration: 2 points each
 * - Reminder: 1 point each
 */
export const calculatePoints = (
  attendanceCount: number,
  registrationCount: number,
  remindersSet: number,
) => {
  return attendanceCount * 10 + registrationCount * 2 + remindersSet;
};

/**
 * Calculates reputation for all users/students.
 *
 * Scoring:
 * +10 points per attended event
 * +2 points per registration
 * +1 point per reminder set
 */
export const calculateReputation = functions.https.onCall(async (_data, context) => {
    if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admin can calculate reputation.',
        );
    }

    const usersSnapshot = await db.collection('users').get();
    let batch = db.batch();
    let opCount = 0;
    let updatedUsers = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();

        const attendanceCount =
            userData.reputation?.attendanceCount || userData.attendanceCount || 0;

        const registrationCount =
            userData.reputation?.registrationCount || userData.registrationCount || 0;

        const remindersSet = userData.reputation?.remindersSet || userData.remindersSet || 0;

        const points = calculatePoints(
            attendanceCount,
            registrationCount,
            remindersSet,
            );
        batch.update(userDoc.ref, {
            'reputation.points': points,
            'reputation.attendanceCount': attendanceCount,
            'reputation.registrationCount': registrationCount,
            'reputation.remindersSet': remindersSet,
            'reputation.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        opCount += 1;
        updatedUsers += 1;

        if (opCount === 500) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }

    return {
        success: true,
        message: `Updated reputation for ${updatedUsers} users`,
    };
});

/**
 * Refreshes the campus-wide top contributors leaderboard every 24 hours.
 *
 * Stores the initial top 10 contributors for fast profile screen display.
 */
export const refreshTopContributorsLeaderboard = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async () => {
        const usersSnapshot = await db
            .collection('users')
            .orderBy('reputation.points', 'desc')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(10)
            .get();

        const contributors = usersSnapshot.docs.map((doc, index) => {
            const userData = doc.data();

            return {
                userId: doc.id,
                rank: index + 1,
                name:
                    userData.name || userData.fullName || userData.displayName || 'Unknown Student',
                department: userData.department || '',
                photoURL: userData.photoURL || '',
                points: userData.reputation?.points || 0,
                attendanceCount: userData.reputation?.attendanceCount || 0,
                registrationCount: userData.reputation?.registrationCount || 0,
                remindersSet: userData.reputation?.remindersSet || 0,
            };
        });

        await db.collection('leaderboards').doc('topContributors').set({
            type: 'topContributors',
            contributors,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return null;
    });

/**
 * Fetches paginated top contributors.
 *
 * Client can load the first 10 contributors and then request more using
 * lastPoints, lastUserId, and startRank.
 */
export const getTopContributors = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const limit = Math.min(data?.limit || 10, 25);
    const lastPoints = data?.lastPoints;
    const lastUserId = data?.lastUserId;
    const startRank = data?.startRank || 1;

    let query: FirebaseFirestore.Query = db
        .collection('users')
        .orderBy('reputation.points', 'desc')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(limit);

    if (typeof lastPoints === 'number' && typeof lastUserId === 'string') {
        query = query.startAfter(lastPoints, lastUserId);
    }

    const usersSnapshot = await query.get();

    const contributors = usersSnapshot.docs.map((doc, index) => {
        const userData = doc.data();

        return {
            userId: doc.id,
            rank: startRank + index,
            name: userData.name || userData.fullName || userData.displayName || 'Unknown Student',
            department: userData.department || '',
            photoURL: userData.photoURL || '',
            points: userData.reputation?.points || 0,
            attendanceCount: userData.reputation?.attendanceCount || 0,
            registrationCount: userData.reputation?.registrationCount || 0,
            remindersSet: userData.reputation?.remindersSet || 0,
        };
    });

    const lastContributor = contributors.length > 0 ? contributors[contributors.length - 1] : null;

    return {
        success: true,
        contributors,
        hasMore: contributors.length === limit,
        nextCursor: lastContributor
            ? {
                  lastPoints: lastContributor.points,
                  lastUserId: lastContributor.userId,
                  startRank: startRank + contributors.length,
              }
            : null,
    };
});

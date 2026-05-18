import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

/**
 * Recalculates reputation points for users/students.
 *
 * Scoring:
 * +10 points per attended event
 * +2 points per registered event
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
    const updates: Promise<FirebaseFirestore.WriteResult>[] = [];

    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();

        const attendanceCount =
            userData.reputation?.attendanceCount || userData.attendanceCount || 0;

        const registrationCount =
            userData.reputation?.registrationCount || userData.registrationCount || 0;

        const remindersSet = userData.reputation?.remindersSet || userData.remindersSet || 0;

        const points =
            Math.floor(attendanceCount / 100) * 10 + registrationCount * 2 + remindersSet;

        updates.push(
            userDoc.ref.update({
                'reputation.points': points,
                'reputation.attendanceCount': attendanceCount,
                'reputation.registrationCount': registrationCount,
                'reputation.remindersSet': remindersSet,
                'reputation.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
            }),
        );
    });

    await Promise.all(updates);

    return {
        success: true,
        message: `Updated reputation for ${updates.length} users`,
    };
});

/**
 * Refreshes campus-wide top contributors leaderboard every 24 hours.
 * Stores an initial top 10 list for quick display.
 */
export const refreshTopContributorsLeaderboard = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async () => {
        const usersSnapshot = await db
            .collection('users')
            .orderBy('reputation.points', 'desc')
            .limit(10)
            .get();

        const leaderboard = usersSnapshot.docs.map((doc, index) => {
            const userData = doc.data();

            return {
                userId: doc.id,
                rank: index + 1,
                name: userData.name || userData.displayName || 'Unknown User',
                email: userData.email || '',
                photoURL: userData.photoURL || '',
                points: userData.reputation?.points || 0,
                attendanceCount: userData.reputation?.attendanceCount || 0,
                registrationCount: userData.reputation?.registrationCount || 0,
                remindersSet: userData.reputation?.remindersSet || 0,
            };
        });

        await db.collection('leaderboards').doc('topContributors').set({
            type: 'topContributors',
            leaderboard,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return null;
    });

/**
 * Fetches paginated top contributors.
 * Client can request first 10 and then load more using lastPoints.
 */
export const getTopContributors = functions.https.onCall(async data => {
    const limit = Math.min(data?.limit || 10, 25);
    const lastPoints = data?.lastPoints;

    let query: FirebaseFirestore.Query = db
        .collection('users')
        .orderBy('reputation.points', 'desc')
        .limit(limit);

    if (typeof lastPoints === 'number') {
        query = query.startAfter(lastPoints);
    }

    const usersSnapshot = await query.get();

    const contributors = usersSnapshot.docs.map((doc, index) => {
        const userData = doc.data();

        return {
            userId: doc.id,
            rank: index + 1,
            name: userData.name || userData.displayName || 'Unknown User',
            email: userData.email || '',
            photoURL: userData.photoURL || '',
            points: userData.reputation?.points || 0,
            attendanceCount: userData.reputation?.attendanceCount || 0,
            registrationCount: userData.reputation?.registrationCount || 0,
            remindersSet: userData.reputation?.remindersSet || 0,
        };
    });

    return {
        success: true,
        contributors,
        hasMore: contributors.length === limit,
        lastPoints: contributors.length > 0 ? contributors[contributors.length - 1].points : null,
    };
});

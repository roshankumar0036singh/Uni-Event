import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Calculates reputation for all clubs or a specific club.
 * Can be triggered manually or scheduled.
 * Logic:
 * +10 points per 100 attendees
 * +2 points per registration
 * +1 point per reminder set
 */
export const calculateReputation = functions.https.onCall(async (data, context) => {
    // if (!context.auth || !context.auth.token.admin) {
    //   throw new functions.https.HttpsError('permission-denied', 'Only admin');
    // }

    // For demo purposes, we allow anyone to trigger (or check auth if strict)

    const db = admin.firestore();

    const clubsSnapshot = await db.collection('clubs').get();
    const updates: Promise<any>[] = [];

    for (const clubDoc of clubsSnapshot.docs) {
        // const clubId = clubDoc.id; // Unused
        let points = 0;

        // Fetch events for this club
        const eventsSnapshot = await db
            .collection('events')
            .where('ownerId', '==', clubDoc.data().ownerUserId)
            .get(); // Assuming ownerId links event to club owner. Better: store clubId on event.

        // Correction: Strategy says clubs/{clubId} has ownerUserId. Events have ownerId.
        // Ideally event should have `clubId` field. For MVP we assume ownerId on event matches club owner.

        let totalAttendance = 0;
        let totalRegistrations = 0;
        let totalReminders = 0;

        eventsSnapshot.forEach(eventDoc => {
            const metrics = eventDoc.data().metrics || {};
            totalAttendance += metrics.attendance || 0;
            totalRegistrations += metrics.registrations || 0;
            totalReminders += metrics.remindersSet || 0;
        });

        points += Math.floor(totalAttendance / 100) * 10;
        points += totalRegistrations * 2;
        points += totalReminders * 1;

        // Optional: Feedback logic stub
        // points += 5 (if avg feedback > 4.0)

        updates.push(
            clubDoc.ref.update({
                'reputation.points': points,
                'reputation.attendanceCount': totalAttendance,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }),
        );
    }

    await Promise.all(updates);
    return { success: true, message: `Updated ${updates.length} clubs` };
});

/**
 * Refreshes the campus-wide top contributors leaderboard every 24 hours.
 * Stores a precomputed top 10 list to avoid expensive client-side queries.
 */
export const refreshTopContributorsLeaderboard = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async () => {
        const db = admin.firestore();

        const clubsSnapshot = await db
            .collection('clubs')
            .orderBy('reputation.points', 'desc')
            .limit(10)
            .get();

        const contributors = clubsSnapshot.docs.map((clubDoc, index) => {
            const clubData = clubDoc.data();
            const reputation = clubData.reputation || {};

            return {
                id: clubDoc.id,
                rank: index + 1,
                name: clubData.name || clubData.clubName || clubData.title || 'Unknown Contributor',
                department: clubData.department || clubData.departmentName || 'General',
                reputationPoints: reputation.points || 0,
            };
        });

        await db.collection('leaderboards').doc('topContributors').set({
            contributors,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return null;
    });

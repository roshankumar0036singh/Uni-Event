import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();
const GHOST_THRESHOLD = 3;

/**
 * Scheduled function to detect users who RSVP'd but didn't show up.
 * Runs every 24 hours.
 */
export const detectGhostingUsers = functions.pubsub
    .schedule('every 24 hours')
    .timeZone('UTC')
    .onRun(async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Find events that ended in the last 24 hours
        const recentEventsSnapshot = await db
            .collection('events')
            .where('endAt', '<', now.toISOString())
            .where('endAt', '>=', yesterday.toISOString())
            .get();

        if (recentEventsSnapshot.empty) {
            console.log('No recent events to process for attendance.');
            return null;
        }

        let ghostCounts: Record<string, number> = {};

        // Loop through all recent events
        for (const eventDoc of recentEventsSnapshot.docs) {
            // Get participants for this event
            const participantsSnapshot = await eventDoc.ref
                .collection('participants')
                .where('status', '==', 'rsvp') // They RSVP'd but did not check in
                .get();

            participantsSnapshot.forEach(participantDoc => {
                const userId = participantDoc.id;
                ghostCounts[userId] = (ghostCounts[userId] || 0) + 1;
            });
        }

        if (Object.keys(ghostCounts).length === 0) {
            console.log('No ghosting participants found.');
            return null;
        }

        const batch = db.batch();
        let operationCount = 0;

        // Fetch users and increment their global missed RSVPs count
        for (const userId of Object.keys(ghostCounts)) {
            const userRef = db.collection('users').doc(userId);
            const userSnap = await userRef.get();

            if (!userSnap.exists) continue;

            const userData = userSnap.data() || {};

            // Skip users who are already shadowbanned
            if (userData.isShadowBanned) continue;

            const missedRsvpsCount = (userData.missedRsvpsCount || 0) + ghostCounts[userId];
            const isShadowBanned = missedRsvpsCount >= GHOST_THRESHOLD;

            batch.update(userRef, {
                missedRsvpsCount,
                ...(isShadowBanned && { isShadowBanned: true }),
            });

            operationCount++;

            if (operationCount === 500) {
                await batch.commit();
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        console.log(`Processed ghosting for ${Object.keys(ghostCounts).length} users.`);
        return null;
    });

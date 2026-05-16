import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const calculateShowUpRatio = functions.https.onCall(async (data, context) => {
    // authentication of user
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'Must be logged in to calculate predictions.');
    // }

    const clubId = data.clubId;
    if (!clubId) {
        throw new functions.https.HttpsError('invalid-argument', 'Club ID is required.');
    }

    try {
        // Fetching all PAST events for this club
        const eventsSnapshot = await db.collection('events')
            .where('organizerId', '==', clubId)
            .where('status', '==', 'completed') // Assuming you mark past events as 'completed'
            .get();

        if (eventsSnapshot.empty) {
            return { message: "No past events found. Default ratio will be used.", ratio: 1.0 };
        }

        let totalHistoricalRSVPs = 0;
        let totalHistoricalAttendees = 0;

        // Tally up the numbers
        eventsSnapshot.forEach(doc => {
            const eventData = doc.data();
            // Fallback to 0 if the fields don't exist
            const rsvps = eventData.totalRSVPs || 0; 
            const attendees = eventData.actualAttendees || 0;

            if (rsvps > 0) {
                totalHistoricalRSVPs += rsvps;
                totalHistoricalAttendees += attendees;
            }
        });

        // Calculate the ratio
        let showUpRatio = 1.0; // Default to 100% if no data
        if (totalHistoricalRSVPs > 0) {
            showUpRatio = totalHistoricalAttendees / totalHistoricalRSVPs;
        }

        // Cap the ratio at 1.0 (100%) just in case of data anomalies
        showUpRatio = Math.min(showUpRatio, 1.0);

        // Save this ratio to the club's profile...
        await db.collection('clubs').doc(clubId).set({
            metrics: {
                historicalShowUpRatio: showUpRatio,
                lastCalculated: new Date()
            }
        }, { merge: true });

        return { 
            success: true, 
            ratio: showUpRatio,
            eventsAnalyzed: eventsSnapshot.size
        };

    } catch (error) {
        console.error("Error calculating ratio:", error);
        throw new functions.https.HttpsError('internal', 'Failed to calculate ratio.');
    }
});
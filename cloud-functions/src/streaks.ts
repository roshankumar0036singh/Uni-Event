import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

/**
 * Weekly streak calculator
 * Runs every 24 hours
 */
export const calculateStreaks = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {

        const db = admin.firestore();

        console.log('Running streak calculation...');

        const usersSnapshot = await db.collection('users').get();

        console.log(`Found ${usersSnapshot.size} users`);

        const eventsSnapshot = await db.collection('events').get();

        console.log(`Found ${eventsSnapshot.size} events`);

        const userAttendance: Record<string, string[]> = {};

        for (const eventDoc of eventsSnapshot.docs) {
            const eventData = eventDoc.data();

            if (!eventData.startAt) continue;

            const checkInsSnapshot = await eventDoc.ref
                .collection('checkIns')
                .get();

            const eventDate = eventData.startAt.toDate();

            const weekKey = `${eventDate.getFullYear()}-${Math.ceil(
                eventDate.getDate() / 7
            )}`;

            for (const checkInDoc of checkInsSnapshot.docs) {
                const userId = checkInDoc.id;

                if (!userAttendance[userId]) {
                    userAttendance[userId] = [];
                }

                if (!userAttendance[userId].includes(weekKey)) {
                    userAttendance[userId].push(weekKey);
                }
            }

            console.log(
                `Event ${eventDoc.id} has ${checkInsSnapshot.size} check-ins`
            );
        }

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;

            const attendedWeeks = userAttendance[userId] || [];

            const streak = attendedWeeks.length;

            await userDoc.ref.update({
                currentStreak: streak,
            });

            console.log(
                `Updated ${userId} streak to ${streak}`
            );
        }

        return null;
    });
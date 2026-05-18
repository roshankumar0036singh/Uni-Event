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

            const firstDayOfYear = new Date(eventDate.getFullYear(), 0, 1);
            const daysSinceStart =
                Math.floor((eventDate.getTime() - firstDayOfYear.getTime()) / 86400000);

            const weekNumber = Math.ceil((daysSinceStart + 1) / 7);
            const weekKey = `${eventDate.getFullYear()}-${weekNumber}`;

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

            console.log(`Updated streak to ${streak}`);
        }

        return null;
    });
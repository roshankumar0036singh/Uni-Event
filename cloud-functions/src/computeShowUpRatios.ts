import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

interface ShowUpRatio {
    ratio: number;
    eventCount: number;
    totalRsvps: number;
    totalAttendees: number;
}

export const computeShowUpRatios = functions.pubsub
    .schedule('every 30 minutes')
    .onRun(async () => {
        const pastEvents = await db
            .collection('events')
            .where('endAt', '<', new Date().toISOString())
            .where('participantCount', '>', 0)
            .select(
                'category',
                'participantCount',
                'stats.totalCheckedIn',
            )
            .get();

        if (pastEvents.empty) {
            console.log('No past events with participants found.');
            return null;
        }

        const categoryBuckets = new Map<string, {
            totalRsvps: number;
            totalAttendees: number;
        }>();
        let overallTotalRsvps = 0;
        let overallTotalAttendees = 0;

        for (const doc of pastEvents.docs) {
            const data = doc.data();
            const rsvps = data.participantCount || 0;
            const checkedIn = data.stats?.totalCheckedIn || 0;
            const category = data.category || 'General';

            if (rsvps === 0) continue;

            const bucket = categoryBuckets.get(category) || { totalRsvps: 0, totalAttendees: 0 };
            bucket.totalRsvps += rsvps;
            bucket.totalAttendees += checkedIn;
            categoryBuckets.set(category, bucket);

            overallTotalRsvps += rsvps;
            overallTotalAttendees += checkedIn;
        }

        if (overallTotalRsvps === 0) {
            console.log('No RSVPs found across past events.');
            return null;
        }

        const batch = db.batch();
        const ratiosRef = db.collection('predictionData').doc('showUpRatios');

        const categoryRatios: Record<string, ShowUpRatio> = {};

        for (const [category, counts] of categoryBuckets) {
            const ratio = counts.totalRsvps > 0
                ? counts.totalAttendees / counts.totalRsvps
                : 0;
            categoryRatios[category] = {
                ratio: Math.round(ratio * 100) / 100,
                eventCount: pastEvents.docs.filter(
                    d => (d.data().category || 'General') === category,
                ).length,
                totalRsvps: counts.totalRsvps,
                totalAttendees: counts.totalAttendees,
            };
        }

        const overallRatio = overallTotalRsvps > 0
            ? overallTotalAttendees / overallTotalRsvps
            : 0;

        batch.set(ratiosRef, {
            categoryRatios,
            overall: {
                ratio: Math.round(overallRatio * 100) / 100,
                eventCount: pastEvents.size,
                totalRsvps: overallTotalRsvps,
                totalAttendees: overallTotalAttendees,
            },
            updatedAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();
        console.log(
            `Computed show-up ratios for ${categoryBuckets.size} categories ` +
            `across ${pastEvents.size} past events. ` +
            `Overall ratio: ${(overallRatio * 100).toFixed(1)}%`,
        );

        return null;
    });

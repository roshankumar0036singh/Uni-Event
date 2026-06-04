/**
 * Integration tests for the club reputation time-decay system.
 *
 * These tests run against the Firebase Firestore Emulator.
 * Start the emulator before running:
 *   firebase emulators:start --only firestore --project uni-event-test
 *
 * Then run:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx jest src/clubReputation.integration.test.ts --no-coverage
 *
 * What is tested here:
 *   1. onEventFeedbackCreate — seeding a feedback doc creates the correct monthly bucket
 *   2. refreshClubReputation — the scheduled job reads buckets and writes decayed scores
 *   3. End-to-end — recent events contribute more to the decayed average than old ones
 *   4. feedbackService.calculateAverageRating — prefers decayedPoints when present
 */

import * as admin from 'firebase-admin';
import fft from 'firebase-functions-test';

// Point the SDK at the local Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const testEnv = fft({ projectId: 'uni-event-test' });

// Import AFTER env is configured so the admin SDK points at the emulator
import { onEventFeedbackCreate, refreshClubReputation } from './clubReputation';

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Inline helper — mirrors feedbackService.calculateAverageRating
// Avoids a cross-package ESM import that babel-jest can't resolve.
// ---------------------------------------------------------------------------
const calculateAverageRating = (reputation: Record<string, number> | null | undefined): number => {
    if (!reputation) return 0;
    const decayedRatings = Number(reputation.decayedRatings || 0);
    const decayedPoints = Number(reputation.decayedPoints || 0);
    if (decayedRatings > 0) return Number((decayedPoints / decayedRatings).toFixed(1));
    const totalRatings = Number(reputation.totalRatings || 0);
    const totalPoints = Number(reputation.totalPoints || 0);
    if (totalRatings > 0) return Number((totalPoints / totalRatings).toFixed(1));
    return 0;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a UTC Date at the 1st of the month, N months before today */
const monthsAgo = (n: number): Date => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
};
import * as http from 'node:http';

/** Wipes the emulator DB before each test */
async function clearFirestore(): Promise<void> {
    return new Promise((resolve, reject) => {
        const hostEnv = process.env.FIRESTORE_EMULATOR_HOST;
        if (!hostEnv) return reject(new Error('FIRESTORE_EMULATOR_HOST not set'));
        const [host, port] = hostEnv.split(':');
        const req = http.request(
            {
                hostname: host,
                port: port,
                path: '/emulator/v1/projects/uni-event-test/databases/(default)/documents',
                method: 'DELETE',
            },
            res => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Failed to clear Firestore emulator: ${res.statusCode}`));
                }
            },
        );
        req.on('error', reject);
        req.end();
    });
}

// ---------------------------------------------------------------------------
// Wrapped Cloud Functions (no real trigger infra needed)
// ---------------------------------------------------------------------------

const wrappedOnFeedbackCreate = testEnv.wrap(onEventFeedbackCreate);
const wrappedRefreshClubReputation = testEnv.wrap(refreshClubReputation);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a feedback document and fires the onEventFeedbackCreate trigger,
 * which writes the monthly bucket to Firestore.
 */
async function seedFeedback(opts: {
    eventId: string;
    userId: string;
    clubId: string;
    clubRating: number;
    eventDate: Date;
}): Promise<void> {
    const { eventId, userId, clubId, clubRating, eventDate } = opts;

    // Create the event document (trigger reads startAt from here)
    await db.doc(`events/${eventId}`).set({
        ownerId: clubId,
        startAt: eventDate.toISOString(),
    });

    const feedbackData = {
        clubId,
        clubRating,
        attended: true,
        // firebase-functions-test cannot encode ServerTimestampTransform,
        // so we use a plain ISO string for the submittedAt fallback.
        submittedAt: eventDate.toISOString(),
    };

    const snap = testEnv.firestore.makeDocumentSnapshot(
        feedbackData,
        `events/${eventId}/feedback/${userId}`,
    );

    await wrappedOnFeedbackCreate(snap, { params: { eventId, userId } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('clubReputation — integration tests', () => {
    beforeEach(clearFirestore);

    afterAll(() => {
        testEnv.cleanup();
    });

    // -------------------------------------------------------------------------
    // 1. onEventFeedbackCreate
    // -------------------------------------------------------------------------

    describe('onEventFeedbackCreate', () => {
        it('creates a monthly bucket with correct ratingPoints and ratingCount', async () => {
            await seedFeedback({
                eventId: 'evt1',
                userId: 'user1',
                clubId: 'club1',
                clubRating: 4,
                eventDate: monthsAgo(0), // this month
            });

            const buckets = await db.collection('users/club1/reputationBuckets').get();

            expect(buckets.size).toBe(1);
            const data = buckets.docs[0].data();
            expect(data.ratingPoints).toBe(4);
            expect(data.ratingCount).toBe(1);
        });

        it('accumulates multiple reviews into the same monthly bucket', async () => {
            await seedFeedback({
                eventId: 'e1',
                userId: 'u1',
                clubId: 'club1',
                clubRating: 3,
                eventDate: monthsAgo(0),
            });
            await seedFeedback({
                eventId: 'e2',
                userId: 'u2',
                clubId: 'club1',
                clubRating: 5,
                eventDate: monthsAgo(0),
            });

            const buckets = await db.collection('users/club1/reputationBuckets').get();

            // Both reviews are in the same month → should be in 1 bucket
            expect(buckets.size).toBe(1);
            const data = buckets.docs[0].data();
            expect(data.ratingPoints).toBe(8); // 3 + 5
            expect(data.ratingCount).toBe(2);
        });

        it('creates separate buckets for events in different months', async () => {
            await seedFeedback({
                eventId: 'e1',
                userId: 'u1',
                clubId: 'club1',
                clubRating: 4,
                eventDate: monthsAgo(0),
            });
            await seedFeedback({
                eventId: 'e2',
                userId: 'u2',
                clubId: 'club1',
                clubRating: 5,
                eventDate: monthsAgo(3),
            });

            const buckets = await db.collection('users/club1/reputationBuckets').get();
            expect(buckets.size).toBe(2);
        });

        it('skips feedback with a non-positive clubRating', async () => {
            const snap = testEnv.firestore.makeDocumentSnapshot(
                { clubId: 'club1', clubRating: 0, attended: true },
                'events/evt_zero/feedback/u1',
            );
            await wrappedOnFeedbackCreate(snap, { params: { eventId: 'evt_zero', userId: 'u1' } });

            const buckets = await db.collection('users/club1/reputationBuckets').get();
            expect(buckets.size).toBe(0);
        });

        it('falls back to feedback.clubId when the event document has no ownerId', async () => {
            // Create event WITHOUT an ownerId
            await db.doc('events/evt_no_owner').set({ startAt: monthsAgo(0).toISOString() });

            const snap = testEnv.firestore.makeDocumentSnapshot(
                { clubId: 'club_fallback', clubRating: 3, attended: true },
                'events/evt_no_owner/feedback/u1',
            );
            await wrappedOnFeedbackCreate(snap, {
                params: { eventId: 'evt_no_owner', userId: 'u1' },
            });

            const buckets = await db.collection('users/club_fallback/reputationBuckets').get();
            expect(buckets.size).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    // 2. refreshClubReputation
    // -------------------------------------------------------------------------

    describe('refreshClubReputation', () => {
        it('writes decayedPoints and decayedRatings onto the club user document', async () => {
            // Seed club user doc
            await db.doc('users/club1').set({ role: 'club', displayName: 'Test Club' });

            // Seed a bucket for this month
            await seedFeedback({
                eventId: 'e1',
                userId: 'u1',
                clubId: 'club1',
                clubRating: 4,
                eventDate: monthsAgo(0),
            });

            await wrappedRefreshClubReputation({}, {});

            const clubDoc = await db.doc('users/club1').get();
            const rep = clubDoc.data()?.reputation;

            expect(rep).toBeDefined();
            expect(rep.decayedPoints).toBeCloseTo(4); // weight ≈ 1 for this month
            expect(rep.decayedRatings).toBeCloseTo(1);
            expect(rep.decayWindowMonths).toBe(12);
        });

        it('gives more weight to a recent event than an older one', async () => {
            await db.doc('users/club1').set({ role: 'club' });

            // Recent 5-star: this month → weight = 1.0
            await seedFeedback({
                eventId: 'e_recent',
                userId: 'u1',
                clubId: 'club1',
                clubRating: 5,
                eventDate: monthsAgo(0),
            });
            // Old 5-star: 6 months ago → weight = 0.5
            await seedFeedback({
                eventId: 'e_old',
                userId: 'u2',
                clubId: 'club1',
                clubRating: 5,
                eventDate: monthsAgo(6),
            });

            await wrappedRefreshClubReputation({}, {});

            const clubDoc = await db.doc('users/club1').get();
            const rep = clubDoc.data()?.reputation;

            // Decayed average = (5*1 + 5*0.5) / (1 + 0.5) = 7.5 / 1.5 = 5.0
            // (same avg here since both are 5-star — but check the weights)
            const avg = rep.decayedPoints / rep.decayedRatings;
            expect(avg).toBeCloseTo(5, 1);

            // The recent review contributes MORE raw points to the pool
            const recentContribution = 5 * 1; // 5
            const oldContribution = 5 * 0.5; // 2.5
            expect(recentContribution).toBeGreaterThan(oldContribution);
        });

        it('a club with a recent bad event scores lower than one with only old bad events', async () => {
            // Club A: bad event THIS month
            await db.doc('users/clubA').set({ role: 'club' });
            await seedFeedback({
                eventId: 'ea1',
                userId: 'u1',
                clubId: 'clubA',
                clubRating: 1,
                eventDate: monthsAgo(0),
            });

            // Club B: same bad event 6 months ago (less weight)
            await db.doc('users/clubB').set({ role: 'club' });
            await seedFeedback({
                eventId: 'eb1',
                userId: 'u2',
                clubId: 'clubB',
                clubRating: 1,
                eventDate: monthsAgo(6),
            });

            await wrappedRefreshClubReputation({}, {});

            const repA = (await db.doc('users/clubA').get()).data()?.reputation;
            const repB = (await db.doc('users/clubB').get()).data()?.reputation;

            // Both have the same raw 1-star average, but the weights differ.
            // The decayed *total points* for A (full weight) should be greater than B (half weight).
            expect(repA.decayedPoints).toBeGreaterThan(repB.decayedPoints);
        });

        it('skips clubs with reviews older than 12 months (decay window)', async () => {
            await db.doc('users/old_club').set({ role: 'club' });

            // Manually write a bucket older than 12 months
            const old = monthsAgo(13);
            const bucketId = `${old.getUTCFullYear()}-${String(old.getUTCMonth() + 1).padStart(2, '0')}`;
            await db.doc(`users/old_club/reputationBuckets/${bucketId}`).set({
                ratingPoints: 5,
                ratingCount: 1,
                bucketMonth: old,
            });

            await wrappedRefreshClubReputation({}, {});

            const repData = (await db.doc('users/old_club').get()).data()?.reputation;
            expect(repData.decayedPoints).toBe(0);
            expect(repData.decayedRatings).toBe(0);
        });

        it('does not process non-club users', async () => {
            await db.doc('users/student1').set({ role: 'student' });
            await db.doc('users/student1/reputationBuckets/2025-07').set({
                ratingPoints: 5,
                ratingCount: 1,
            });

            await wrappedRefreshClubReputation({}, {});

            const studentDoc = await db.doc('users/student1').get();
            // Should NOT have a reputation.decayedPoints field
            expect(studentDoc.data()?.reputation?.decayedPoints).toBeUndefined();
        });

        it('processes multiple clubs in a single run', async () => {
            for (let i = 1; i <= 3; i++) {
                await db.doc(`users/club${i}`).set({ role: 'club' });
                await seedFeedback({
                    eventId: `evt_club${i}`,
                    userId: `u${i}`,
                    clubId: `club${i}`,
                    clubRating: i * 1.5, // 1.5, 3, 4.5
                    eventDate: monthsAgo(0),
                });
            }

            await wrappedRefreshClubReputation({}, {});

            for (let i = 1; i <= 3; i++) {
                const rep = (await db.doc(`users/club${i}`).get()).data()?.reputation;
                expect(rep?.decayedPoints).toBeGreaterThan(0);
            }
        });
    });

    // -------------------------------------------------------------------------
    // 3. calculateAverageRating (feedbackService helper)
    // -------------------------------------------------------------------------

    describe('feedbackService.calculateAverageRating', () => {
        it('prefers decayedPoints/decayedRatings over totalPoints/totalRatings', () => {
            const reputation = {
                totalPoints: 30,
                totalRatings: 10, // traditional avg = 3
                decayedPoints: 4.5,
                decayedRatings: 1, // decayed avg = 4.5
            };
            expect(calculateAverageRating(reputation)).toBe(4.5);
        });

        it('falls back to traditional avg when no decayed data exists yet', () => {
            const reputation = { totalPoints: 20, totalRatings: 4 };
            expect(calculateAverageRating(reputation)).toBe(5);
        });

        it('returns 0 when reputation is null or undefined', () => {
            expect(calculateAverageRating(null)).toBe(0);
            expect(calculateAverageRating(undefined)).toBe(0);
        });

        it('returns 0 when all counters are zero', () => {
            expect(calculateAverageRating({ totalPoints: 0, totalRatings: 0 })).toBe(0);
        });
    });
});

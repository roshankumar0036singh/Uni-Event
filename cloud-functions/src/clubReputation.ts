import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldPath } from 'firebase-admin/firestore';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const DECAY_WINDOW_MONTHS = 12;
const PAGE_SIZE = 25;

export const getMonthStart = (date: Date): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export const getMonthDiff = (later: Date, earlier: Date): number =>
    (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
    (later.getUTCMonth() - earlier.getUTCMonth());

export const buildBucketId = (date: Date): string => {
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${date.getUTCFullYear()}-${month}`;
};

export const parseBucketId = (bucketId: string): Date | null => {
    const match = /^([0-9]{4})-([0-9]{2})$/.exec(bucketId);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return new Date(Date.UTC(year, month - 1, 1));
};

export const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const asAny = value as { toDate?: () => Date };
    if (typeof asAny?.toDate === 'function') {
        const parsed = asAny.toDate();
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

export interface ReputationBucket {
    ratingPoints: number;
    ratingCount: number;
    bucketMonth?: unknown;
}

/**
 * Pure function: given a set of monthly rating buckets and the current month,
 * computes the time-decayed weighted points and rating count.
 * Weight formula: weight = 1 - (monthsAgo / DECAY_WINDOW_MONTHS)
 * Buckets older than DECAY_WINDOW_MONTHS are ignored.
 */
export const computeDecayedScore = (
    buckets: Array<{ id: string; data: ReputationBucket }>,
    nowMonth: Date,
    decayWindowMonths: number = DECAY_WINDOW_MONTHS,
): { decayedPoints: number; decayedRatings: number } => {
    let decayedPoints = 0;
    let decayedRatings = 0;

    for (const bucket of buckets) {
        const bucketDate = toDate(bucket.data.bucketMonth) || parseBucketId(bucket.id);
        if (!bucketDate) continue;

        const monthsAgo = getMonthDiff(nowMonth, getMonthStart(bucketDate));
        if (monthsAgo < 0 || monthsAgo >= decayWindowMonths) continue;

        const weight = 1 - monthsAgo / decayWindowMonths;
        const points = Number(bucket.data.ratingPoints);
        const count = Number(bucket.data.ratingCount);

        if (!Number.isFinite(points) || !Number.isFinite(count)) continue;

        decayedPoints += points * weight;
        decayedRatings += count * weight;
    }

    return { decayedPoints, decayedRatings };
};

export const onEventFeedbackCreate = functions.firestore
    .document('events/{eventId}/feedback/{userId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const clubRating = data?.clubRating;
        if (typeof clubRating !== 'number' || clubRating <= 0) {
            return null;
        }

        const eventId = context.params.eventId;
        const eventSnap = await db.doc(`events/${eventId}`).get();
        const eventData = eventSnap.exists ? eventSnap.data() : undefined;

        const clubId = data?.clubId || eventData?.ownerId;
        if (!clubId) return null;

        const eventDate =
            toDate(eventData?.endAt) ||
            toDate(eventData?.startAt) ||
            toDate(data?.submittedAt) ||
            new Date();

        const bucketId = buildBucketId(eventDate);
        const bucketRef = db.doc(`users/${clubId}/reputationBuckets/${bucketId}`);

        await bucketRef.set(
            {
                ratingPoints: admin.firestore.FieldValue.increment(clubRating),
                ratingCount: admin.firestore.FieldValue.increment(1),
                bucketMonth: getMonthStart(eventDate),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        return null;
    });

export const refreshClubReputation = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    const nowMonth = getMonthStart(new Date());
    let query: FirebaseFirestore.Query = db
        .collection('users')
        .where('role', '==', 'club')
        .orderBy(FieldPath.documentId())
        .limit(PAGE_SIZE);

    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let batch = db.batch();
    let opCount = 0;

    while (true) {
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        const snapshot = await query.get();
        if (snapshot.empty) break;

        for (const userDoc of snapshot.docs) {
            const bucketSnap = await userDoc.ref.collection('reputationBuckets').get();
            let decayedPoints = 0;
            let decayedRatings = 0;

            const bucketInputs = bucketSnap.docs.map(b => ({
                id: b.id,
                data: b.data() as ReputationBucket,
            }));
            const { decayedPoints: dp, decayedRatings: dr } = computeDecayedScore(
                bucketInputs,
                nowMonth,
            );
            decayedPoints = dp;
            decayedRatings = dr;

            batch.update(userDoc.ref, {
                'reputation.decayedPoints': decayedPoints,
                'reputation.decayedRatings': decayedRatings,
                'reputation.decayWindowMonths': DECAY_WINDOW_MONTHS,
                'reputation.decayedUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
            });
            opCount += 1;

            if (opCount >= 450) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < PAGE_SIZE) break;
    }

    if (opCount > 0) {
        await batch.commit();
    }

    return null;
});

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { enforceAppCheck } from './middleware/appCheck';

// Initialize only once (important for tests + Firebase runtime)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const REGISTRATION_POINTS = 2;
const ATTENDANCE_POINTS = 10;
const REMINDER_POINTS = 1;
const HALF_LIFE_MONTHS = 6;
const DAYS_PER_MONTH = 30.44;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REPUTATION_BUCKETS_COLLECTION = 'reputationBuckets';
const PAGE_SIZE = 500;

type BucketDeltas = {
    registrations?: number;
    attendances?: number;
    reminders?: number;
};

type BucketTotals = {
    userId: string;
    monthKey: string;
    registrations: number;
    attendances: number;
    reminders: number;
};

/**
 * Robustly parses a mixed input into a Date object or null.
 * Handles Firestore Timestamps, Date objects, and ISO strings.
 *
 * @param value The raw date value
 * @returns A parsed Date object or null if invalid
 */
const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate();
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        const parsed = (value as { toDate: () => Date }).toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    return null;
};

/**
 * Formats a Date object into a string key representing the month.
 *
 * @param date The Date object to format
 * @returns A string in the format YYYY-MM
 */
export const getMonthKeyFromDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

/**
 * Parses a month key string into a Date representing the first day of that month.
 *
 * @param monthKey The YYYY-MM string
 * @returns The Date object for the 1st of the month, or null if invalid
 */
export const getMonthStartFromKey = (monthKey: string): Date | null => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return new Date(Date.UTC(year, month - 1, 1));
};

/**
 * Resolves the start date of an event securely. Uses an authoritative lookup if
 * the eventId is provided, falling back to client-provided data if necessary.
 *
 * @param eventId The optional event ID
 * @param eventStartAt The fallback client-provided start date
 * @param eventCache A cache of already looked-up events
 * @returns A promise resolving to the start date or null
 */
export const resolveEventStartAt = async (
    eventId: string | undefined,
    eventStartAt: unknown,
    eventCache: Map<string, Date | null>,
): Promise<Date | null> => {
    // Priority 1: Authoritative DB lookup (mitigates client spoofing)
    if (eventId) {
        if (!eventCache.has(eventId)) {
            const eventSnap = await db.collection('events').doc(eventId).get();
            const authoritativeDate = eventSnap.exists ? toDate(eventSnap.data()?.startAt) : null;
            eventCache.set(eventId, authoritativeDate);
        }

        const cachedDate = eventCache.get(eventId);
        if (cachedDate) {
            // Only warn if client spoofed a totally different date
            const clientDate = toDate(eventStartAt);
            if (clientDate && clientDate.getTime() !== cachedDate.getTime()) {
                console.warn(`User spoofing detected for event ${eventId}. Using authoritative date.`);
            }
            return cachedDate;
        }
    }

    // Priority 2: Client-provided fallback
    return toDate(eventStartAt);
};

/**
 * Updates a user's reputation bucket by applying deltas. Handles idempotency if a key is provided.
 *
 * @param userId The ID of the user
 * @param eventStartAt The date determining which monthly bucket to update
 * @param deltas The incremental changes to apply (registrations, attendances, reminders)
 * @param idempotencyKey An optional key to prevent duplicate trigger processing
 * @returns A promise resolving when the transaction/update completes
 */
export const updateBucket = (
    userId: string,
    eventStartAt: Date,
    deltas: BucketDeltas,
    idempotencyKey?: string
) => {
    const monthKey = getMonthKeyFromDate(eventStartAt);
    const bucketRef = db
        .collection('users')
        .doc(userId)
        .collection(REPUTATION_BUCKETS_COLLECTION)
        .doc(monthKey);

    const buildUpdates = () => {
        const updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
            monthKey,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (deltas.registrations) updates.registrations = admin.firestore.FieldValue.increment(deltas.registrations);
        if (deltas.attendances) updates.attendances = admin.firestore.FieldValue.increment(deltas.attendances);
        if (deltas.reminders) updates.reminders = admin.firestore.FieldValue.increment(deltas.reminders);
        return updates;
    };

    if (!idempotencyKey) {
        return bucketRef.set(buildUpdates(), { merge: true });
    }

    const processedRef = bucketRef.collection('processedTriggers').doc(idempotencyKey);
    return db.runTransaction(async (transaction) => {
        const processedDoc = await transaction.get(processedRef);
        if (processedDoc.exists) return;
        transaction.set(bucketRef, buildUpdates(), { merge: true });
        
        const expireAt = new Date();
        expireAt.setDate(expireAt.getDate() + 30);
        
        transaction.set(processedRef, { 
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            expireAt
        });
    });
};

/**
 * Recalculates reputation points for all users by paginating through Firestore.
 * Points are decayed based on the age of their respective monthly buckets.
 *
 * @returns A promise resolving to the total number of users updated
 */
export const runReputationRefresh = async () => {
    const now = new Date();
    let updatedUsers = 0;

    await paginateQuery(db.collection('users'), async (docs) => {
        const batch = db.batch();

        await Promise.all(docs.map(async (userDoc) => {
            const bucketsSnapshot = await userDoc.ref
                .collection(REPUTATION_BUCKETS_COLLECTION)
                .get();

            let attendanceCount = 0;
            let registrationCount = 0;
            let remindersSet = 0;
            let points = 0;

            for (const bucketDoc of bucketsSnapshot.docs) {
                const bucketData = bucketDoc.data() || {};
                const monthKey =
                    typeof bucketData.monthKey === 'string' ? bucketData.monthKey : bucketDoc.id;
                const monthStart = getMonthStartFromKey(monthKey);
                if (!monthStart) {
                    continue;
                }

                const ageMonths = Math.max(
                    0,
                    (now.getTime() - monthStart.getTime()) / (MS_PER_DAY * DAYS_PER_MONTH),
                );
                const decay = Math.pow(2, -ageMonths / HALF_LIFE_MONTHS);

                const registrations = Number(bucketData.registrations || 0);
                const attendances = Number(bucketData.attendances || 0);
                const reminders = Number(bucketData.reminders || 0);

                registrationCount += registrations;
                attendanceCount += attendances;
                remindersSet += reminders;

                points += registrations * REGISTRATION_POINTS * decay;
                points += attendances * ATTENDANCE_POINTS * decay;
                points += reminders * REMINDER_POINTS * decay;
            }
            
            batch.update(userDoc.ref, {
                'reputation.points': points,
                'reputation.attendanceCount': attendanceCount,
                'reputation.registrationCount': registrationCount,
                'reputation.remindersSet': remindersSet,
                'reputation.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
            });
            updatedUsers += 1;
        }));

        await batch.commit();
    });

    return updatedUsers;
};

/**
 * Helper to paginate through a Firestore query in chunks of PAGE_SIZE.
 *
 * @param query The Firestore query to paginate
 * @param handleDocs A callback to process each page of documents
 */
const paginateQuery = async (
    query: FirebaseFirestore.Query,
    handleDocs: (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => Promise<void>,
) => {
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (true) {
        let pageQuery = query.orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
        if (lastDoc) {
            pageQuery = pageQuery.startAfter(lastDoc);
        }
        const snapshot = await pageQuery.get();
        if (snapshot.empty) {
            break;
        }
        await handleDocs(snapshot.docs);
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < PAGE_SIZE) {
            break;
        }
    }
};

const addToBucketTotals = (
    totals: Map<string, BucketTotals>,
    userId: string,
    monthKey: string,
    field: keyof BucketDeltas,
) => {
    const key = `${userId}::${monthKey}`;
    const existing = totals.get(key) || {
        userId,
        monthKey,
        registrations: 0,
        attendances: 0,
        reminders: 0,
    };
    existing[field] += 1;
    totals.set(key, existing);
};

/**
 * Calculates reputation for all users/students based on monthly buckets.
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

    const updatedUsers = await runReputationRefresh();

    return {
        success: true,
        message: `Updated reputation for ${updatedUsers} users`,
    };
});

export const refreshReputationDaily = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    await runReputationRefresh();
    return null;
});

/**
 * Standardized handler for all reputation-affecting Firestore triggers.
 *
 * @param userId The ID of the affected user
 * @param eventId The ID of the related event
 * @param data The document data containing fallback event metadata
 * @param contextId The trigger context ID for idempotency
 * @param deltas The points deltas to apply to the bucket
 * @param prefix The idempotency prefix identifier
 * @returns A promise resolving when the processing completes
 */
const handleReputationTrigger = async (
    userId: string | undefined,
    eventId: string | undefined,
    data: admin.firestore.DocumentData | undefined,
    contextId: string,
    deltas: BucketDeltas,
    prefix: string
) => {
    const eventCache = new Map<string, Date | null>();
    const eventStartAt = await resolveEventStartAt(
        eventId,
        data?.eventStartAt ?? data?.eventDate,
        eventCache,
    );

    if (!userId || !eventStartAt) {
        console.warn(`Missing eventStartAt or userId for ${prefix}`, { userId, eventId });
        return null;
    }

    await updateBucket(userId, eventStartAt, deltas, `${prefix}_${contextId}`);
    return null;
};

/**
 * Trigger: Fires when a user registers for an event.
 */
export const onParticipatingCreate = functions.firestore
    .document('users/{userId}/participating/{eventId}')
    .onCreate((snap, context) => handleReputationTrigger(
        context.params.userId,
        context.params.eventId,
        snap.data(),
        context.eventId,
        { registrations: 1 },
        'participating_create'
    ));

/**
 * Trigger: Fires when a user cancels their registration.
 */
export const onParticipatingDelete = functions.firestore
    .document('users/{userId}/participating/{eventId}')
    .onDelete((snap, context) => handleReputationTrigger(
        context.params.userId,
        context.params.eventId,
        snap.data(),
        context.eventId,
        { registrations: -1 },
        'participating_delete'
    ));

/**
 * Trigger: Fires when a user is marked as checked-in (attended).
 */
export const onCheckInCreate = functions.firestore
    .document('events/{eventId}/checkIns/{userId}')
    .onCreate((snap, context) => handleReputationTrigger(
        context.params.userId,
        context.params.eventId,
        snap.data(),
        context.eventId,
        { attendances: 1 },
        'checkin_create'
    ));

/**
 * Trigger: Fires when a user's check-in is revoked.
 */
export const onCheckInDelete = functions.firestore
    .document('events/{eventId}/checkIns/{userId}')
    .onDelete((snap, context) => handleReputationTrigger(
        context.params.userId,
        context.params.eventId,
        snap.data(),
        context.eventId,
        { attendances: -1 },
        'checkin_delete'
    ));

/**
 * Trigger: Fires when a user sets a reminder for an event.
 */
export const onReminderCreate = functions.firestore
    .document('reminders/{reminderId}')
    .onCreate((snap, context) => {
        const data = snap.data();
        return handleReputationTrigger(
            data?.userId,
            data?.eventId,
            data,
            context.eventId,
            { reminders: 1 },
            'reminder_create'
        );
    });

/**
 * Trigger: Fires when a user deletes a reminder for an event.
 */
export const onReminderDelete = functions.firestore
    .document('reminders/{reminderId}')
    .onDelete((snap, context) => {
        const data = snap.data();
        return handleReputationTrigger(
            data?.userId,
            data?.eventId,
            data,
            context.eventId,
            { reminders: -1 },
            'reminder_delete'
        );
    });

export const backfillReputationBuckets = functions.https.onCall(async (_data, context) => {
    if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admin can backfill reputation buckets.',
        );
    }

    const eventCache = new Map<string, Date | null>();
    const bucketTotals = new Map<string, BucketTotals>();
    const scanned = {
        participating: 0,
        checkIns: 0,
        reminders: 0,
        skipped: 0,
    };

    await paginateQuery(db.collectionGroup('participating'), async docs => {
        for (const doc of docs) {
            scanned.participating += 1;
            const data = doc.data();
            const userId = doc.ref.parent.parent?.id;
            const eventId = data?.eventId || doc.id;
            const eventStartAt = await resolveEventStartAt(
                eventId,
                data?.eventStartAt ?? data?.eventDate,
                eventCache,
            );

            if (!userId || !eventStartAt) {
                scanned.skipped += 1;
                continue;
            }

            const monthKey = getMonthKeyFromDate(eventStartAt);
            addToBucketTotals(bucketTotals, userId, monthKey, 'registrations');
        }
    });

    await paginateQuery(db.collectionGroup('checkIns'), async docs => {
        for (const doc of docs) {
            scanned.checkIns += 1;
            const data = doc.data();
            const userId = data?.userId || doc.id;
            const eventId = doc.ref.parent.parent?.id;
            const eventStartAt = await resolveEventStartAt(
                eventId,
                data?.eventStartAt ?? data?.eventDate,
                eventCache,
            );

            if (!userId || !eventStartAt) {
                scanned.skipped += 1;
                continue;
            }

            const monthKey = getMonthKeyFromDate(eventStartAt);
            addToBucketTotals(bucketTotals, userId, monthKey, 'attendances');
        }
    });

    await paginateQuery(db.collection('reminders'), async docs => {
        for (const doc of docs) {
            scanned.reminders += 1;
            const data = doc.data();
            const userId = data?.userId;
            const eventId = data?.eventId;
            const eventStartAt = await resolveEventStartAt(eventId, data?.eventStartAt ?? data?.eventDate,eventCache,);

            if (!userId || !eventStartAt) {
                scanned.skipped += 1;
                continue;
            }

            const monthKey = getMonthKeyFromDate(eventStartAt);
            addToBucketTotals(bucketTotals, userId, monthKey, 'reminders');
        }
    });

    let batch = db.batch();
    let opCount = 0;
    let updatedBuckets = 0;

    for (const bucket of bucketTotals.values()) {
        const bucketRef = db
            .collection('users')
            .doc(bucket.userId)
            .collection(REPUTATION_BUCKETS_COLLECTION)
            .doc(bucket.monthKey);

        batch.set(
            bucketRef,
            {
                monthKey: bucket.monthKey,
                registrations: admin.firestore.FieldValue.increment(bucket.registrations),
                attendances: admin.firestore.FieldValue.increment(bucket.attendances),
                reminders: admin.firestore.FieldValue.increment(bucket.reminders),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        opCount += 1;
        updatedBuckets += 1;

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
        updatedBuckets,
        scanned,
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
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.',
        );
    }
    enforceAppCheck(context);
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

    const lastContributor =
        contributors.length > 0 ? contributors[contributors.length - 1] : null;

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

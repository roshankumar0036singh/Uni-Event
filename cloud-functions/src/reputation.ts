import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

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

export const getMonthKeyFromDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

export const getMonthStartFromKey = (monthKey: string): Date | null => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return new Date(Date.UTC(year, month - 1, 1));
};

export const resolveEventStartAt = async (
    eventId: string | undefined,
    eventStartAt: unknown,
    eventCache: Map<string, Date | null>,
): Promise<Date | null> => {
    const directDate = toDate(eventStartAt);
    if (directDate) {
        return directDate;
    }
    if (!eventId) {
        return null;
    }
    if (eventCache.has(eventId)) {
        return eventCache.get(eventId) ?? null;
    }
    const eventSnap = await db.collection('events').doc(eventId).get();
    const resolved = eventSnap.exists ? toDate(eventSnap.data()?.startAt) : null;
    eventCache.set(eventId, resolved);
    return resolved;
};

export const updateBucket = async (userId: string, eventStartAt: Date, deltas: BucketDeltas) => {
    const monthKey = getMonthKeyFromDate(eventStartAt);
    const bucketRef = db
        .collection('users')
        .doc(userId)
        .collection(REPUTATION_BUCKETS_COLLECTION)
        .doc(monthKey);

    const updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        monthKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (deltas.registrations) {
        updates.registrations = admin.firestore.FieldValue.increment(deltas.registrations);
    }
    if (deltas.attendances) {
        updates.attendances = admin.firestore.FieldValue.increment(deltas.attendances);
    }
    if (deltas.reminders) {
        updates.reminders = admin.firestore.FieldValue.increment(deltas.reminders);
    }

    return bucketRef.set(updates, { merge: true });
};

export const runReputationRefresh = async () => {
    const usersSnapshot = await db.collection('users').get();
    const now = new Date();
    let batch = db.batch();
    let opCount = 0;
    let updatedUsers = 0;

    for (const userDoc of usersSnapshot.docs) {
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
        opCount += 1;
        updatedUsers += 1;

        if (opCount === 500) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }

    return updatedUsers;
};

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

export const onParticipatingCreate = functions.firestore
    .document('users/{userId}/participating/{eventId}')
    .onCreate(async (snap, context) => {
        const { userId, eventId } = context.params;
        const data = snap.data();
        const eventCache = new Map<string, Date | null>();
        const eventStartAt = await resolveEventStartAt(
            eventId,
            data?.eventStartAt ?? data?.eventDate,
            eventCache,
        );

        if (!eventStartAt) {
            console.warn('Missing eventStartAt for participation', { userId, eventId });
            return null;
        }

        await updateBucket(userId, eventStartAt, { registrations: 1 });
        return null;
    });

export const onParticipatingDelete = functions.firestore
    .document('users/{userId}/participating/{eventId}')
    .onDelete(async (snap, context) => {
        const { userId, eventId } = context.params;
        const data = snap.data();
        const eventCache = new Map<string, Date | null>();
        const eventStartAt = await resolveEventStartAt(
            eventId,
            data?.eventStartAt ?? data?.eventDate,
            eventCache,
        );

        if (!eventStartAt) {
            console.warn('Missing eventStartAt for participation delete', { userId, eventId });
            return null;
        }

        await updateBucket(userId, eventStartAt, { registrations: -1 });
        return null;
    });

export const onCheckInCreate = functions.firestore
    .document('events/{eventId}/checkIns/{userId}')
    .onCreate(async (snap, context) => {
        const { eventId, userId } = context.params;
        const data = snap.data();
        const eventCache = new Map<string, Date | null>();
        const eventStartAt = await resolveEventStartAt(
            eventId,
            data?.eventStartAt ?? data?.eventDate,
            eventCache,
        );

        if (!eventStartAt) {
            console.warn('Missing eventStartAt for check-in', { userId, eventId });
            return null;
        }

        await updateBucket(userId, eventStartAt, { attendances: 1 });
        return null;
    });

export const onCheckInDelete = functions.firestore
    .document('events/{eventId}/checkIns/{userId}')
    .onDelete(async (snap, context) => {
        const { eventId, userId } = context.params;
        const data = snap.data();
        const eventCache = new Map<string, Date | null>();
        const eventStartAt = await resolveEventStartAt(
            eventId,
            data?.eventStartAt ?? data?.eventDate,
            eventCache,
        );

        if (!eventStartAt) {
            console.warn('Missing eventStartAt for check-in delete', { userId, eventId });
            return null;
        }

        await updateBucket(userId, eventStartAt, { attendances: -1 });
        return null;
    });

export const onReminderCreate = functions.firestore
    .document('reminders/{reminderId}')
    .onCreate(async (snap, _context) => {
        const data = snap.data();
        const userId = data?.userId;
        const eventId = data?.eventId;
        const eventCache = new Map<string, Date | null>();
        const eventStartAt = await resolveEventStartAt(eventId, data?.eventStartAt, eventCache);

        if (!userId || !eventStartAt) {
            console.warn('Missing eventStartAt for reminder', { userId, eventId });
            return null;
        }

        await updateBucket(userId, eventStartAt, { reminders: 1 });
        return null;
    });

export const onReminderDelete = functions.firestore
    .document('reminders/{reminderId}')
    .onDelete(async (snap, _context) => {
        const data = snap.data();
        const userId = data?.userId;
        const eventId = data?.eventId;
        const eventCache = new Map<string, Date | null>();
        const eventStartAt = await resolveEventStartAt(eventId, data?.eventStartAt, eventCache);

        if (!userId || !eventStartAt) {
            console.warn('Missing eventStartAt for reminder delete', { userId, eventId });
            return null;
        }

        await updateBucket(userId, eventStartAt, { reminders: -1 });
        return null;
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
            const eventStartAt = await resolveEventStartAt(eventId, data?.eventStartAt, eventCache);

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
                registrations: bucket.registrations,
                attendances: bucket.attendances,
                reminders: bucket.reminders,
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

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopContributors = exports.refreshTopContributorsLeaderboard = exports.backfillReputationBuckets = exports.onReminderDelete = exports.onReminderCreate = exports.onCheckInDelete = exports.onCheckInCreate = exports.onParticipatingDelete = exports.onParticipatingCreate = exports.refreshReputationDaily = exports.calculateReputation = exports.runReputationRefresh = exports.updateBucket = exports.resolveEventStartAt = exports.getMonthStartFromKey = exports.getMonthKeyFromDate = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
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
const toDate = (value) => {
    if (!value)
        return null;
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
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        const parsed = value.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    return null;
};
const getMonthKeyFromDate = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};
exports.getMonthKeyFromDate = getMonthKeyFromDate;
const getMonthStartFromKey = (monthKey) => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return new Date(Date.UTC(year, month - 1, 1));
};
exports.getMonthStartFromKey = getMonthStartFromKey;
const resolveEventStartAt = async (eventId, eventStartAt, eventCache) => {
    var _a, _b;
    const directDate = toDate(eventStartAt);
    if (directDate) {
        return directDate;
    }
    if (!eventId) {
        return null;
    }
    if (eventCache.has(eventId)) {
        return (_a = eventCache.get(eventId)) !== null && _a !== void 0 ? _a : null;
    }
    const eventSnap = await db.collection('events').doc(eventId).get();
    const resolved = eventSnap.exists ? toDate((_b = eventSnap.data()) === null || _b === void 0 ? void 0 : _b.startAt) : null;
    eventCache.set(eventId, resolved);
    return resolved;
};
exports.resolveEventStartAt = resolveEventStartAt;
const updateBucket = async (userId, eventStartAt, deltas) => {
    const monthKey = (0, exports.getMonthKeyFromDate)(eventStartAt);
    const bucketRef = db
        .collection('users')
        .doc(userId)
        .collection(REPUTATION_BUCKETS_COLLECTION)
        .doc(monthKey);
    const updates = {
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
exports.updateBucket = updateBucket;
const runReputationRefresh = async () => {
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
            const monthKey = typeof bucketData.monthKey === 'string' ? bucketData.monthKey : bucketDoc.id;
            const monthStart = (0, exports.getMonthStartFromKey)(monthKey);
            if (!monthStart) {
                continue;
            }
            const ageMonths = Math.max(0, (now.getTime() - monthStart.getTime()) / (MS_PER_DAY * DAYS_PER_MONTH));
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
exports.runReputationRefresh = runReputationRefresh;
const paginateQuery = async (query, handleDocs) => {
    let lastDoc = null;
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
const addToBucketTotals = (totals, userId, monthKey, field) => {
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
exports.calculateReputation = functions.https.onCall(async (_data, context) => {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admin can calculate reputation.');
    }
    const updatedUsers = await (0, exports.runReputationRefresh)();
    return {
        success: true,
        message: `Updated reputation for ${updatedUsers} users`,
    };
});
exports.refreshReputationDaily = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    await (0, exports.runReputationRefresh)();
    return null;
});
exports.onParticipatingCreate = functions.firestore
    .document('users/{userId}/participating/{eventId}')
    .onCreate(async (snap, context) => {
    var _a;
    const { userId, eventId } = context.params;
    const data = snap.data();
    const eventCache = new Map();
    const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, (_a = data === null || data === void 0 ? void 0 : data.eventStartAt) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.eventDate, eventCache);
    if (!eventStartAt) {
        console.warn('Missing eventStartAt for participation', { userId, eventId });
        return null;
    }
    await (0, exports.updateBucket)(userId, eventStartAt, { registrations: 1 });
    return null;
});
exports.onParticipatingDelete = functions.firestore
    .document('users/{userId}/participating/{eventId}')
    .onDelete(async (snap, context) => {
    var _a;
    const { userId, eventId } = context.params;
    const data = snap.data();
    const eventCache = new Map();
    const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, (_a = data === null || data === void 0 ? void 0 : data.eventStartAt) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.eventDate, eventCache);
    if (!eventStartAt) {
        console.warn('Missing eventStartAt for participation delete', { userId, eventId });
        return null;
    }
    await (0, exports.updateBucket)(userId, eventStartAt, { registrations: -1 });
    return null;
});
exports.onCheckInCreate = functions.firestore
    .document('events/{eventId}/checkIns/{userId}')
    .onCreate(async (snap, context) => {
    var _a;
    const { eventId, userId } = context.params;
    const data = snap.data();
    const eventCache = new Map();
    const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, (_a = data === null || data === void 0 ? void 0 : data.eventStartAt) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.eventDate, eventCache);
    if (!eventStartAt) {
        console.warn('Missing eventStartAt for check-in', { userId, eventId });
        return null;
    }
    await (0, exports.updateBucket)(userId, eventStartAt, { attendances: 1 });
    return null;
});
exports.onCheckInDelete = functions.firestore
    .document('events/{eventId}/checkIns/{userId}')
    .onDelete(async (snap, context) => {
    var _a;
    const { eventId, userId } = context.params;
    const data = snap.data();
    const eventCache = new Map();
    const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, (_a = data === null || data === void 0 ? void 0 : data.eventStartAt) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.eventDate, eventCache);
    if (!eventStartAt) {
        console.warn('Missing eventStartAt for check-in delete', { userId, eventId });
        return null;
    }
    await (0, exports.updateBucket)(userId, eventStartAt, { attendances: -1 });
    return null;
});
exports.onReminderCreate = functions.firestore
    .document('reminders/{reminderId}')
    .onCreate(async (snap, _context) => {
    const data = snap.data();
    const userId = data === null || data === void 0 ? void 0 : data.userId;
    const eventId = data === null || data === void 0 ? void 0 : data.eventId;
    const eventCache = new Map();
    const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, data === null || data === void 0 ? void 0 : data.eventStartAt, eventCache);
    if (!userId || !eventStartAt) {
        console.warn('Missing eventStartAt for reminder', { userId, eventId });
        return null;
    }
    await (0, exports.updateBucket)(userId, eventStartAt, { reminders: 1 });
    return null;
});
exports.onReminderDelete = functions.firestore
    .document('reminders/{reminderId}')
    .onDelete(async (snap, _context) => {
    const data = snap.data();
    const userId = data === null || data === void 0 ? void 0 : data.userId;
    const eventId = data === null || data === void 0 ? void 0 : data.eventId;
    const eventCache = new Map();
    const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, data === null || data === void 0 ? void 0 : data.eventStartAt, eventCache);
    if (!userId || !eventStartAt) {
        console.warn('Missing eventStartAt for reminder delete', { userId, eventId });
        return null;
    }
    await (0, exports.updateBucket)(userId, eventStartAt, { reminders: -1 });
    return null;
});
exports.backfillReputationBuckets = functions.https.onCall(async (_data, context) => {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admin can backfill reputation buckets.');
    }
    const eventCache = new Map();
    const bucketTotals = new Map();
    const scanned = {
        participating: 0,
        checkIns: 0,
        reminders: 0,
        skipped: 0,
    };
    await paginateQuery(db.collectionGroup('participating'), async (docs) => {
        var _a, _b;
        for (const doc of docs) {
            scanned.participating += 1;
            const data = doc.data();
            const userId = (_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
            const eventId = (data === null || data === void 0 ? void 0 : data.eventId) || doc.id;
            const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, (_b = data === null || data === void 0 ? void 0 : data.eventStartAt) !== null && _b !== void 0 ? _b : data === null || data === void 0 ? void 0 : data.eventDate, eventCache);
            if (!userId || !eventStartAt) {
                scanned.skipped += 1;
                continue;
            }
            const monthKey = (0, exports.getMonthKeyFromDate)(eventStartAt);
            addToBucketTotals(bucketTotals, userId, monthKey, 'registrations');
        }
    });
    await paginateQuery(db.collectionGroup('checkIns'), async (docs) => {
        var _a, _b;
        for (const doc of docs) {
            scanned.checkIns += 1;
            const data = doc.data();
            const userId = (data === null || data === void 0 ? void 0 : data.userId) || doc.id;
            const eventId = (_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
            const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, (_b = data === null || data === void 0 ? void 0 : data.eventStartAt) !== null && _b !== void 0 ? _b : data === null || data === void 0 ? void 0 : data.eventDate, eventCache);
            if (!userId || !eventStartAt) {
                scanned.skipped += 1;
                continue;
            }
            const monthKey = (0, exports.getMonthKeyFromDate)(eventStartAt);
            addToBucketTotals(bucketTotals, userId, monthKey, 'attendances');
        }
    });
    await paginateQuery(db.collection('reminders'), async (docs) => {
        for (const doc of docs) {
            scanned.reminders += 1;
            const data = doc.data();
            const userId = data === null || data === void 0 ? void 0 : data.userId;
            const eventId = data === null || data === void 0 ? void 0 : data.eventId;
            const eventStartAt = await (0, exports.resolveEventStartAt)(eventId, data === null || data === void 0 ? void 0 : data.eventStartAt, eventCache);
            if (!userId || !eventStartAt) {
                scanned.skipped += 1;
                continue;
            }
            const monthKey = (0, exports.getMonthKeyFromDate)(eventStartAt);
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
        batch.set(bucketRef, {
            monthKey: bucket.monthKey,
            registrations: bucket.registrations,
            attendances: bucket.attendances,
            reminders: bucket.reminders,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
exports.refreshTopContributorsLeaderboard = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async () => {
    const usersSnapshot = await db
        .collection('users')
        .orderBy('reputation.points', 'desc')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(10)
        .get();
    const contributors = usersSnapshot.docs.map((doc, index) => {
        var _a, _b, _c, _d;
        const userData = doc.data();
        return {
            userId: doc.id,
            rank: index + 1,
            name: userData.name || userData.fullName || userData.displayName || 'Unknown Student',
            department: userData.department || '',
            photoURL: userData.photoURL || '',
            points: ((_a = userData.reputation) === null || _a === void 0 ? void 0 : _a.points) || 0,
            attendanceCount: ((_b = userData.reputation) === null || _b === void 0 ? void 0 : _b.attendanceCount) || 0,
            registrationCount: ((_c = userData.reputation) === null || _c === void 0 ? void 0 : _c.registrationCount) || 0,
            remindersSet: ((_d = userData.reputation) === null || _d === void 0 ? void 0 : _d.remindersSet) || 0,
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
exports.getTopContributors = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const limit = Math.min((data === null || data === void 0 ? void 0 : data.limit) || 10, 25);
    const lastPoints = data === null || data === void 0 ? void 0 : data.lastPoints;
    const lastUserId = data === null || data === void 0 ? void 0 : data.lastUserId;
    const startRank = (data === null || data === void 0 ? void 0 : data.startRank) || 1;
    let query = db
        .collection('users')
        .orderBy('reputation.points', 'desc')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(limit);
    if (typeof lastPoints === 'number' && typeof lastUserId === 'string') {
        query = query.startAfter(lastPoints, lastUserId);
    }
    const usersSnapshot = await query.get();
    const contributors = usersSnapshot.docs.map((doc, index) => {
        var _a, _b, _c, _d;
        const userData = doc.data();
        return {
            userId: doc.id,
            rank: startRank + index,
            name: userData.name || userData.fullName || userData.displayName || 'Unknown Student',
            department: userData.department || '',
            photoURL: userData.photoURL || '',
            points: ((_a = userData.reputation) === null || _a === void 0 ? void 0 : _a.points) || 0,
            attendanceCount: ((_b = userData.reputation) === null || _b === void 0 ? void 0 : _b.attendanceCount) || 0,
            registrationCount: ((_c = userData.reputation) === null || _c === void 0 ? void 0 : _c.registrationCount) || 0,
            remindersSet: ((_d = userData.reputation) === null || _d === void 0 ? void 0 : _d.remindersSet) || 0,
        };
    });
    const lastContributor = contributors.length > 0 ? contributors[contributors.length - 1] : null;
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

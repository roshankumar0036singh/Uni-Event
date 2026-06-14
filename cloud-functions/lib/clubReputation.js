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
exports.refreshClubReputation = exports.onEventFeedbackCreate = exports.computeDecayedScore = exports.toDate = exports.parseBucketId = exports.buildBucketId = exports.getMonthDiff = exports.getMonthStart = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const DECAY_WINDOW_MONTHS = 12;
const PAGE_SIZE = 25;
const getMonthStart = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
exports.getMonthStart = getMonthStart;
const getMonthDiff = (later, earlier) => (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
    (later.getUTCMonth() - earlier.getUTCMonth());
exports.getMonthDiff = getMonthDiff;
const buildBucketId = (date) => {
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${date.getUTCFullYear()}-${month}`;
};
exports.buildBucketId = buildBucketId;
const parseBucketId = (bucketId) => {
    const match = /^(\d{4})-(\d{2})$/.exec(bucketId);
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return new Date(Date.UTC(year, month - 1, 1));
};
exports.parseBucketId = parseBucketId;
const toDate = (value) => {
    if (value == null || value === '')
        return null;
    if (value instanceof Date)
        return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const asAny = value;
    if (typeof asAny?.toDate === 'function') {
        const parsed = asAny.toDate();
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};
exports.toDate = toDate;
/**
 * Pure function: given a set of monthly rating buckets and the current month,
 * computes the time-decayed weighted points and rating count.
 * Weight formula: weight = 1 - (monthsAgo / DECAY_WINDOW_MONTHS)
 * Buckets older than DECAY_WINDOW_MONTHS are ignored.
 */
const computeDecayedScore = (buckets, nowMonth, decayWindowMonths = DECAY_WINDOW_MONTHS) => {
    let decayedPoints = 0;
    let decayedRatings = 0;
    for (const bucket of buckets) {
        const bucketDate = (0, exports.toDate)(bucket.data.bucketMonth) || (0, exports.parseBucketId)(bucket.id);
        if (!bucketDate)
            continue;
        const monthsAgo = (0, exports.getMonthDiff)(nowMonth, (0, exports.getMonthStart)(bucketDate));
        if (monthsAgo < 0 || monthsAgo >= decayWindowMonths)
            continue;
        const weight = 1 - monthsAgo / decayWindowMonths;
        const points = Number(bucket.data.ratingPoints);
        const count = Number(bucket.data.ratingCount);
        if (!Number.isFinite(points) || !Number.isFinite(count))
            continue;
        decayedPoints += points * weight;
        decayedRatings += count * weight;
    }
    return { decayedPoints, decayedRatings };
};
exports.computeDecayedScore = computeDecayedScore;
exports.onEventFeedbackCreate = functions.firestore
    .document('events/{eventId}/feedback/{userId}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    const clubRating = data?.clubRating;
    if (!Number.isFinite(clubRating) || clubRating < 1 || clubRating > 5) {
        return null;
    }
    const eventId = context.params.eventId;
    const eventSnap = await db.doc(`events/${eventId}`).get();
    const eventData = eventSnap.exists ? eventSnap.data() : undefined;
    const clubId = eventData?.ownerId || data?.clubId;
    if (!clubId)
        return null;
    const eventDate = (0, exports.toDate)(eventData?.endAt) ||
        (0, exports.toDate)(eventData?.startAt) ||
        (0, exports.toDate)(data?.submittedAt) ||
        new Date();
    const userId = context.params.userId;
    const bucketId = (0, exports.buildBucketId)(eventDate);
    const bucketRef = db.doc(`users/${clubId}/reputationBuckets/${bucketId}`);
    const markerRef = db.doc(`users/${clubId}/processedFeedbacks/${eventId}_${userId}`);
    return db.runTransaction(async (transaction) => {
        const markerSnap = await transaction.get(markerRef);
        if (markerSnap.exists) {
            return null; // Idempotency check: already processed
        }
        transaction.set(markerRef, {
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(bucketRef, {
            ratingPoints: admin.firestore.FieldValue.increment(clubRating),
            ratingCount: admin.firestore.FieldValue.increment(1),
            bucketMonth: (0, exports.getMonthStart)(eventDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
});
exports.refreshClubReputation = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    const nowMonth = (0, exports.getMonthStart)(new Date());
    const cutoffMonth = new Date(Date.UTC(nowMonth.getUTCFullYear(), nowMonth.getUTCMonth() - DECAY_WINDOW_MONTHS + 1, 1));
    const baseQuery = db
        .collection('users')
        .where('role', '==', 'club')
        .orderBy(firestore_1.FieldPath.documentId())
        .limit(PAGE_SIZE);
    let lastDoc = null;
    let batch = db.batch();
    let opCount = 0;
    while (true) {
        const pageQuery = lastDoc
            ? baseQuery.startAfter(lastDoc)
            : baseQuery;
        const snapshot = await pageQuery.get();
        if (snapshot.empty)
            break;
        await Promise.all(snapshot.docs.map(async (userDoc) => {
            const bucketSnap = await userDoc.ref
                .collection('reputationBuckets')
                .where('bucketMonth', '>=', cutoffMonth)
                .get();
            const bucketInputs = bucketSnap.docs.map((b) => ({
                id: b.id,
                data: b.data(),
            }));
            const { decayedPoints, decayedRatings } = (0, exports.computeDecayedScore)(bucketInputs, nowMonth);
            batch.update(userDoc.ref, {
                'reputation.decayedPoints': decayedPoints,
                'reputation.decayedRatings': decayedRatings,
                'reputation.decayWindowMonths': DECAY_WINDOW_MONTHS,
                'reputation.decayedUpdatedAt': admin.firestore.FieldValue.serverTimestamp(),
            });
            opCount += 1;
        }));
        if (opCount >= 450) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < PAGE_SIZE)
            break;
    }
    if (opCount > 0) {
        await batch.commit();
    }
    return null;
});

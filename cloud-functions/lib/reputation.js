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
exports.getTopContributors = exports.refreshTopContributorsLeaderboard = exports.calculateReputation = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * Calculates reputation for all users/students.
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
    const usersSnapshot = await db.collection('users').get();
    const updates = [];
    usersSnapshot.forEach(userDoc => {
        var _a, _b, _c;
        const userData = userDoc.data();
        const attendanceCount = ((_a = userData.reputation) === null || _a === void 0 ? void 0 : _a.attendanceCount) || userData.attendanceCount || 0;
        const registrationCount = ((_b = userData.reputation) === null || _b === void 0 ? void 0 : _b.registrationCount) || userData.registrationCount || 0;
        const remindersSet = ((_c = userData.reputation) === null || _c === void 0 ? void 0 : _c.remindersSet) || userData.remindersSet || 0;
        const points = attendanceCount * 10 + registrationCount * 2 + remindersSet;
        updates.push(userDoc.ref.update({
            'reputation.points': points,
            'reputation.attendanceCount': attendanceCount,
            'reputation.registrationCount': registrationCount,
            'reputation.remindersSet': remindersSet,
            'reputation.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        }));
    });
    await Promise.all(updates);
    return {
        success: true,
        message: `Updated reputation for ${updates.length} users`,
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
exports.getTopContributors = functions.https.onCall(async (data) => {
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

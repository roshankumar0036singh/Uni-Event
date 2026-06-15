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
exports.backfillEventAnalyticsCounters = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const normalizeCounterKey = (value) => {
    if (value == null)
        return 'Unknown';
    if (typeof value !== 'string' && typeof value !== 'number')
        return 'Unknown';
    const raw = String(value).trim();
    if (!raw)
        return 'Unknown';
    return raw.replace(/[./#[\]$]/g, '_');
};
exports.backfillEventAnalyticsCounters = functions.https.onCall(async (data, context) => {
    if (!context.auth?.token?.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
    }
    const db = admin.firestore();
    const limit = Math.min(Math.max(Number(data?.limit) || 25, 1), 100);
    const startAfterId = typeof data?.startAfterId === 'string' ? data.startAfterId : null;
    let query = db.collection('events').orderBy(firestore_1.FieldPath.documentId()).limit(limit);
    if (startAfterId) {
        const startSnap = await db.collection('events').doc(startAfterId).get();
        if (!startSnap.exists) {
            throw new functions.https.HttpsError('invalid-argument', 'startAfterId does not exist.');
        }
        query = query.startAfter(startSnap);
    }
    const eventSnap = await query.get();
    let updated = 0;
    for (const docSnap of eventSnap.docs) {
        const eventData = docSnap.data() || {};
        try {
            const missingCounters = eventData.participantCount == null ||
                eventData.branchCounts == null ||
                eventData.yearCounts == null;
            if (!missingCounters)
                continue;
            const participantsSnap = await docSnap.ref.collection('participants').get();
            const participantCount = participantsSnap.size;
            const branchCounts = {};
            const yearCounts = {};
            participantsSnap.forEach(participantDoc => {
                const participant = participantDoc.data() || {};
                const branchKey = normalizeCounterKey(participant.branch);
                const yearKey = normalizeCounterKey(participant.year);
                branchCounts[branchKey] = (branchCounts[branchKey] || 0) + 1;
                yearCounts[yearKey] = (yearCounts[yearKey] || 0) + 1;
            });
            const updatePayload = {
                participantCount,
                branchCounts,
                yearCounts,
            };
            if (eventData.stats?.totalRegistrations == null) {
                updatePayload.stats = { ...(eventData.stats || {}), totalRegistrations: participantCount };
            }
            await docSnap.ref.set(updatePayload, { merge: true });
            updated += 1;
        }
        catch (error) {
            console.error(`Error backfilling event ${docSnap.id}:`, error);
            continue;
        }
    }
    const lastDoc = eventSnap.docs[eventSnap.docs.length - 1];
    return {
        processed: eventSnap.size,
        updated,
        lastId: lastDoc ? lastDoc.id : null,
    };
});

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
exports.permanentCleanup = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const CLEANUP_DAYS = 30;
exports.permanentCleanup = functions.pubsub
    .schedule('every 24 hours')
    .timeZone('UTC')
    .onRun(async () => {
    const db = admin.firestore();
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    try {
        let lastDoc = null;
        let hasMore = true;
        while (hasMore) {
            let query = db
                .collection('events')
                .where('deletedAt', '<', cutoff)
                .orderBy('__name__')
                .limit(500);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }
            const eventsSnapshot = await query.get();
            hasMore = eventsSnapshot.docs.length === 500;
            let batch = db.batch();
            let operationCount = 0;
            for (const eventDoc of eventsSnapshot.docs) {
                const eventData = eventDoc.data();
                if (eventData?.ownerId) {
                    const ownerRef = db.collection('users').doc(eventData.ownerId);
                    batch.set(ownerRef, {
                        eventCount: admin.firestore.FieldValue.increment(-1),
                    }, { merge: true });
                }
                batch.delete(eventDoc.ref);
                operationCount++;
            }
            if (operationCount > 0) {
                await batch.commit();
                totalDeleted += operationCount;
            }
            if (hasMore) {
                lastDoc = eventsSnapshot.docs[eventsSnapshot.docs.length - 1];
            }
        }
    }
    catch (error) {
        console.error(`Permanent cleanup failed after deleting ${totalDeleted} events:`, error);
        throw error;
    }
    console.log(`Permanent cleanup completed. Removed ${totalDeleted} events.`);
});

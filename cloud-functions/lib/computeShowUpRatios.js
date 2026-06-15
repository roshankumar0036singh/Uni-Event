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
exports.computeShowUpRatios = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const db = admin.firestore();
exports.computeShowUpRatios = functions.pubsub.schedule('every 30 minutes').onRun(async () => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const pastEvents = await db
        .collection('events')
        .where('endAt', '<', new Date().toISOString())
        .where('endAt', '>', twelveMonthsAgo.toISOString())
        .where('participantCount', '>', 0)
        .select('category', 'participantCount', 'stats.totalCheckedIn')
        .get();
    if (pastEvents.empty) {
        console.log('No past events with participants found.');
        return null;
    }
    const categoryBuckets = new Map();
    let overallTotalRsvps = 0;
    let overallTotalAttendees = 0;
    for (const doc of pastEvents.docs) {
        const data = doc.data();
        const rsvps = data.participantCount || 0;
        const checkedIn = data.stats?.totalCheckedIn || 0;
        const category = data.category || 'General';
        if (rsvps === 0)
            continue;
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
    const categoryRatios = {};
    for (const [category, counts] of categoryBuckets) {
        const ratio = counts.totalRsvps > 0 ? counts.totalAttendees / counts.totalRsvps : 0;
        categoryRatios[category] = {
            ratio: Math.round(ratio * 100) / 100,
            eventCount: pastEvents.docs.filter(d => (d.data().category || 'General') === category)
                .length,
            totalRsvps: counts.totalRsvps,
            totalAttendees: counts.totalAttendees,
        };
    }
    const overallRatio = overallTotalRsvps > 0 ? overallTotalAttendees / overallTotalRsvps : 0;
    batch.set(ratiosRef, {
        categoryRatios,
        overall: {
            ratio: Math.round(overallRatio * 100) / 100,
            eventCount: pastEvents.size,
            totalRsvps: overallTotalRsvps,
            totalAttendees: overallTotalAttendees,
        },
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    try {
        await batch.commit();
    }
    catch (error) {
        console.error('Failed to commit show-up ratios batch:', error);
        throw error;
    }
    console.log(`Computed show-up ratios for ${categoryBuckets.size} categories ` +
        `across ${pastEvents.size} past events. ` +
        `Overall ratio: ${(overallRatio * 100).toFixed(1)}%`);
    return null;
});

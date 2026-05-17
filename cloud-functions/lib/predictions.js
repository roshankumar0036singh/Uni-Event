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
exports.calculateShowUpRatio = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
exports.calculateShowUpRatio = functions.https.onCall(async (data, context) => {
    // authentication of user
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'Must be logged in to calculate predictions.');
    // }
    const clubId = data.clubId;
    if (!clubId) {
        throw new functions.https.HttpsError('invalid-argument', 'Club ID is required.');
    }
    try {
        // Fetching all PAST events for this club
        const eventsSnapshot = await db.collection('events')
            .where('organizerId', '==', clubId)
            .where('status', '==', 'completed') // Assuming you mark past events as 'completed'
            .get();
        if (eventsSnapshot.empty) {
            return { message: "No past events found. Default ratio will be used.", ratio: 1.0 };
        }
        let totalHistoricalRSVPs = 0;
        let totalHistoricalAttendees = 0;
        // Tally up the numbers
        eventsSnapshot.forEach(doc => {
            const eventData = doc.data();
            // Fallback to 0 if the fields don't exist
            const rsvps = eventData.totalRSVPs || 0;
            const attendees = eventData.actualAttendees || 0;
            if (rsvps > 0) {
                totalHistoricalRSVPs += rsvps;
                totalHistoricalAttendees += attendees;
            }
        });
        // Calculate the ratio
        let showUpRatio = 1.0; // Default to 100% if no data
        if (totalHistoricalRSVPs > 0) {
            showUpRatio = totalHistoricalAttendees / totalHistoricalRSVPs;
        }
        // Cap the ratio at 1.0 (100%) just in case of data anomalies
        showUpRatio = Math.min(showUpRatio, 1.0);
        // Save this ratio to the club's profile...
        await db.collection('clubs').doc(clubId).set({
            metrics: {
                historicalShowUpRatio: showUpRatio,
                lastCalculated: new Date()
            }
        }, { merge: true });
        return {
            success: true,
            ratio: showUpRatio,
            eventsAnalyzed: eventsSnapshot.size
        };
    }
    catch (error) {
        console.error("Error calculating ratio:", error);
        throw new functions.https.HttpsError('internal', 'Failed to calculate ratio.');
    }
});
//# sourceMappingURL=predictions.js.map
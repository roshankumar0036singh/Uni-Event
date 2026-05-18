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
exports.calculateReputation = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
/**
 * Calculates reputation for all clubs or a specific club.
 * Can be triggered manually or scheduled.
 * Logic:
 * +10 points per 100 attendees
 * +2 points per registration
 * +1 point per reminder set
 */
exports.calculateReputation = functions.https.onCall(async (data, context) => {
    // if (!context.auth || !context.auth.token.admin) {
    //   throw new functions.https.HttpsError('permission-denied', 'Only admin');
    // }
    // For demo purposes, we allow anyone to trigger (or check auth if strict)
    const db = admin.firestore();
    const clubsSnapshot = await db.collection("clubs").get();
    const updates = [];
    for (const clubDoc of clubsSnapshot.docs) {
        // const clubId = clubDoc.id; // Unused
        let points = 0;
        // Fetch events for this club
        const eventsSnapshot = await db.collection("events").where("ownerId", "==", clubDoc.data().ownerUserId).get(); // Assuming ownerId links event to club owner. Better: store clubId on event.
        // Correction: Strategy says clubs/{clubId} has ownerUserId. Events have ownerId.
        // Ideally event should have `clubId` field. For MVP we assume ownerId on event matches club owner.
        let totalAttendance = 0;
        let totalRegistrations = 0;
        let totalReminders = 0;
        eventsSnapshot.forEach(eventDoc => {
            const metrics = eventDoc.data().metrics || {};
            totalAttendance += metrics.attendance || 0;
            totalRegistrations += metrics.registrations || 0;
            totalReminders += metrics.remindersSet || 0;
        });
        points += Math.floor(totalAttendance / 100) * 10;
        points += totalRegistrations * 2;
        points += totalReminders * 1;
        // Optional: Feedback logic stub
        // points += 5 (if avg feedback > 4.0)
        updates.push(clubDoc.ref.update({
            "reputation.points": points,
            "reputation.attendanceCount": totalAttendance,
            "updatedAt": admin.firestore.FieldValue.serverTimestamp()
        }));
    }
    await Promise.all(updates);
    return { success: true, message: `Updated ${updates.length} clubs` };
});
//# sourceMappingURL=reputation.js.map
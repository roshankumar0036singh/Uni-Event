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
exports.calculateStreaks = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
/**
 * Weekly streak calculator
 * Runs every 24 hours
 */
exports.calculateStreaks = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
    const db = admin.firestore();
    console.log('Running streak calculation...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users`);
    const eventsSnapshot = await db.collection('events').get();
    console.log(`Found ${eventsSnapshot.size} events`);
    const userAttendance = {};
    for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        if (!eventData.startAt)
            continue;
        const checkInsSnapshot = await eventDoc.ref
            .collection('checkIns')
            .get();
        const eventDate = eventData.startAt.toDate();
        const weekKey = `${eventDate.getFullYear()}-${Math.ceil(eventDate.getDate() / 7)}`;
        for (const checkInDoc of checkInsSnapshot.docs) {
            const userId = checkInDoc.id;
            if (!userAttendance[userId]) {
                userAttendance[userId] = [];
            }
            if (!userAttendance[userId].includes(weekKey)) {
                userAttendance[userId].push(weekKey);
            }
        }
        console.log(`Event ${eventDoc.id} has ${checkInsSnapshot.size} check-ins`);
    }
    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const attendedWeeks = userAttendance[userId] || [];
        const streak = attendedWeeks.length;
        await userDoc.ref.update({
            currentStreak: streak,
        });
        console.log(`Updated ${userId} streak to ${streak}`);
    }
    return null;
});
//# sourceMappingURL=streaks.js.map
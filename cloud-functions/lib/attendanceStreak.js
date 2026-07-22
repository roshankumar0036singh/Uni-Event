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
exports.attendanceStreak = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const dedicatedStudentCertificate_1 = require("./dedicatedStudentCertificate");
const firestore_2 = require("@google-cloud/firestore");
function getISOWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
    return `${year}-W${week}`;
}
exports.attendanceStreak = (0, firestore_1.onDocumentCreated)('events/{eventId}/checkIns/{userId}', async (event) => {
    const userId = event.params.userId ?? event.data?.data()?.userId;
    if (!userId) {
        console.error('No userId in checkIn document');
        return;
    }
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
            return;
        }
        const user = userSnap.data() || {};
        const currentStreak = user.currentStreak || 0;
        const longestStreak = user.longestStreak || 0;
        const lastAttendanceAt = user.lastAttendanceAt || null;
        const now = firestore_2.Timestamp.fromDate(new Date());
        let newStreak = 1;
        if (lastAttendanceAt) {
            const currentWeek = getISOWeekKey(now.toDate());
            const lastWeek = getISOWeekKey(lastAttendanceAt.toDate());
            const prevWeek = getISOWeekKey(new Date(now.toDate().getTime() - 7 * 24 * 60 * 60 * 1000));
            if (currentWeek === lastWeek) {
                return; //already attended this calendar week
            }
            else if (lastWeek === prevWeek) {
                newStreak = currentStreak + 1; //consecutive week
            }
        }
        const newLongestStreak = Math.max(longestStreak, newStreak);
        tx.update(userRef, {
            currentStreak: newStreak,
            longestStreak: newLongestStreak,
            lastAttendanceAt: now,
        });
        console.log('previous currentStreak:', currentStreak);
        console.log('lastAttendanceAt:', lastAttendanceAt);
        console.log('newStreak:', newStreak);
        console.log('newLongestStreak:', newLongestStreak);
    });
    //dedicated student certificate award
    const updatedSnap = await db.collection('users').doc(userId).get();
    const updatedStreak = updatedSnap.data()?.currentStreak || 0;
    if (updatedStreak >= 4) {
        try {
            await (0, dedicatedStudentCertificate_1.awardDedicatedStudentCertificate)(userId);
        }
        catch (err) {
            console.error('Failed to award certificate:', err);
        }
    }
});

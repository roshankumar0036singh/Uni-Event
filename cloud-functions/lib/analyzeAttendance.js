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
exports.analyzeAttendance = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const distance_1 = require("./utils/distance");
const fraudScore_1 = require("./utils/fraudScore");
const db = admin.firestore();
exports.analyzeAttendance = (0, firestore_1.onDocumentCreated)("events/{eventId}/checkIns/{userId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const attendance = snap.data();
    const { userId, latitude, longitude, deviceId, checkedInAt, qrId, } = attendance;
    const eventId = event.params.eventId;
    const result = (0, fraudScore_1.createFraudResult)();
    await checkRapidDuplicate(eventId, qrId, checkedInAt, result);
    await checkImpossibleDistance(eventId, latitude, longitude, result);
    await checkDeviceAbuse(deviceId, result);
    await checkMultipleEvents(userId, checkedInAt, eventId, result);
    if (result.fraudScore >= 60) {
        await db.collection("fraudReports").add({
            attendanceId: event.params.userId,
            userId,
            eventId,
            fraudScore: result.fraudScore,
            reasons: result.reasons,
            resolved: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
async function checkRapidDuplicate(eventId, qrId, checkedInAt, result) {
    const snapshot = await db
        .collection("events")
        .doc(eventId)
        .collection("checkIns")
        .where("qrId", "==", qrId)
        .get();
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.checkedInAt)
            return;
        const diff = Math.abs(new Date(checkedInAt).getTime() -
            new Date(data.checkedInAt).getTime());
        if (diff < 30000) {
            result.fraudScore += 40;
            result.reasons.push("Rapid repeated QR check-in");
        }
    });
}
async function checkImpossibleDistance(eventId, latitude, longitude, result) {
    const eventDoc = await db
        .collection("events")
        .doc(eventId)
        .get();
    const eventData = eventDoc.data();
    if (!eventData)
        return;
    if (!eventData.latitude ||
        !eventData.longitude) {
        return;
    }
    const distance = (0, distance_1.calculateDistance)(latitude, longitude, eventData.latitude, eventData.longitude);
    if (distance > 500) {
        result.fraudScore += 30;
        result.reasons.push("Attendance too far from venue");
    }
}
async function checkDeviceAbuse(deviceId, result) {
    const snapshot = await db
        .collectionGroup("checkIns")
        .where("deviceId", "==", deviceId)
        .get();
    const users = new Set();
    snapshot.forEach((doc) => {
        users.add(doc.data().userId);
    });
    if (users.size > 3) {
        result.fraudScore += 50;
        result.reasons.push("Multiple accounts using same device");
    }
}
async function checkMultipleEvents(userId, checkedInAt, currentEventId, result) {
    const snapshot = await db
        .collectionGroup("checkIns")
        .where("userId", "==", userId)
        .get();
    snapshot.forEach((doc) => {
        const data = doc.data();
        const diff = Math.abs(new Date(checkedInAt).getTime() -
            new Date(data.checkedInAt).getTime());
        if (diff < 60000 &&
            data.eventId !== currentEventId) {
            result.fraudScore += 50;
            result.reasons.push("Multiple event check-ins simultaneously");
        }
    });
}
//# sourceMappingURL=analyzeAttendance.js.map
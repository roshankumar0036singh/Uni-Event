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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaveWaitlist = exports.joinWaitlist = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
// Export functions here
__exportStar(require("./dailyDigest"), exports);
__exportStar(require("./eventNotifications"), exports);
__exportStar(require("./onEventCreate"), exports);
__exportStar(require("./reminders"), exports);
__exportStar(require("./reputation"), exports);
__exportStar(require("./setRole"), exports);
// Join waitlist for an event
exports.joinWaitlist = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in');
    }
    const { eventId } = request.data;
    const userId = request.auth.uid;
    if (!eventId) {
        throw new https_1.HttpsError('invalid-argument', 'Event ID is required');
    }
    const eventRef = admin.firestore().collection('events').doc(eventId);
    return await admin.firestore().runTransaction(async (transaction) => {
        const eventDoc = await transaction.get(eventRef);
        if (!eventDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Event not found');
        }
        const event = eventDoc.data();
        if (!event) {
            throw new https_1.HttpsError('not-found', 'Event data is empty');
        }
        const registrationsSnapshot = await transaction.get(admin.firestore().collection('registrations').where('eventId', '==', eventId).where('status', '==', 'confirmed'));
        const currentRegistrations = registrationsSnapshot.size;
        if (currentRegistrations < event.capacity) {
            throw new https_1.HttpsError('failed-precondition', 'Event has open spots. Please register instead.');
        }
        const existingWaitlist = await transaction.get(eventRef.collection('waitlist').where('userId', '==', userId).where('status', '==', 'waiting'));
        if (!existingWaitlist.empty) {
            throw new https_1.HttpsError('already-exists', 'You are already on the waitlist');
        }
        const existingRegistration = await transaction.get(admin.firestore().collection('registrations')
            .where('eventId', '==', eventId)
            .where('userId', '==', userId));
        if (!existingRegistration.empty) {
            throw new https_1.HttpsError('already-exists', 'You are already registered for this event');
        }
        const waitlistSnapshot = await transaction.get(eventRef.collection('waitlist').where('status', '==', 'waiting').orderBy('joinedAt', 'asc'));
        const position = waitlistSnapshot.size + 1;
        const waitlistRef = eventRef.collection('waitlist').doc();
        transaction.set(waitlistRef, {
            userId: userId,
            eventId: eventId,
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'waiting',
            position: position,
            notificationSent: false
        });
        return { success: true, position: position, message: `You are #${position} on the waitlist` };
    });
});
// Leave waitlist
exports.leaveWaitlist = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in');
    }
    const { eventId } = request.data;
    const userId = request.auth.uid;
    const eventRef = admin.firestore().collection('events').doc(eventId);
    const waitlistQuery = await eventRef.collection('waitlist')
        .where('userId', '==', userId)
        .where('status', '==', 'waiting')
        .limit(1)
        .get();
    if (waitlistQuery.empty) {
        throw new https_1.HttpsError('not-found', 'You are not on the waitlist');
    }
    const waitlistDoc = waitlistQuery.docs[0];
    await waitlistDoc.ref.update({ status: 'left', leftAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true, message: 'Removed from waitlist' };
});
//# sourceMappingURL=index.js.map
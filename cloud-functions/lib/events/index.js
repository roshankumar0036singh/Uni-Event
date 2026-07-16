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
exports.finalizeTicketPayment = exports.registerForEvent = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const EARLY_BIRD_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const getTimestampMs = (value) => {
    if (!value)
        return null;
    if (typeof value === 'string' || typeof value === 'number') {
        const ms = new Date(value).getTime();
        return Number.isNaN(ms) ? null : ms;
    }
    if (typeof value.toMillis === 'function')
        return value.toMillis();
    if (typeof value.toDate === 'function')
        return value.toDate().getTime();
    if (typeof value.seconds === 'number')
        return value.seconds * 1000;
    return null;
};
const getEarlyBirdInfo = (event) => {
    if (event?.hasEarlyBird && event?.earlyBirdDeadline) {
        const deadlineMs = getTimestampMs(event.earlyBirdDeadline);
        const now = Date.now();
        const isEligible = deadlineMs !== null && now <= deadlineMs;
        return {
            isEligible,
            currentPrice: isEligible && event.earlyBirdPrice != null ? event.earlyBirdPrice : event.price,
            deadline: event.earlyBirdDeadline,
        };
    }
    const createdMs = getTimestampMs(event?.createdAt);
    if (createdMs === null) {
        return { isEligible: false, currentPrice: event?.price, deadline: null };
    }
    const now = Date.now();
    const elapsed = now - createdMs;
    const isEligible = elapsed >= 0 && elapsed <= EARLY_BIRD_WINDOW_MS;
    const deadlineMs = createdMs + EARLY_BIRD_WINDOW_MS;
    return {
        isEligible,
        currentPrice: event?.price,
        deadline: new Date(deadlineMs).toISOString(),
    };
};
const normalizeCounterKey = (value) => {
    const raw = String(value ?? 'Unknown').trim();
    if (!raw)
        return 'Unknown';
    return raw.replace(/[./#[\]$]/g, '_');
};
const buildCounterUpdates = (branch, year, delta, eventData) => {
    const branchKey = normalizeCounterKey(branch);
    const yearKey = normalizeCounterKey(year);
    const isDecrement = delta < 0;
    const hasParticipantCount = eventData?.participantCount != null;
    const hasTotalRegistrations = eventData?.stats?.totalRegistrations != null;
    const hasBranchCount = eventData?.branchCounts?.[branchKey] != null;
    const hasYearCount = eventData?.yearCounts?.[yearKey] != null;
    return {
        participantCount: isDecrement && !hasParticipantCount ? 0 : admin.firestore.FieldValue.increment(delta),
        'stats.totalRegistrations': isDecrement && !hasTotalRegistrations ? 0 : admin.firestore.FieldValue.increment(delta),
        [`branchCounts.${branchKey}`]: isDecrement && !hasBranchCount ? 0 : admin.firestore.FieldValue.increment(delta),
        [`yearCounts.${yearKey}`]: isDecrement && !hasYearCount ? 0 : admin.firestore.FieldValue.increment(delta),
    };
};
const buildPreviewUpdate = (eventData, participant, delta) => {
    const existing = Array.isArray(eventData?.participantsPreview)
        ? eventData.participantsPreview
        : [];
    const normalizedExisting = existing
        .map((item) => ({
        userId: item?.userId ?? item?.id,
        name: item?.name,
    }))
        .filter((item) => item.userId);
    const safeParticipant = {
        userId: participant.userId,
        name: participant.name || 'Anonymous',
    };
    const filtered = normalizedExisting.filter((item) => item?.userId !== safeParticipant.userId);
    if (delta > 0) {
        return [safeParticipant, ...filtered].slice(0, 50);
    }
    return filtered;
};
const processRegistrationTransaction = async (transaction, db, uid, email, name, eventId, responses, isPaid, paymentDetails) => {
    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Event not found.');
    }
    const eventData = eventSnap.data();
    // Check overall capacity
    if (eventData.capacity != null) {
        const currentParticipants = eventData.participantCount || 0;
        if (currentParticipants >= eventData.capacity) {
            throw new functions.https.HttpsError('failed-precondition', 'This event has reached its maximum capacity.');
        }
    }
    const participantRef = eventRef.collection('participants').doc(uid);
    const participantSnap = await transaction.get(participantRef);
    if (participantSnap.exists) {
        throw new functions.https.HttpsError('already-exists', 'You are already registered for this event.');
    }
    const userRef = db.collection('users').doc(uid);
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.exists ? userSnap.data() : {};
    let { isEligible: earlyBird } = getEarlyBirdInfo(eventData);
    if (earlyBird && eventData.earlyBirdCapacity != null) {
        const currentEarlyBirds = eventData.stats?.earlyBirdRegistrations || 0;
        if (currentEarlyBirds >= eventData.earlyBirdCapacity) {
            earlyBird = false;
        }
    }
    let ticketId = '';
    let ticketData = null;
    const registrationStatus = isPaid ? 'paid' : 'confirmed';
    if (isPaid && paymentDetails) {
        const finalPrice = earlyBird && eventData.earlyBirdPrice != null
            ? eventData.earlyBirdPrice
            : (eventData.price ?? paymentDetails.expectedPrice ?? 0);
        const ticketRef = db.collection('tickets').doc();
        ticketId = ticketRef.id;
        ticketData = {
            eventId: eventId,
            eventTitle: eventData.title,
            eventDate: eventData.startAt,
            eventLocation: eventData.location,
            userId: uid,
            userName: name,
            userEmail: email,
            userYear: userData.year || 'N/A',
            userBranch: userData.branch || 'N/A',
            price: finalPrice,
            status: 'paid',
            orderId: paymentDetails.transactionId,
            paymentMethod: paymentDetails.selectedMethod,
            purchasedAt: new Date().toISOString(),
        };
        transaction.set(ticketRef, ticketData);
    }
    const participantPayload = {
        userId: uid,
        name: name,
        email: email,
        branch: userData.branch || 'Unknown',
        year: userData.year || 'Unknown',
        joinedAt: new Date().toISOString(),
        status: registrationStatus,
    };
    if (ticketId)
        participantPayload.ticketId = ticketId;
    transaction.set(participantRef, participantPayload);
    const participatingPayload = {
        eventId: eventId,
        joinedAt: new Date().toISOString(),
        status: registrationStatus,
    };
    if (isPaid)
        participatingPayload.role = 'attendee';
    if (ticketId)
        participatingPayload.ticketId = ticketId;
    const participatingRef = userRef.collection('participating').doc(eventId);
    transaction.set(participatingRef, participatingPayload);
    if (!isPaid || responses) {
        const registrationRef = db.collection('registrations').doc();
        const regPayload = {
            eventId: eventId,
            eventId_userId: `${eventId}_${uid}`,
            userId: uid,
            userEmail: email,
            userName: name,
            responses: responses || {},
            schemaAtSubmission: eventData.customFormSchema || [],
            timestamp: new Date().toISOString(),
            status: registrationStatus,
        };
        if (ticketId)
            regPayload.ticketId = ticketId;
        transaction.set(registrationRef, regPayload);
    }
    const userUpdate = { points: admin.firestore.FieldValue.increment(10) };
    if (earlyBird) {
        userUpdate.badges = admin.firestore.FieldValue.arrayUnion(`early_bird_${eventId}`);
    }
    transaction.set(userRef, userUpdate, { merge: true });
    const userPublicProfileRef = db.collection('publicProfiles').doc(uid);
    const publicProfileUpdate = {
        points: admin.firestore.FieldValue.increment(10),
    };
    if (userData.role) {
        publicProfileUpdate.role = userData.role;
    }
    if (typeof userData.displayName === 'string' && userData.displayName !== '') {
        publicProfileUpdate.displayName = userData.displayName;
    }
    if (typeof userData.photoURL === 'string' && userData.photoURL !== '') {
        publicProfileUpdate.photoURL = userData.photoURL;
    }
    if (typeof userData.isVerified === 'boolean') {
        publicProfileUpdate.isVerified = userData.isVerified;
    }
    transaction.set(userPublicProfileRef, publicProfileUpdate, { merge: true });
    const eventUpdates = buildCounterUpdates(participantPayload.branch, participantPayload.year, 1, eventData);
    eventUpdates.participantsPreview = buildPreviewUpdate(eventData, participantPayload, 1);
    if (earlyBird) {
        eventUpdates['stats.earlyBirdRegistrations'] = admin.firestore.FieldValue.increment(1);
    }
    transaction.update(eventRef, eventUpdates);
    return { finalEarlyBird: earlyBird, ticketId, ticketData };
};
exports.registerForEvent = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { eventId, responses } = data;
    if (!eventId) {
        throw new functions.https.HttpsError('invalid-argument', 'eventId is required.');
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email;
    const name = context.auth.token.name || 'Anonymous';
    const db = admin.firestore();
    try {
        let finalEarlyBird = false;
        await db.runTransaction(async (transaction) => {
            const result = await processRegistrationTransaction(transaction, db, uid, email, name, eventId, responses, false);
            finalEarlyBird = result.finalEarlyBird;
        });
        return { success: true, earlyBird: finalEarlyBird };
    }
    catch (error) {
        throw new functions.https.HttpsError(error.code || 'internal', error.message || 'Transaction failed');
    }
});
exports.finalizeTicketPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { eventId, transactionId, selectedMethod, formResponses, expectedPrice } = data;
    if (!eventId || !transactionId) {
        throw new functions.https.HttpsError('invalid-argument', 'eventId and transactionId are required.');
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email;
    const name = context.auth.token.name || 'Anonymous';
    const db = admin.firestore();
    try {
        let finalEarlyBird = false;
        let ticketData = null;
        let ticketId = '';
        await db.runTransaction(async (transaction) => {
            const result = await processRegistrationTransaction(transaction, db, uid, email, name, eventId, formResponses, true, { transactionId, selectedMethod, expectedPrice });
            finalEarlyBird = result.finalEarlyBird;
            ticketData = result.ticketData;
            ticketId = result.ticketId;
        });
        return { success: true, earlyBird: finalEarlyBird, ticketId, ticketData };
    }
    catch (error) {
        throw new functions.https.HttpsError(error.code || 'internal', error.message || 'Transaction failed');
    }
});

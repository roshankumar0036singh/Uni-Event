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
exports.sendPostEventFeedback = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_FEEDBACK;
// Step 1: Send one email
async function sendEmail(name, email, eventTitle, eventId) {
    const payload = {
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: {
            to_name: name || 'Participant',
            to_email: email,
            subject: `Feedback Request: ${eventTitle}`,
            message: `Thank you for attending ${eventTitle}. Please share your feedback!`,
            event_title: eventTitle,
            feedback_link: `https://unievent-ez2w.onrender.com/event/${eventId}/feedback`,
        },
    };
    try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
// Step 2: Get event end time (returns null if invalid)
function getEndTime(event) {
    const date = event.endAt?.toDate ? event.endAt.toDate() : new Date(event.endAt);
    return date && !Number.isNaN(date.getTime()) ? date : null;
}
// Step 3: Claim event so no other function run processes it twice
async function claimEvent(ref) {
    try {
        await ref.firestore.runTransaction(async (t) => {
            const snap = await t.get(ref);
            if (snap.data()?.feedbackRequestSent === true)
                throw new Error('claimed');
            t.update(ref, { feedbackRequestSent: true });
        });
        return true;
    }
    catch (e) {
        if (e?.message === 'claimed')
            return false;
        throw e;
    }
}
// Step 4: Send emails to all participants of an event
async function notifyParticipants(db, eventId, eventTitle) {
    const snap = await db.collection(`events/${eventId}/participants`).get();
    for (const p of snap.docs) {
        const { name, email } = p.data();
        if (email && email !== '-') {
            await sendEmail(name, email, eventTitle, eventId);
        }
    }
}
// Main Cloud Function — runs every 60 minutes
exports.sendPostEventFeedback = functions.pubsub
    .schedule('every 60 minutes')
    .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const events = await db
        .collection('events')
        .where('feedbackRequestSent', 'in', [false, null])
        .get();
    if (events.empty)
        return;
    for (const eventDoc of events.docs) {
        const event = eventDoc.data();
        const endTime = getEndTime(event);
        if (!endTime || now <= endTime)
            continue;
        const claimed = await claimEvent(eventDoc.ref);
        if (!claimed)
            continue;
        await notifyParticipants(db, eventDoc.id, event.title);
        await eventDoc.ref.update({ feedbackRequestSentAt: new Date().toISOString() });
        console.log(`Done: ${event.title}`);
    }
});

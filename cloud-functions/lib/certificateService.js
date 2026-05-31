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
exports.sendCertificatesForEvent = sendCertificatesForEvent;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdf_lib_1 = require("pdf-lib");
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
async function sendCertificatesForEvent(eventId, ownerId) {
    // 1. Fetch Event Details
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
    if (!eventDoc.exists)
        throw new Error('Event not found');
    const event = eventDoc.data();
    if (event?.ownerId !== ownerId) {
        throw new Error('Unauthorized: Only the event owner can send certificates.');
    }
    // 2. Fetch Participants
    const participantsSnap = await admin
        .firestore()
        .collection(`events/${eventId}/participants`)
        .get();
    if (participantsSnap.empty)
        throw new Error('No participants registered for this event.');
    // 3. Load Template
    // Using a reliable path for assets
    const templatePath = path.join(__dirname, '../assets/certificate_template.pdf');
    let templateBytes;
    try {
        templateBytes = fs.readFileSync(templatePath);
    }
    catch (e) {
        throw new Error("Certificate Template not found. Please ensure 'assets/certificate_template.pdf' exists in cloud-functions.");
    }
    const results = [];
    for (const p of participants) {
        // Idempotency: if participant already has a certificateUrl, attempt to ensure delivery
        if (p.certificateUrl) {
            results.push(await handleExistingCertificateParticipant(p, eventTitle, organizationName, eventStartDate));
            continue;
        }
        const outcome = await processParticipant(p, eventId, eventTitle, organizationName, templateBytes, 
        // pass event start if available (prefer startAt)
        eventStartDate);
        results.push(outcome);
    }
    if (results.length === participants.length &&
        results.every(result => result.status === 'success')) {
        await admin.firestore().collection('events').doc(eventId).update({
            certificatesSent: true,
            certificatesSentAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    else {
        console.log(`Not all participants succeeded. total=${participants.length} results=${results.length}`);
    }
    return { total: participants.length, results };
}

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { enforceAppCheck } from './middleware/appCheck';

interface Participant {
    name?: string;
    email: string;
    certificateUrl?: string;
    organization?: string;
    templateData?: Record<string, any>;
}

interface SendBulkEmailsPayload {
    eventId: string;
    participants: Participant[];
    subject: string;
    message: string;
    templateData?: Record<string, any>;
    templateId: string;
}

const MAX_EMAILS_PER_HOUR = 500;
const BATCH_SIZE = 500;

async function getRegisteredEmails(db: admin.firestore.Firestore, eventRef: admin.firestore.DocumentReference): Promise<Set<string>> {
    const emails = new Set<string>();
    let lastDoc: admin.firestore.DocumentSnapshot | undefined;

    do {
        let query: admin.firestore.Query = eventRef
            .collection('participants')
            .select('email')
            .limit(BATCH_SIZE);

        if (lastDoc) query = query.startAfter(lastDoc);

        const snap = await query.get();
        if (snap.empty) break;
        snap.forEach(d => { const e = d.get('email'); if (e) emails.add(e.toLowerCase()); });
        lastDoc = snap.docs[snap.docs.length - 1];
    } while (lastDoc);

    return emails;
}

function validateEnvConfig(): { serviceId: string; publicKey: string } {
    const serviceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
    const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
    if (!serviceId || !publicKey) {
        throw new functions.https.HttpsError('internal', 'Email service configuration error.');
    }
    return { serviceId, publicKey };
}

async function checkRateLimit(db: admin.firestore.Firestore, uid: string, emailCount: number): Promise<void> {
    const ref = db.collection('rate_limits').doc(uid);
    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;

    await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        let timestamps: number[] = [];
        if (doc.exists) {
            const d = doc.data();
            if (d && Array.isArray(d.timestamps)) {
                timestamps = d.timestamps.filter((ts: number) => now - ts < ONE_HOUR_MS);
            }
        }
        if (timestamps.length + emailCount > MAX_EMAILS_PER_HOUR) {
            throw new functions.https.HttpsError('resource-exhausted', `Rate limit exceeded. Max ${MAX_EMAILS_PER_HOUR} emails per hour.`);
        }
        timestamps.push(...new Array(emailCount).fill(now));
        tx.set(ref, { timestamps }, { merge: true });
    });
}

async function sendSingleEmail(p: Participant, subject: string, message: string, templateId: string, templateData: Record<string, any>, serviceId: string, publicKey: string): Promise<boolean> {
    if (!p.email) return false;
    const payload = {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: { to_name: p.name || 'Participant', to_email: p.email, subject, message, ...templateData, ...p.templateData },
    };
    try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) console.error('EmailJS Error:', await res.text());
        return res.ok;
    } catch (err) {
        console.error('Email Network Error:', err);
        return false;
    }
}

export const sendBulkEmails = functions.https.onCall(async (data: SendBulkEmailsPayload, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { uid } = context.auth;
    const token = context.auth.token;

    enforceAppCheck(context);

    if (!token.admin && !token.club) {
        throw new functions.https.HttpsError('permission-denied', 'Only organizers can send bulk emails.');
    }

    const { eventId, participants, subject, message, templateData = {}, templateId } = data;

    if (!eventId) throw new functions.https.HttpsError('invalid-argument', 'eventId is required.');
    if (!participants?.length) throw new functions.https.HttpsError('invalid-argument', 'Participants list is required.');
    if (!subject || !message || !templateId) throw new functions.https.HttpsError('invalid-argument', 'Subject, message, and templateId are required.');

    const db = admin.firestore();
    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) throw new functions.https.HttpsError('not-found', 'Event not found.');
    const eventData = eventSnap.data();
    if (!eventData) throw new functions.https.HttpsError('not-found', 'Event not found.');
    if (eventData.ownerId !== uid && !token.admin) throw new functions.https.HttpsError('permission-denied', 'You can only send bulk emails for events you own.');

    const registeredEmails = await getRegisteredEmails(db, eventRef);
    const validParticipants = participants.filter(p => registeredEmails.has(p.email.toLowerCase()));
    const skippedCount = participants.length - validParticipants.length;

    if (skippedCount > 0) {
        const skipped = participants.filter(p => !registeredEmails.has(p.email.toLowerCase())).map(p => p.email);
        console.warn(`Skipped ${skippedCount} unregistered emails for event ${eventId}:`, skipped);
    }

    if (validParticipants.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'None of the provided participants are registered for this event.');
    }

    const emailCount = validParticipants.length;
    const { serviceId, publicKey } = validateEnvConfig();
    await checkRateLimit(db, uid, emailCount);

    let auditDocRef: admin.firestore.DocumentReference | null = null;
    try {
        auditDocRef = await db.collection('email_audit_logs').add({
            senderId: uid,
            templateId: templateId,
            recipientCount: emailCount,
            status: 'pending',
            timestamp: FieldValue.serverTimestamp(),
            ip: context.rawRequest?.ip || 'unknown',
        });
    } catch (e) {
        console.error('Failed to create audit log:', e);
    }

    const results = await Promise.all(validParticipants.map(p => sendSingleEmail(p, subject, message, templateId, templateData, serviceId, publicKey)));
    const successCount = results.filter(Boolean).length;
    const failureCount = results.length - successCount;

    if (auditDocRef) {
        await auditDocRef.update({ successCount, failureCount, status: 'completed' }).catch(e => console.error('Failed to update audit log:', e));
    }

    return { success: failureCount === 0, successCount, failureCount, skippedCount, totalAttempted: emailCount };
});
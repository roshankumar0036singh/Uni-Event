import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Interface for Email Participant
interface Participant {
    name?: string;
    email: string;
    certificateUrl?: string;
    organization?: string;
    templateData?: Record<string, any>;
}

// Interface for the Cloud Function Payload
interface SendBulkEmailsPayload {
    eventId: string;
    participants: Participant[];
    subject: string;
    message: string;
    templateData?: Record<string, any>;
    templateId: string;
}

// Limits
const MAX_EMAILS_PER_HOUR = 500;

const BATCH_SIZE = 500;

export const sendBulkEmails = functions.https.onCall(async (data: SendBulkEmailsPayload, context) => {
    // 1. Validate Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be logged in to send bulk emails.'
        );
    }

    const { uid } = context.auth;
    const token = context.auth.token;

    // 2. Validate Roles (Organizer/Club or Admin)
    if (!token.admin && !token.club) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only organizers can send bulk emails.'
        );
    }

    const { eventId, participants, subject, message, templateData = {}, templateId } = data;

    if (!eventId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'eventId is required.'
        );
    }

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Participants list is required and cannot be empty.'
        );
    }

    if (!subject || !message || !templateId) {
         throw new functions.https.HttpsError(
             'invalid-argument',
             'Subject, message, and templateId are required.'
         );
    }

    const db = admin.firestore();

    // 3. Validate Event Ownership
    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
        throw new functions.https.HttpsError(
            'not-found',
            'Event not found.'
        );
    }

    const eventData = eventSnap.data();
    if (!eventData) {
        throw new functions.https.HttpsError(
            'not-found',
            'Event not found.'
        );
    }

    if (eventData.ownerId !== uid && !token.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'You can only send bulk emails for events you own.'
        );
    }

    // 4. Validate participants belong to this event
    const participantEmailSet = new Set<string>();
    let lastDoc: admin.firestore.DocumentSnapshot | undefined;

    do {
        let query: admin.firestore.Query = eventRef
            .collection('participants')
            .select('email')
            .limit(BATCH_SIZE);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const partSnap = await query.get();
        if (partSnap.empty) break;

        partSnap.forEach(doc => {
            const email = doc.get('email');
            if (email) participantEmailSet.add(email.toLowerCase());
        });

        lastDoc = partSnap.docs[partSnap.docs.length - 1];
    } while (lastDoc);

    const validParticipants = participants.filter(
        p => participantEmailSet.has(p.email.toLowerCase())
    );

    const skippedCount = participants.length - validParticipants.length;
    if (skippedCount > 0) {
        console.warn(
            `Skipped ${skippedCount} unregistered emails for event ${eventId}:`,
            participants.filter(p => !participantEmailSet.has(p.email.toLowerCase())).map(p => p.email)
        );
    }

    if (validParticipants.length === 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'None of the provided participants are registered for this event.'
        );
    }

    const emailCount = validParticipants.length;

    // 5. Validate Provider Config before reserving quota
    const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
    const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;

    if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY) {
        console.error('EmailJS credentials are not set in environment variables.');
        throw new functions.https.HttpsError(
            'internal',
            'Email service configuration error.'
        );
    }

    // 6. Check Rate Limits (Rolling Window)
    const rateLimitRef = db.collection('rate_limits').doc(uid);

    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;

    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(rateLimitRef);
        let timestamps: number[] = [];

        if (doc.exists) {
            const data = doc.data();
            if (data && Array.isArray(data.timestamps)) {
                // Prune timestamps older than 1 hour
                timestamps = data.timestamps.filter((ts: number) => now - ts < ONE_HOUR_MS);
            }
        }

        if (timestamps.length + emailCount > MAX_EMAILS_PER_HOUR) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                `Rate limit exceeded. You can only send ${MAX_EMAILS_PER_HOUR} emails per hour. Try again later.`
            );
        }

        const newTimestamps = new Array(emailCount).fill(now);
        timestamps.push(...newTimestamps);

        transaction.set(rateLimitRef, { timestamps }, { merge: true });
    });

    // 7. Send Emails via EmailJS REST API
    let successCount = 0;
    let failureCount = 0;

    // Create preliminary audit log
    let auditDocRef: admin.firestore.DocumentReference | null = null;
    try {
        auditDocRef = await db.collection('email_audit_logs').add({
            senderId: uid,
            templateId: templateId,
            recipientCount: emailCount,
            status: 'pending',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: context.rawRequest ? context.rawRequest.ip : 'unknown'
        });
    } catch (auditError) {
        console.error('Failed to create initial audit log:', auditError);
    }

    const emailPromises = validParticipants.map(async (p) => {
        if (!p.email) {
            failureCount++;
            return;
        }

        const payload = {
            service_id: EMAILJS_SERVICE_ID,
            template_id: templateId,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: {
                to_name: p.name || 'Participant',
                to_email: p.email,
                subject: subject,
                message: message,
                ...templateData,
                ...p.templateData
            },
        };

        try {
            const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                successCount++;
            } else {
                const errorText = await response.text();
                console.error('EmailJS Error:', errorText);
                failureCount++;
            }
        } catch (error) {
            console.error('Email Network Error:', error);
            failureCount++;
        }
    });

    let finalStatus = 'completed';
    try {
        await Promise.all(emailPromises);
    } catch (error) {
        finalStatus = 'failed';
        console.error('Bulk email processing encountered an error:', error);
    } finally {
        // Update audit log with terminal status
        if (auditDocRef) {
            await auditDocRef.update({
                successCount,
                failureCount,
                status: finalStatus
            }).catch(e => console.error('Failed to update audit log:', e));
        }
    }

    return {
        success: failureCount === 0,
        successCount,
        failureCount,
        skippedCount,
        totalAttempted: emailCount
    };
});

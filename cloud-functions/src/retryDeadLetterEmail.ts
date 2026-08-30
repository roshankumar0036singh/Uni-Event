import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { logger } from './logger';
import { sendEmailWithRetry } from './utils/emailSender';
import { emailCircuitBreaker } from './utils/emailResilience';

/**
 * Manual retry of a failed email from the dead-letter queue (#326).
 * Callable by admins/clubs; re-sends the queued email and updates the
 * queue entry's status/retryCount.
 */
export const retryDeadLetterEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const token = context.auth.token;
    if (!token.admin && !token.club) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admins or clubs can retry dead-letter emails.',
        );
    }

    const { entryId } = data ?? {};
    if (!entryId || typeof entryId !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'entryId is required.',
        );
    }

    const db = admin.firestore();
    const entryRef = db.collection('email_dead_letter_queue').doc(entryId);
    const snap = await entryRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Dead-letter entry not found.');
    }

    const entry = snap.data() ?? {};
    if (entry.status === 'delivered') {
        return { success: true, alreadyDelivered: true, entryId };
    }

    if (emailCircuitBreaker.isOpen()) {
        throw new functions.https.HttpsError(
            'unavailable',
            'Email circuit breaker is open; try again later.',
        );
    }

    if (entry.provider !== 'resend') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            `Manual retry is only supported for resend entries (got ${entry.provider}).`,
        );
    }

    const result = await sendEmailWithRetry({
        to: entry.to,
        subject: entry.subject ?? 'Retried: Previous email failed to send',
        templateName: entry.templateId ?? 'universal_email_template',
        templateData: entry.templateData ?? {},
    });

    const retryCount = (entry.retryCount ?? 0) + 1;
    if (result.success) {
        await entryRef.update({
            status: 'delivered',
            retryCount,
            deliveredAt: new Date().toISOString(),
            lastAttemptAt: new Date().toISOString(),
        });
        logger.info({
            message: 'dead-letter email delivered on retry',
            entryId,
            to: entry.to,
        });
        return { success: true, entryId, retryCount };
    }

    await entryRef.update({
        status: 'queued',
        retryCount,
        lastAttemptAt: new Date().toISOString(),
        lastError: result.error ?? 'Unknown error',
    });
    logger.error({
        message: 'dead-letter email retry failed',
        entryId,
        to: entry.to,
        error: result.error,
    });
    return { success: false, entryId, error: result.error };
});

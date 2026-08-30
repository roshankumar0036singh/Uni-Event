import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as ExpoSdk from 'expo-server-sdk';
import { sendPushNotifications } from './utils/push';
import { sendEmailWithRetry } from './utils/emailSender';
import { getParticipantContacts } from './lib/participants';

const { Expo } = ExpoSdk;

const MAX_EMAILS_PER_RUN = 100;
const MAX_PARTICIPANTS_PER_EVENT = 100;

const WEBSITE_BASE_URL = process.env.WEBSITE_URL || 'https://unievent.web.app';

function formatEventDate(startAt: string | undefined): string {
    if (!startAt) return 'soon';
    const date = new Date(startAt);
    if (Number.isNaN(date.getTime())) return 'soon';
    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Sends email reminders for a due reminder to the event's registered
 * participants (#671). Failures flow through the email retry/circuit-
 * breaker/DLQ pipeline so nothing is silently lost.
 */
async function sendReminderEmails(
    db: admin.firestore.Firestore,
    reminder: admin.firestore.DocumentSnapshot,
    eventCache: Map<string, admin.firestore.DocumentData | null>,
    emailBudget: { remaining: number },
): Promise<{ sent: number; attempted: boolean }> {
    const data = reminder.data() || {};
    const eventId = data.eventId as string | undefined;

    if (!eventId) {
        return { sent: 0, attempted: false };
    }
    if (data.emailed === true || emailBudget.remaining <= 0) {
        return { sent: 0, attempted: false };
    }

    if (!eventCache.has(eventId)) {
        const eventSnap = await db.collection('events').doc(eventId).get();
        eventCache.set(eventId, eventSnap.exists ? (eventSnap.data() ?? null) : null);
    }
    const event = eventCache.get(eventId) ?? null;
    if (!event) {
        return { sent: 0, attempted: false };
    }

    const title = event.title || 'Upcoming event';
    const startAt = formatEventDate(event.startAt);
    const location =
        event.eventMode === 'online' ? event.meetLink || 'online' : event.location || 'TBD';

    const participants = await getParticipantContacts(db, eventId);
    const emails = [
        ...new Set(
            participants
                .slice(0, MAX_PARTICIPANTS_PER_EVENT)
                .map(p => (typeof p.email === 'string' ? p.email.trim() : ''))
                .filter(email => email.length > 0 && email.includes('@')),
        ),
    ].slice(0, emailBudget.remaining);

    for (const email of emails) {
        emailBudget.remaining -= 1;
        await sendEmailWithRetry(
            {
                to: email,
                subject: `⏰ Reminder: ${title} starts ${startAt}`,
                templateName: 'universal_email_template',
                templateData: {
                    subject: `${title} starts ${startAt}`,
                    to_name: '',
                    message: `Don't forget — <strong>${title}</strong> is starting ${startAt}.\n\nWhere: ${location}\n\nYou're registered, so we'll see you there!`,
                    event_title: title,
                    date: startAt,
                    event_link: `${WEBSITE_BASE_URL}/event/${eventId}`,
                    cert_display: 'none',
                    download_btn_display: 'none',
                    browse_btn_display: 'block',
                },
            },
            { eventId, attempts: 3 },
        );
    }

    return { sent: emails.length, attempted: true };
}

/**
 * Processes all due reminders: in-app + push notifications plus email
 * reminders to registered participants (#671).
 *
 * Extracted from the scheduler so it can be unit-tested directly.
 */
export async function processDueReminders(db: admin.firestore.Firestore): Promise<number> {
    const now = Timestamp.now();

    // Find reminders that need to be sent (remindAt <= now) and haven't been sent yet
    const remindersRef = db.collection('reminders');
    const q = remindersRef.where('remindAt', '<=', now).where('sent', '==', false);

    const snapshot = await q.get();

    if (snapshot.empty) {
        return 0;
    }

    const batch = db.batch();
    const messages = [];
    const eventCache = new Map();
    const emailBudget = { remaining: MAX_EMAILS_PER_RUN };

    // We need to fetch user tokens
    // To handle many reminders, we might need efficient querying, but loop is fine for now
    for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const userId = data.userId;

        // 1. Create in-app notification
        const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            title: 'Event Reminder',
            body: `Your event is starting soon!`,
            eventId: data.eventId,
            createdAt: FieldValue.serverTimestamp(),
            read: false,
        });

        // 2. Prepare Push Notification
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const pushToken = userData?.pushToken;

            if (pushToken && Expo.isExpoPushToken(pushToken)) {
                messages.push({
                    to: pushToken,
                    sound: 'default',
                    title: 'Event Reminder ⏰',
                    body: `Your event is starting!`,
                    data: { eventId: data.eventId, url: `/event/${data.eventId}` },
                });
            }
        }

        // 3. Email reminder to registered participants (#671)
        const emailResult = await sendReminderEmails(db, docSnapshot, eventCache, emailBudget);

        // 4. Mark reminder as sent
        batch.update(docSnapshot.ref, {
            sent: true,
            ...(emailResult.attempted
                ? {
                      emailed: true,
                      emailedAt: FieldValue.serverTimestamp(),
                      emailCount: emailResult.sent,
                  }
                : {}),
        });
    }

    // Send Pushes
    if (messages.length > 0) {
        await sendPushNotifications(messages);
    }

    await batch.commit();
    console.log(`Processed ${snapshot.size} reminders.`);
    return snapshot.size;
}

/**
 * Scheduled function to check for reminders.
 * Runs every minute.
 */
export const checkReminders = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async () => processDueReminders(admin.firestore()));

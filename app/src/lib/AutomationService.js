import { collection, getDocs, query, where, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { sendBulkFeedbackRequest } from './EmailService';

/**
 * Checks for all events owned by the user that have ended and need feedback requests sent.
 * Executes the email sending and updates the event document.
 * @param {string} userId
 */
export const checkAndTriggerAutomations = async userId => {
    if (!userId) return;

    try {
        const now = new Date();
        const eventsRef = collection(db, 'events');

        // Query: Owner is user, feedback NOT sent
        const q = query(
            eventsRef,
            where('ownerId', '==', userId),
            where('feedbackRequestSent', '!=', true),
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        console.log(`[Automation] Checking ${snapshot.size} pending events for user ${userId}...`);

        for (const eventDoc of snapshot.docs) {
            const eventData = eventDoc.data();
            const endAt = eventData.endAt?.toDate
                ? eventData.endAt.toDate()
                : new Date(eventData.endAt);

            // Check if event has ended
            if (now > endAt) {
                console.log(`[Automation] Processing Event: ${eventData.title} (Ended)`);

                // 1. Fetch Participants
                const participantsRef = collection(db, `events/${eventDoc.id}/participants`);
                const participantsSnap = await getDocs(participantsRef);
                const participants = participantsSnap.docs
                    .map(p => ({
                        name: p.data().name,
                        email: p.data().email,
                    }))
                    .filter(p => p.email && p.email !== '-');

                let emailCount = 0;
                if (participants.length > 0) {
                    // 2. Send Emails
                    emailCount = await sendBulkFeedbackRequest(
                        participants,
                        eventData.title,
                        eventDoc.id,
                    );
                    console.log(`[Automation] Sent ${emailCount} emails for ${eventData.title}`);
                } else {
                    console.log(
                        `[Automation] No participants for ${eventData.title}, skipping email.`,
                    );
                }

                // 3. Update Flag (Even if 0 participants, mark done to stop checking)
                await updateDoc(doc(db, 'events', eventDoc.id), {
                    feedbackRequestSent: true,
                    feedbackRequestSentAt: new Date().toISOString(),
                });
            }
        }
    } catch (error) {
        console.error('[Automation] Error:', error);
    }
};

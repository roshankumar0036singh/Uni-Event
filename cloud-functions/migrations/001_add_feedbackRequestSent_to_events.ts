import * as admin from 'firebase-admin';

// ─────────────────────────────────────────────────────────
// Migration 001: Add feedbackRequestSent field to all events
//
// WHY: Some older events don't have this field at all.
// The Cloud Function that sends feedback emails needs it.
// This migration sets it to false for any event missing it.
// ─────────────────────────────────────────────────────────

export async function up(db: admin.firestore.Firestore) {
    // Get all events that don't have the feedbackRequestSent field
    const eventsSnap = await db.collection('events').get();

    // Go through each event
    for (const eventDoc of eventsSnap.docs) {
        const data = eventDoc.data();

        // Only update if the field is missing
        if (data.feedbackRequestSent === undefined) {
            await eventDoc.ref.update({
                feedbackRequestSent: false,
            });
            console.log(`Updated event: ${data.title ?? eventDoc.id}`);
        }
    }
}
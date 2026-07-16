import * as admin from 'firebase-admin';

// Migration 001: Add feedbackRequestSent field to all events
// Uses batching for faster writes (max 500 per batch)

export async function up(db: admin.firestore.Firestore) {
    const eventsSnap = await db.collection('events').get();

    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    let batch = db.batch();
    let count = 0;

    for (const eventDoc of eventsSnap.docs) {
        const data = eventDoc.data();

        // Only update if the field is missing
        if (data.feedbackRequestSent === undefined) {
            batch.update(eventDoc.ref, { feedbackRequestSent: false });
            count++;

            // Commit batch when it reaches 500
            if (count % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
    }

    // Commit any remaining updates
    if (count % batchSize !== 0) {
        await batch.commit();
    }

    console.log(`Updated ${count} events.`);
}

export async function down(db: admin.firestore.Firestore) {
    // Undo: remove the feedbackRequestSent field from all events
    const eventsSnap = await db.collection('events').get();

    const batchSize = 500;
    let batch = db.batch();
    let count = 0;

    for (const eventDoc of eventsSnap.docs) {
        batch.update(eventDoc.ref, {
            feedbackRequestSent: admin.firestore.FieldValue.delete(),
        });
        count++;

        if (count % batchSize === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }

    if (count % batchSize !== 0) {
        await batch.commit();
    }

    console.log(`Removed feedbackRequestSent from ${count} events.`);
}

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export const onEventDelete = functions.firestore
    .document('events/{eventId}')
    .onDelete(async (snapshot, context) => {
        const eventId = context.params.eventId;
        console.log(`Event deleted: ${eventId}. Cleaning up scheduled reminders.`);

        const db = admin.firestore();
        const remindersRef = db.collection('reminders');
        const q = remindersRef.where('eventId', '==', eventId);

        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            console.log(`No reminders found for event ${eventId}.`);
            return null;
        }

        const batch = db.batch();
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Deleted ${querySnapshot.size} reminders for event ${eventId}.`);
        return null;
    });

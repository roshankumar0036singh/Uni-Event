"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParticipantContacts = getParticipantContacts;
/**
 * Helper function to retrieve all participants registered for a specific event.
 *
 * @param db Firestore database instance
 * @param eventId ID of the event
 * @returns Array of Participant objects
 */
async function getParticipantContacts(db, eventId) {
    const participantsSnap = await db.collection(`events/${eventId}/participants`).get();
    if (participantsSnap.empty) {
        return [];
    }
    return participantsSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
}

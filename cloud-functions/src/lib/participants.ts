import * as admin from 'firebase-admin';

export interface Participant {
    id: string;
    name?: string;
    email?: string;
    [key: string]: any;
}

/**
 * Helper function to retrieve all participants registered for a specific event.
 *
 * @param db Firestore database instance
 * @param eventId ID of the event
 * @returns Array of Participant objects
 */
export async function getParticipantContacts(
    db: admin.firestore.Firestore,
    eventId: string,
): Promise<Participant[]> {
    const participantsSnap = await db.collection(`events/${eventId}/participants`).get();
    if (participantsSnap.empty) {
        return [];
    }
    return participantsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as Participant[];
}

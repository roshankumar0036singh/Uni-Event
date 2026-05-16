import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

// Export functions here
export * from './dailyDigest';
export * from './eventNotifications';
export * from './onEventCreate';
export * from './reminders';
export * from './reputation';
export * from './setRole';

/**
 * Adds a user to the event waitlist when capacity is full.
 * 
 * @param request - The callable function request object
 * @param request.auth - Authentication context containing user UID
 * @param request.data - Request data containing eventId
 * @param request.data.eventId - The ID of the event to join waitlist for
 * 
 * @returns Promise containing success status, waitlist position, and message
 * 
 * @throws {HttpsError} unauthenticated - User not logged in
 * @throws {HttpsError} invalid-argument - Missing eventId
 * @throws {HttpsError} not-found - Event doesn't exist
 * @throws {HttpsError} failed-precondition - Event has open spots
 * @throws {HttpsError} already-exists - User already on waitlist or registered
 * 
 * @example
 * const joinWaitlist = httpsCallable(functions, 'joinWaitlist');
 * const result = await joinWaitlist({ eventId: 'abc123' });
 * console.log(result.data.position); // #1 on waitlist
 */
export const joinWaitlist = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in');
  }
  
  const { eventId } = request.data;
  const userId = request.auth.uid;
  
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'Event ID is required');
  }
  
  const eventRef = admin.firestore().collection('events').doc(eventId);
  
  return await admin.firestore().runTransaction(async (transaction) => {
    const eventDoc = await transaction.get(eventRef);
    
    if (!eventDoc.exists) {
      throw new HttpsError('not-found', 'Event not found');
    }
    
    const event = eventDoc.data();
    if (!event) {
      throw new HttpsError('not-found', 'Event data is empty');
    }
    
    const registrationsSnapshot = await transaction.get(
      admin.firestore().collection('registrations').where('eventId', '==', eventId).where('status', '==', 'confirmed')
    );
    const currentRegistrations = registrationsSnapshot.size;
    
    if (currentRegistrations < event.capacity) {
      throw new HttpsError('failed-precondition', 'Event has open spots. Please register instead.');
    }
    
    const existingWaitlist = await transaction.get(
      eventRef.collection('waitlist').where('userId', '==', userId).where('status', '==', 'waiting')
    );
    
    if (!existingWaitlist.empty) {
      throw new HttpsError('already-exists', 'You are already on the waitlist');
    }
    
    const existingRegistration = await transaction.get(
      admin.firestore().collection('registrations')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
    );
    
    if (!existingRegistration.empty) {
      throw new HttpsError('already-exists', 'You are already registered for this event');
    }
    
    const waitlistSnapshot = await transaction.get(
      eventRef.collection('waitlist').where('status', '==', 'waiting').orderBy('joinedAt', 'asc')
    );
    
    const position = waitlistSnapshot.size + 1;
    
    const waitlistRef = eventRef.collection('waitlist').doc();
    transaction.set(waitlistRef, {
      userId: userId,
      eventId: eventId,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'waiting',
      position: position,
      notificationSent: false
    });
    
    return { success: true, position: position, message: `You are #${position} on the waitlist` };
  });
});

/**
 * Removes a user from the event waitlist.
 * 
 * @param request - The callable function request object
 * @param request.auth - Authentication context containing user UID
 * @param request.data - Request data containing eventId
 * @param request.data.eventId - The ID of the event to leave waitlist for
 * 
 * @returns Promise containing success status and confirmation message
 * 
 * @throws {HttpsError} unauthenticated - User not logged in
 * @throws {HttpsError} not-found - User not on waitlist for this event
 * 
 * @example
 * const leaveWaitlist = httpsCallable(functions, 'leaveWaitlist');
 * await leaveWaitlist({ eventId: 'abc123' });
 */
export const leaveWaitlist = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in');
  }
  
  const { eventId } = request.data;
  const userId = request.auth.uid;
  
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'Event ID is required');
  }
  
  const eventRef = admin.firestore().collection('events').doc(eventId);
  
  const waitlistQuery = await eventRef.collection('waitlist')
    .where('userId', '==', userId)
    .where('status', '==', 'waiting')
    .limit(1)
    .get();
  
  if (waitlistQuery.empty) {
    throw new HttpsError('not-found', 'You are not on the waitlist');
  }
  
  const waitlistDoc = waitlistQuery.docs[0];
  await waitlistDoc.ref.update({ status: 'left', leftAt: admin.firestore.FieldValue.serverTimestamp() });
  
  return { success: true, message: 'Removed from waitlist' };
});
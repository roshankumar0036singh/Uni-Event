import * as firebase from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getStorage, ref, getBytes } from 'firebase/storage';

const firestore = getFirestore();
const auth = getAuth();
const storage = getStorage();

/**
 * Get current authenticated user ID
 */
export const getCurrentUserId = async () => {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      resolve(user?.uid || null);
    });
  });
};

/**
 * Get event details by ID
 */
export const getEventDetails = async (eventId) => {
  try {
    const docRef = doc(firestore, 'events', eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        startTime: docSnap.data().startTime?.toDate?.() || docSnap.data().startTime,
        endTime: docSnap.data().endTime?.toDate?.() || docSnap.data().endTime,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching event details:', error);
    throw error;
  }
};

/**
 * Get all attendees who checked in to an event
 */
export const getEventAttendees = async (eventId) => {
  try {
    const checkInsRef = collection(firestore, 'events', eventId, 'checkIns');
    const querySnapshot = await getDocs(checkInsRef);

    const attendees = [];
    for (const docSnap of querySnapshot.docs) {
      const checkInData = docSnap.data();
      const userDoc = await getDoc(doc(firestore, 'users', docSnap.id));

      if (userDoc.exists()) {
        attendees.push({
          userId: docSnap.id,
          userName: userDoc.data().displayName || userDoc.data().name || 'Unknown',
          userEmail: userDoc.data().email || '',
          checkedInAt: checkInData.checkedInAt || checkInData.timestamp?.toDate?.(),
        });
      }
    }

    return attendees.sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));
  } catch (error) {
    console.error('Error fetching attendees:', error);
    return [];
  }
};

/**
 * Check if user has already checked in to event
 */
export const isUserCheckedIn = async (eventId, userId) => {
  try {
    const checkInRef = doc(firestore, 'events', eventId, 'checkIns', userId);
    const checkInSnap = await getDoc(checkInRef);
    return checkInSnap.exists();
  } catch (error) {
    console.error('Error checking if user checked in:', error);
    return false;
  }
};

/**
 * Record user check-in to event
 */
export const checkInToEvent = async ({ eventId, userId, token }) => {
  try {
    // Validate event exists and token is correct
    const eventDoc = await getDoc(doc(firestore, 'events', eventId));

    if (!eventDoc.exists()) {
      return {
        success: false,
        message: 'Event not found',
      };
    }

    const eventData = eventDoc.data();

    // Verify token
    if (eventData.qrToken !== token) {
      return {
        success: false,
        message: 'Invalid check-in token',
      };
    }

    // Check if event has ended
    const endTime = eventData.endTime?.toDate?.() || eventData.endTime;
    if (new Date() > endTime) {
      return {
        success: false,
        message: 'Event has already ended',
      };
    }

    // Record check-in
    const checkInRef = doc(firestore, 'events', eventId, 'checkIns', userId);
    await setDoc(checkInRef, {
      userId,
      eventId,
      timestamp: Timestamp.now(),
      checkedInAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Check-in recorded successfully',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error recording check-in:', error);
    return {
      success: false,
      message: 'Failed to record check-in',
    };
  }
};

/**
 * Get live attendee count for event
 */
export const getAttendeeCount = async (eventId) => {
  try {
    const checkInsRef = collection(firestore, 'events', eventId, 'checkIns');
    const querySnapshot = await getDocs(checkInsRef);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error fetching attendee count:', error);
    return 0;
  }
};

/**
 * Update event with QR token when created
 */
export const updateEventWithQRToken = async (eventId, qrToken) => {
  try {
    const eventRef = doc(firestore, 'events', eventId);
    await updateDoc(eventRef, {
      qrToken,
      liveAttendeeCount: 0,
    });
    return true;
  } catch (error) {
    console.error('Error updating event with QR token:', error);
    return false;
  }
};

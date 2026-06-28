import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Request, Response } from 'express';

interface CheckInRequest {
  eventId: string;
  userId: string;
  token: string;
}

interface CheckInRecord {
  userId: string;
  eventId: string;
  timestamp: admin.firestore.FieldValue;
  checkedInAt: string;
}

const db = admin.firestore();

/**
 * Validates check-in token against event's expiration time
 */
async function validateCheckInToken(
  eventId: string,
  token: string
): Promise<boolean> {
  try {
    const eventDoc = await db.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return false;
    }

    const eventData = eventDoc.data();
    const storedToken = eventData?.qrToken;
    const endTime = eventData?.endTime?.toDate?.();

    if (storedToken !== token) {
      return false;
    }

    if (endTime && new Date() > endTime) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
}

/**
 * Records user check-in for an event
 */
async function recordCheckIn(
  eventId: string,
  userId: string
): Promise<boolean> {
  try {
    const checkInRecord: CheckInRecord = {
      userId,
      eventId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      checkedInAt: new Date().toISOString(),
    };

    await db
      .collection('events')
      .doc(eventId)
      .collection('checkIns')
      .doc(userId)
      .set(checkInRecord, { merge: true });

    return true;
  } catch (error) {
    console.error('Error recording check-in:', error);
    return false;
  }
}

/**
 * HTTP Cloud Function for event check-in
 */
export const handleEventCheckIn = functions.https.onRequest(
  async (req: Request, res: Response) => {
    const { eventId, userId, token } = req.body as CheckInRequest;

    if (!eventId || !userId || !token) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: eventId, userId, token',
      });
      return;
    }

    const isValidToken = await validateCheckInToken(eventId, token);

    if (!isValidToken) {
      res.status(403).json({
        success: false,
        message: 'Invalid or expired check-in token',
      });
      return;
    }

    const checkInSuccess = await recordCheckIn(eventId, userId);

    if (!checkInSuccess) {
      res.status(500).json({
        success: false,
        message: 'Failed to record check-in',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Check-in recorded successfully',
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * Get live attendee count for an event
 */
export const getAttendeeCount = functions.https.onRequest(
  async (req: Request, res: Response) => {
    const { eventId } = req.query as { eventId: string };

    if (!eventId) {
      res.status(400).json({
        success: false,
        message: 'Missing eventId parameter',
      });
      return;
    }

    try {
      const checkInsSnapshot = await db
        .collection('events')
        .doc(eventId)
        .collection('checkIns')
        .get();

      const attendeeCount = checkInsSnapshot.size;

      res.json({
        success: true,
        eventId,
        attendeeCount,
        checkedInUsers: checkInsSnapshot.docs.map((doc) => ({
          userId: doc.id,
          checkedInAt: doc.data().checkedInAt,
        })),
      });
    } catch (error) {
      console.error('Error fetching attendee count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendee count',
      });
    }
  }
);

/**
 * Firestore trigger to update event attendee count
 */
export const onCheckInUpdate = functions.firestore
  .document('events/{eventId}/checkIns/{userId}')
  .onCreate(async (snap, context) => {
    const { eventId } = context.params;

    try {
      const checkInsSnapshot = await db
        .collection('events')
        .doc(eventId)
        .collection('checkIns')
        .get();

      await db
        .collection('events')
        .doc(eventId)
        .update({
          liveAttendeeCount: checkInsSnapshot.size,
          lastCheckInTime: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(`Updated attendee count for event ${eventId}`);
    } catch (error) {
      console.error('Error updating attendee count:', error);
    }
  });

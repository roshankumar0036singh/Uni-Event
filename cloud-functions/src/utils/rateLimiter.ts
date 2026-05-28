import * as admin from 'firebase-admin';

export interface RateLimitResult {
  allowed: boolean;
  statusCode: number;
  message: string;
}

// Helper to evaluate and update minute rate limit
function evaluateMinuteLimit(userData: any, nowMillis: number): { allowed: boolean; writeCountMinute: number } {
  let writeCountMinute = userData.writeCountMinute || 0;
  const lastWriteAt = userData.lastWriteAt;

  if (!lastWriteAt) {
    return { allowed: true, writeCountMinute: 1 };
  }

  const lastWriteMillis = lastWriteAt.toDate 
    ? lastWriteAt.toDate().getTime() 
    : new Date(lastWriteAt).getTime();
    
  if (nowMillis - lastWriteMillis <= 60000) {
    if (writeCountMinute >= 10) {
      return { allowed: false, writeCountMinute };
    }
    return { allowed: true, writeCountMinute: writeCountMinute + 1 };
  }

  return { allowed: true, writeCountMinute: 1 };
}

// Helper to evaluate and update daily event limit
function evaluateDailyEventLimit(userData: any, currentDayInt: number): { allowed: boolean; eventCountDay: number } {
  let eventCountDay = userData.eventCountDay || 0;
  const lastEventDay = userData.lastEventDay || 0;

  if (lastEventDay === currentDayInt) {
    if (eventCountDay >= 5) {
      return { allowed: false, eventCountDay };
    }
    return { allowed: true, eventCountDay: eventCountDay + 1 };
  }

  return { allowed: true, eventCountDay: 1 };
}

/**
 * Checks and updates the database write rate-limiting state stored in the user's document.
 * This runs inside an atomic transaction to prevent write count race conditions.
 * 
 * Rules enforced:
 * 1. General Writes: Max 10 writes per user per minute (resets after 60s).
 * 2. Event Creations: Max 5 event creations per day per user (resets daily).
 * 
 * Admins are automatically exempt from these rate limits.
 * 
 * @param userId Unique identifier of the authenticated user
 * @param isEventCreation Whether the current write is creating a new event record
 * @returns RateLimitResult outlining whether the request is allowed
 */
export async function checkAndUpdateRateLimit(
  userId: string,
  isEventCreation: boolean = false
): Promise<RateLimitResult> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    let userData: any = {};

    if (userDoc.exists) {
      userData = userDoc.data() || {};
    } else {
      const now = new Date();
      const currentDayInt = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
      userData = {
        role: 'student',
        writeCountMinute: 1,
        lastWriteAt: admin.firestore.Timestamp.now(),
        eventCountDay: isEventCreation ? 1 : 0,
        lastEventDay: currentDayInt,
      };
      transaction.set(userRef, userData, { merge: true });
      return { allowed: true, statusCode: 200, message: 'Initial rate limit profile created' };
    }

    const role = userData.role || 'student';

    // Admins are exempt from write rate limits
    if (role === 'admin') {
      return { allowed: true, statusCode: 200, message: 'Admin exempt from write restrictions' };
    }

    const now = new Date();
    const nowMillis = now.getTime();
    const currentDayInt = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

    // 1. Evaluate Minute Limit
    const minResult = evaluateMinuteLimit(userData, nowMillis);
    if (!minResult.allowed) {
      return {
        allowed: false,
        statusCode: 429,
        message: 'Too Many Requests: Database write rate limit exceeded (Max 10 per minute).'
      };
    }

    const updates: any = {
      writeCountMinute: minResult.writeCountMinute,
      lastWriteAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 2. Evaluate Daily Event Limit
    if (isEventCreation) {
      const dailyResult = evaluateDailyEventLimit(userData, currentDayInt);
      if (!dailyResult.allowed) {
        return {
          allowed: false,
          statusCode: 429,
          message: 'Too Many Requests: Daily event creation limit exceeded (Max 5 per day).'
        };
      }
      updates.eventCountDay = dailyResult.eventCountDay;
      updates.lastEventDay = currentDayInt;
    }

    // Persist structural updates back to user document atomically
    transaction.update(userRef, updates);

    return { allowed: true, statusCode: 200, message: 'Authorized request within rate limits' };
  });
}

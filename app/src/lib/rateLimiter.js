import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

// Helper to evaluate and update minute rate limit
function evaluateMinuteLimit(userData, nowMillis) {
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
function evaluateDailyEventLimit(userData, currentDayInt) {
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
 * Validates and atomically increments database write rate limits on the client.
 * Runs inside a Firestore transaction.
 * 
 * Enforces:
 * 1. Max 10 writes per user per minute.
 * 2. Max 5 event creations per user per day.
 * 
 * Admins are automatically exempt.
 * 
 * @param {boolean} isEventCreation Set to true if the client operation is creating a new event document
 * @throws {Error} Throws a 429 status error if user has exceeded their write limits
 */
export async function enforceRateLimit(isEventCreation = false) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('Unauthenticated: User session is missing.');
    }

    const userRef = doc(db, 'users', user.uid);
    
    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        let userData = {};

        if (userSnap.exists()) {
            userData = userSnap.data();
        } else {
            const now = new Date();
            const currentDayInt =
                now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

            userData = {
                role: 'student',
                writeCountMinute: 1,
                lastWriteAt: serverTimestamp(),
                ...(isEventCreation ? { eventCountDay: 1, lastEventDay: currentDayInt } : {}),
            };
            transaction.set(userRef, userData, { merge: true });
            return;
        }

        const role = userData.role || 'student';

        // Admins are exempt from write rate limits
        if (role === 'admin') {
            return;
        }

        const now = new Date();
        const nowMillis = now.getTime();
        const currentDayInt = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

        // 1. Evaluate Minute Limit
        const minResult = evaluateMinuteLimit(userData, nowMillis);
        if (!minResult.allowed) {
            const error = new Error('Too Many Requests: Database write rate limit exceeded (Max 10 per minute).');
            error.code = 'too-many-requests';
            error.status = 429;
            throw error;
        }

        const updates = {
            writeCountMinute: minResult.writeCountMinute,
            lastWriteAt: serverTimestamp()
        };

        // 2. Evaluate Daily Event Limit
        if (isEventCreation) {
            const dailyResult = evaluateDailyEventLimit(userData, currentDayInt);
            if (!dailyResult.allowed) {
                const error = new Error('Too Many Requests: Daily event creation limit exceeded (Max 5 per day).');
                error.code = 'too-many-requests';
                error.status = 429;
                throw error;
            }
            updates.eventCountDay = dailyResult.eventCountDay;
            updates.lastEventDay = currentDayInt;
        }

        transaction.update(userRef, updates);
    });
}

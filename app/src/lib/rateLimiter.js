import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

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
        if (!userSnap.exists()) {
            const now = new Date();
            const currentDayInt =
                now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

            const initial = {
                role: 'student',
                writeCountMinute: 1,
                lastWriteAt: serverTimestamp(),
                ...(isEventCreation ? { eventCountDay: 1, lastEventDay: currentDayInt } : {}),
            };
            transaction.set(userRef, initial, { merge: true });
            return;
        }

        const userData = userSnap.data();
        const role = userData.role || 'student';

        // Admins are exempt from write rate limits
        if (role === 'admin') {
            return;
        }

        const now = new Date();
        const nowMillis = now.getTime();
        
        // YYYYMMDD integer calculation for daily reset
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const currentDayInt = year * 10000 + month * 100 + day;

        let writeCountMinute = userData.writeCountMinute || 0;
        const lastWriteAt = userData.lastWriteAt;
        let eventCountDay = userData.eventCountDay || 0;
        const lastEventDay = userData.lastEventDay || 0;

        const updates = {};

        // 1. General Write Limit Assessment (Max 10 writes per minute)
        if (lastWriteAt) {
            const lastWriteMillis = lastWriteAt.toDate 
                ? lastWriteAt.toDate().getTime() 
                : new Date(lastWriteAt).getTime();
                
            if (nowMillis - lastWriteMillis <= 60000) {
                if (writeCountMinute >= 10) {
                    const error = new Error('Too Many Requests: Database write rate limit exceeded (Max 10 per minute).');
                    error.code = 'too-many-requests';
                    error.status = 429;
                    throw error;
                }
                updates.writeCountMinute = writeCountMinute + 1;
            } else {
                // Reset minute counter (time delta > 60s)
                updates.writeCountMinute = 1;
            }
        } else {
            updates.writeCountMinute = 1;
        }

        updates.lastWriteAt = serverTimestamp();

        // 2. Per-Collection Event Creation Assessment (Max 5 events per day)
        if (isEventCreation) {
            if (lastEventDay === currentDayInt) {
                if (eventCountDay >= 5) {
                    const error = new Error('Too Many Requests: Daily event creation limit exceeded (Max 5 per day).');
                    error.code = 'too-many-requests';
                    error.status = 429;
                    throw error;
                }
                updates.eventCountDay = eventCountDay + 1;
            } else {
                // Reset daily event counter (new calendar day)
                updates.eventCountDay = 1;
            }
            updates.lastEventDay = currentDayInt;
        }

        transaction.update(userRef, updates);
    });
}

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

    await runTransaction(db, async transaction => {
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
            const today = new Date();
            const currentDayInt =
                today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

            const initialData = {
                role: 'student',
                writeCountMinute: 1,
                lastWriteAt: serverTimestamp(),
                ...(isEventCreation ? { eventCountDay: 1, lastEventDay: currentDayInt } : {}),
            };
            transaction.set(userRef, initialData, { merge: true });
            return;
        }

        const userData = userSnap.data() || {};
        const role = userData.role || 'student';

        // Admins are exempt from write rate limits
        if (role === 'admin') {
            return;
        }

        const now = new Date();
        const currentDayInt =
            now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

        // Evaluate Minute Limit
        const lastWrite = userData.lastWriteAt;
        let lastMillis = 0;
        if (lastWrite) {
            lastMillis = lastWrite.toDate
                ? lastWrite.toDate().getTime()
                : new Date(lastWrite).getTime();
        }
        const withinMinute = now.getTime() - lastMillis <= 60000;
        const minuteCount = withinMinute ? userData.writeCountMinute || 0 : 0;

        if (minuteCount >= 10) {
            const error = new Error(
                'Too Many Requests: Database write rate limit exceeded (Max 10 per minute).',
            );
            error.code = 'too-many-requests';
            error.status = 429;
            throw error;
        }

        const updates = {
            writeCountMinute: minuteCount + 1,
            lastWriteAt: serverTimestamp(),
        };

        // Evaluate Daily Event Limit
        if (isEventCreation) {
            const dailyCount =
                (userData.lastEventDay || 0) === currentDayInt ? userData.eventCountDay || 0 : 0;
            if (dailyCount >= 5) {
                const error = new Error(
                    'Too Many Requests: Daily event creation limit exceeded (Max 5 per day).',
                );
                error.code = 'too-many-requests';
                error.status = 429;
                throw error;
            }
            updates.eventCountDay = dailyCount + 1;
            updates.lastEventDay = currentDayInt;
        }

        transaction.update(userRef, updates);
    });
}

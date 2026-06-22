import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { cleanupOldRateLimits } from './middleware/rateLimiter';

admin.initializeApp();

// Export functions here
export * from './dailyDigest';
export * from './eventNotifications';
export * from './onEventCreate';
export * from './reminders';
export * from './reputation';
export * from './setRole';
export * from './inactiveUsers';
export * from './waitlist';

export const cleanupRateLimits = functions.pubsub.schedule('every 1 hour').onRun(async () => {
    await cleanupOldRateLimits();
    return null;
});

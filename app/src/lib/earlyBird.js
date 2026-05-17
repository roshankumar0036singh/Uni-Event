// Safely convert any createdAt or deadline value to milliseconds.
// Handles: ISO strings, numbers, Firestore Timestamp objects ({ seconds, nanoseconds }),
// and objects with a .toDate() method (Expo/web Firebase SDK).
const getTimestampMs = value => {
    if (!value) return null;
    if (typeof value === 'string' || typeof value === 'number') {
        const ms = new Date(value).getTime();
        return isNaN(ms) ? null : ms;
    }
    // Firestore Timestamp — prefer .toMillis() (most reliable), then .toDate()
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return null;
};

const EARLY_BIRD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Returns Early Bird eligibility info for an event.
export const getEarlyBirdInfo = event => {
    // Path A: Event has an explicit early bird deadline set by organiser
    if (event?.hasEarlyBird && event?.earlyBirdDeadline) {
        const deadlineMs = getTimestampMs(event.earlyBirdDeadline);
        const now = Date.now();
        // Guard against null or future-creation edge cases
        const isEligible = deadlineMs !== null && now <= deadlineMs;

        return {
            isEligible,
            currentPrice:
                isEligible && event.earlyBirdPrice != null ? event.earlyBirdPrice : event.price,
            deadline: event.earlyBirdDeadline,
            isExplicit: true,
        };
    }

    // Path B: Fallback — first 1 hour after event creation
    const createdMs = getTimestampMs(event?.createdAt);
    if (createdMs === null) {
        return { isEligible: false, currentPrice: event?.price, deadline: null, isExplicit: false };
    }

    const now = Date.now();
    const elapsed = now - createdMs;

    // elapsed < 0 means createdAt is in the future — should never grant the badge
    const isEligible = elapsed >= 0 && elapsed <= EARLY_BIRD_WINDOW_MS;
    const deadlineMs = createdMs + EARLY_BIRD_WINDOW_MS;

    return {
        isEligible,
        currentPrice: event?.price,
        deadline: new Date(deadlineMs).toISOString(),
        isExplicit: false,
    };
};

// Legacy compatibility wrapper (used by older call sites)
export const isEarlyBirdEligible = createdAt => {
    const ms = getTimestampMs(createdAt);
    if (ms === null) return false;
    const elapsed = Date.now() - ms;
    return elapsed >= 0 && elapsed <= EARLY_BIRD_WINDOW_MS;
};

/**
 * Push-notification deep-linking helpers (#170): extract the target event
 * from a tapped notification payload so the app can navigate directly to
 * the event page instead of the home screen.
 */

/**
 * Resolves the event id from a notification's data payload.
 * Accepts either `data.eventId` or a URL-style `data.url` like
 * `/event/{eventId}` or `unievent://event/{eventId}`.
 */
export function extractEventIdFromNotification(tappedNotification) {
    const data = tappedNotification?.request?.content?.data ?? {};
    if (data.eventId) return String(data.eventId);
    const url = typeof data.url === 'string' ? data.url : '';
    const match = url.match(/\/event\/([^/?]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
}

/**
 * Waits for the navigation container to become ready (bounded) and returns
 * a boolean indicating availability, so callers can navigate safely on
 * cold-start taps.
 */
export async function waitForNavigationReady(isReady, maxRetries = 20, delayMs = 250) {
    for (let i = 0; i < maxRetries; i += 1) {
        if (isReady()) return true;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return isReady();
}

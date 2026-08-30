import { extractEventIdFromNotification, waitForNavigationReady } from './notificationLinks';

describe('extractEventIdFromNotification', () => {
    it('returns data.eventId directly', () => {
        const tapped = {
            notification: {
                request: { content: { data: { eventId: 'evt-123' } } },
            },
        };
        expect(extractEventIdFromNotification(tapped)).toBe('evt-123');
    });

    it('parses the event id from a /event/{id} url', () => {
        const tapped = {
            notification: {
                request: { content: { data: { url: '/event/evt-456' } } },
            },
        };
        expect(extractEventIdFromNotification(tapped)).toBe('evt-456');
    });

    it('parses the event id from a full scheme url', () => {
        const tapped = {
            notification: {
                request: { content: { data: { url: 'unievent://event/evt-789?t=1' } } },
            },
        };
        expect(extractEventIdFromNotification(tapped)).toBe('evt-789');
    });

    it('returns null for payloads without an event reference', () => {
        expect(
            extractEventIdFromNotification({
                notification: { request: { content: { data: {} } } },
            }),
        ).toBeNull();
        expect(extractEventIdFromNotification(null)).toBeNull();
        expect(
            extractEventIdFromNotification({
                notification: { request: { content: { data: { url: '/leaderboard' } } } },
            }),
        ).toBeNull();
    });
});

describe('waitForNavigationReady', () => {
    it('resolves immediately when already ready', async () => {
        const ready = jest.fn(() => true);
        await expect(waitForNavigationReady(ready)).resolves.toBe(true);
        expect(ready).toHaveBeenCalledTimes(1);
    });

    it('polls until ready and then resolves true', async () => {
        jest.useFakeTimers();
        let isReadyNow = false;
        const resolve = waitForNavigationReady(() => isReadyNow, 5, 100);
        isReadyNow = true;
        await jest.runAllTimersAsync();
        await expect(resolve).resolves.toBe(true);
        jest.useRealTimers();
    });

    it('returns false after exhausting retries', async () => {
        jest.useFakeTimers();
        const ready = jest.fn(() => false);
        const resolve = waitForNavigationReady(ready, 3, 100);
        await jest.runAllTimersAsync();
        await expect(resolve).resolves.toBe(false);
        expect(ready).toHaveBeenCalledTimes(4);
        jest.useRealTimers();
    });
});

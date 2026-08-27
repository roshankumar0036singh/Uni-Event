import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    CACHE_MAX_AGE_MS,
    cacheJson,
    clearCachedJson,
    formatCacheAge,
    isOfflineError,
    readCachedJson,
} from '../offlineCache';

jest.mock('@react-native-async-storage/async-storage', () => {
    const store = {};
    return {
        __esModule: true,
        default: {
            setItem: jest.fn(async (key, value) => {
                store[key] = value;
            }),
            getItem: jest.fn(async key => store[key] ?? null),
            removeItem: jest.fn(async key => {
                delete store[key];
            }),
        },
    };
});

describe('cacheJson / readCachedJson', () => {
    it('round-trips a value', async () => {
        await cacheJson('events', [{ id: 'e1' }]);
        const cached = await readCachedJson('events');
        expect(cached).toEqual({ data: [{ id: 'e1' }], savedAt: expect.any(Number) });
    });

    it('returns null when nothing was cached', async () => {
        expect(await readCachedJson('missing')).toBeNull();
    });

    it('rejects expired entries', async () => {
        await cacheJson('old', { x: 1 });
        expect(await readCachedJson('old', { maxAgeMs: 0, now: Date.now() + 10_000 })).toBeNull();
    });

    it('honours a custom maxAge', async () => {
        await cacheJson('recent', { x: 1 });
        const cached = await readCachedJson('recent', { maxAgeMs: CACHE_MAX_AGE_MS });
        expect(cached.data).toEqual({ x: 1 });
    });

    it('returns null for corrupt payloads', async () => {
        await AsyncStorage.setItem('unievent_cache_broken', 'not-json');
        expect(await readCachedJson('broken')).toBeNull();
    });

    it('clearCachedJson removes the entry', async () => {
        await cacheJson('gone', { x: 1 });
        await clearCachedJson('gone');
        expect(await readCachedJson('gone')).toBeNull();
    });
});

describe('formatCacheAge', () => {
    const NOW = 1_000_000_000_000;

    it('formats seconds', () => {
        expect(formatCacheAge(NOW - 30_000, NOW)).toBe('30s ago');
    });

    it('formats minutes', () => {
        expect(formatCacheAge(NOW - 5 * 60_000, NOW)).toBe('5m ago');
    });

    it('formats hours', () => {
        expect(formatCacheAge(NOW - 3 * 3_600_000, NOW)).toBe('3h ago');
    });

    it('formats days', () => {
        expect(formatCacheAge(NOW - 2 * 86_400_000, NOW)).toBe('2d ago');
    });

    it('never goes negative for future timestamps', () => {
        expect(formatCacheAge(NOW + 60_000, NOW)).toBe('0s ago');
    });
});

describe('isOfflineError', () => {
    it('detects Firestore unavailable code', () => {
        expect(isOfflineError({ code: 'unavailable' })).toBe(true);
    });

    it('detects failed-precondition', () => {
        expect(isOfflineError({ code: 'failed-precondition' })).toBe(true);
    });

    it('detects network-y messages', () => {
        expect(isOfflineError(new Error('Network request failed'))).toBe(true);
        expect(
            isOfflineError(new Error('Failed to get document because the client is offline')),
        ).toBe(true);
    });

    it('returns false for unrelated errors', () => {
        expect(isOfflineError({ code: 'permission-denied' })).toBe(false);
        expect(isOfflineError({ code: 'not-found' })).toBe(false);
        expect(isOfflineError(null)).toBe(false);
        expect(isOfflineError(undefined)).toBe(false);
    });
});

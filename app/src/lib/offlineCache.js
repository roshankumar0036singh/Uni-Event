import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'unievent_cache_';

/** Default time an offline cache entry stays usable (24h). */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Persist a JSON-serializable value under `key` with a timestamp.
 * Failures are non-fatal (best-effort cache).
 */
export async function cacheJson(key, value) {
    try {
        const payload = JSON.stringify({ savedAt: Date.now(), data: value });
        await AsyncStorage.setItem(PREFIX + key, payload);
    } catch (e) {
        console.log('Cache write failed', e);
    }
}

/**
 * Read a previously cached value if it is not older than `maxAgeMs`.
 * Returns `{ data, savedAt }` or `null` when missing/expired/corrupt.
 */
export async function readCachedJson(key, { maxAgeMs = CACHE_MAX_AGE_MS, now = Date.now() } = {}) {
    try {
        const raw = await AsyncStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const { savedAt, data } = JSON.parse(raw);
        if (typeof savedAt !== 'number' || savedAt <= 0) return null;
        if (now - savedAt > maxAgeMs) return null;
        return { data, savedAt };
    } catch (e) {
        return null;
    }
}

/** Remove a cached value. */
export async function clearCachedJson(key) {
    try {
        await AsyncStorage.removeItem(PREFIX + key);
    } catch (e) {
        console.log('Cache clear failed', e);
    }
}

/**
 * Human readable age for the offline banner, e.g. "5m ago".
 * Pure helper — `now` injectable for tests.
 */
export function formatCacheAge(savedAt, now = Date.now()) {
    const seconds = Math.max(0, Math.floor((now - savedAt) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

/** Detect Firestore/network failures that offline fallback can mask. */
export function isOfflineError(error) {
    const code = error?.code || '';
    if (code === 'unavailable' || code === 'failed-precondition') return true;
    return /network|internet|connection/i.test(String(error?.message || ''));
}

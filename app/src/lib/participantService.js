import { collection, getDocs, onSnapshot } from 'firebase/firestore';

// In-memory listener registry to dedupe reads and subscriptions per event
const registry = new Map(); // eventId -> { subscribers: Set(fn), unsubscribe: fn|null, data: any, lastFetched: number }

const TTL_MS = 60 * 1000; // 1 minute cache for one-off fetches

export async function fetchParticipantsOnce(db, eventId) {
    const key = String(eventId);
    const entry = registry.get(key);
    const now = Date.now();

    if (entry.data && entry.lastFetched && now - entry.lastFetched < TTL_MS) {
        return entry.data;
    }

    const snap = await getDocs(collection(db, `events/${eventId}/participants`));
    const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

    registry.set(
        key,
        Object.assign({}, entry || {}, {
            data: arr,
            lastFetched: Date.now(),
            subscribers: entry && entry.subscribers,
        }),
    );
    return arr;
}

export function subscribeParticipants(db, eventId, onChange) {
    const key = String(eventId);
    let entry = registry.get(key);
    if (!entry) {
        entry = { subscribers: new Set(), unsubscribe: null, data: null, lastFetched: 0 };
        registry.set(key, entry);
    }

    entry.subscribers.add(onChange);

    // If we already have data, notify immediately
    if (entry.data) {
        onChange(entry.data);
    }

    // If listener not active, create onSnapshot
    if (!entry.unsubscribe) {
        const unsub = onSnapshot(
            collection(db, `events/${eventId}/participants`),
            snap => {
                const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
                entry.data = arr;
                entry.lastFetched = Date.now();
                for (const cb of entry.subscribers) cb(arr);
            },
            err => {
                console.error('participants subscription error', err);
            },
        );

        entry.unsubscribe = unsub;
        registry.set(key, entry);
    }

    // Return unsubscribe for this subscriber
    return () => {
        const e = registry.get(key);
        if (!e) return;
        e.subscribers.delete(onChange);
        if (e.subscribers.size === 0) {
            // tear down listener
            if (e.unsubscribe) e.unsubscribe();
            registry.delete(key);
        }
    };
}

export function clearParticipantCache(eventId) {
    if (eventId) registry.delete(String(eventId));
    else registry.clear();
}

export default { fetchParticipantsOnce, subscribeParticipants, clearParticipantCache };

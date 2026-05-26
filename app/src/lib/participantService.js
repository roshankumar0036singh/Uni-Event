import { collection, getDocs, onSnapshot, doc, runTransaction, increment } from 'firebase/firestore';

// In-memory listener registry to dedupe reads and subscriptions per event
const registry = new Map(); // eventId -> { subscribers: Set(fn), unsubscribe: fn|null, data: any, lastFetched: number, fetchPromise: Promise<any>|null }

const TTL_MS = 60 * 1000; // 1 minute cache for one-off fetches

export async function fetchParticipantsOnce(db, eventId) {
    const key = String(eventId);
    let entry = registry.get(key);
    const now = Date.now();

    if (entry?.data && entry?.lastFetched && now - entry.lastFetched < TTL_MS) {
        return entry.data;
    }

    if (entry?.fetchPromise) {
        return entry.fetchPromise;
    }

    if (!entry) {
        entry = {
            subscribers: new Set(),
            unsubscribe: null,
            data: null,
            lastFetched: 0,
            fetchPromise: null,
        };
        registry.set(key, entry);
    }

    const fetchPromise = getDocs(collection(db, `events/${eventId}/participants`))
        .then(snap => {
            const arr = snap.docs.map(d => {
                const data = d.data();
                return data ? { id: d.id, ...data } : { id: d.id };
            });
            const current = registry.get(key);
            if (current?.fetchPromise === fetchPromise) {
                current.data = arr;
                current.lastFetched = Date.now();
                current.fetchPromise = null;
            }
            return arr;
        })
        .catch(error => {
            const current = registry.get(key);
            if (current?.fetchPromise === fetchPromise) {
                current.fetchPromise = null;
            }
            throw error;
        });

    entry.fetchPromise = fetchPromise;

    return entry.fetchPromise;
}

export function subscribeParticipants(db, eventId, onChange) {
    const key = String(eventId);
    let entry = registry.get(key);
    if (!entry) {
        entry = {
            subscribers: new Set(),
            unsubscribe: null,
            data: null,
            lastFetched: 0,
            fetchPromise: null,
        };
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
                const arr = snap.docs.map(d => {
                    const data = d.data();
                    return data ? { id: d.id, ...data } : { id: d.id };
                });
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
    if (eventId) {
        const entry = registry.get(String(eventId));
        if (entry && typeof entry.unsubscribe === 'function') {
            entry.unsubscribe();
        }
        registry.delete(String(eventId));
    } else {
        for (const entry of registry.values()) {
            if (typeof entry.unsubscribe === 'function') {
                entry.unsubscribe();
            }
        }
        registry.clear();
    }
}
export const safeToggleEventAction = async (db, userId, eventId, isRegistering) => {
    const eventRef = doc(db, 'events', eventId);
    const participantRef = doc(db, `events/${eventId}/participants`, userId);

    try {
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists()) {
                throw new Error("Target event mapping does not exist upstream.");
            }

            // 1. Last-Write-Wins Rule: Set tracking state with a sync timestamp
            transaction.set(participantRef, {
                id: userId,
                registered: isRegistering,
                synchronizedAt: new Date().toISOString(),
            }, { merge: true });

            // 2. Delta Merge Rule: Use atomic field increments so counters don't overwrite blindly
            transaction.update(eventRef, {
                totalAttendees: increment(isRegistering ? 1 : -1)
            });
        });
        console.log("Offline operation successfully synchronized and merged!");
    } catch (error) {
        console.error("Conflict engine rollback triggered:", error);
        throw error;
    }
};

export default { fetchParticipantsOnce, subscribeParticipants, clearParticipantCache, safeToggleEventAction };
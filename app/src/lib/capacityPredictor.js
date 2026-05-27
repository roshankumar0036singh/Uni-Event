import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import logger from './logger';

let cachedRatios = null;
let cachedAt = 0;

const CACHE_TTL_MS = 5 * 60 * 1000;

export const _resetCache = () => {
    cachedRatios = null;
    cachedAt = 0;
};

export const fetchShowUpRatios = async () => {
    if (cachedRatios && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedRatios;
    }

    try {
        const snap = await getDoc(doc(db, 'predictionData', 'showUpRatios'));
        if (!snap.exists()) return null;
        cachedRatios = snap.data();
        cachedAt = Date.now();
        return cachedRatios;
    } catch (error) {
        logger.error('Failed to fetch show-up ratios:', error);
        return null;
    }
};

export const predictAttendance = async ({ category, rsvpCount, capacity }) => {
    if (capacity == null || capacity <= 0) return null;
    if (!rsvpCount || rsvpCount <= 0) return { predicted: 0, ratio: 0, warning: null };

    const ratios = await fetchShowUpRatios();
    if (!ratios) return null;

    let ratio = ratios.overall?.ratio ?? 0.6;

    if (category && ratios.categoryRatios?.[category]?.ratio != null) {
        ratio = ratios.categoryRatios[category].ratio;
    }

    const predicted = Math.round(rsvpCount * ratio);
    const margin = Math.round(capacity * 0.15);

    let warning = null;
    let severity = 'ok';

    if (predicted >= capacity + margin) {
        warning = `Current RSVPs (${rsvpCount}) × historical show-up rate (${(ratio * 100).toFixed(0)}%) ` +
            `≈ ~${predicted} attendees, which exceeds the capacity of ${capacity}.`;
        severity = 'high';
    } else if (predicted >= capacity) {
        warning = `Current RSVPs (${rsvpCount}) × historical show-up rate (${(ratio * 100).toFixed(0)}%) ` +
            `≈ ~${predicted} attendees, which is at or near the capacity of ${capacity}.`;
        severity = 'medium';
    }

    return { predicted, ratio, warning, severity, capacity };
};

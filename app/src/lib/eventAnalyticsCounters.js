import { increment } from 'firebase/firestore';

const MAX_PREVIEW_ENTRIES = 50;

const normalizeCounterKey = value => {
    const raw = String(value ?? 'Unknown').trim();
    if (!raw) return 'Unknown';
    return raw.replace(/[./#[\]$]/g, '_');
};

export const buildCounterUpdates = ({ branch, year, delta }) => {
    const branchKey = normalizeCounterKey(branch ?? 'Unknown');
    const yearKey = normalizeCounterKey(year ?? 'Unknown');

    return {
        participantCount: increment(delta),
        'stats.totalRegistrations': increment(delta),
        [`branchCounts.${branchKey}`]: increment(delta),
        [`yearCounts.${yearKey}`]: increment(delta),
    };
};

export const buildPreviewUpdate = ({ eventData, participant, delta }) => {
    const existing = Array.isArray(eventData?.participantsPreview)
        ? eventData.participantsPreview
        : [];

    const filtered = existing.filter(item => item?.userId !== participant.userId);

    if (delta > 0) {
        return [participant, ...filtered].slice(0, MAX_PREVIEW_ENTRIES);
    }

    return filtered;
};

import { increment } from 'firebase/firestore';

const MAX_PREVIEW_ENTRIES = 50;

const normalizeCounterKey = value => {
    const raw = String(value ?? 'Unknown').trim();
    if (!raw) return 'Unknown';
    return raw.replace(/[./#[\]$]/g, '_');
};

export const buildCounterUpdates = ({ branch, year, delta, eventData }) => {
    const branchKey = normalizeCounterKey(branch ?? 'Unknown');
    const yearKey = normalizeCounterKey(year ?? 'Unknown');

    const isDecrement = delta < 0;
    const hasParticipantCount = eventData?.participantCount != null;
    const hasTotalRegistrations = eventData?.stats?.totalRegistrations != null;
    const hasBranchCount = eventData?.branchCounts?.[branchKey] != null;
    const hasYearCount = eventData?.yearCounts?.[yearKey] != null;

    return {
        participantCount:
            isDecrement && !hasParticipantCount ? 0 : increment(delta),
        'stats.totalRegistrations':
            isDecrement && !hasTotalRegistrations ? 0 : increment(delta),
        [`branchCounts.${branchKey}`]:
            isDecrement && !hasBranchCount ? 0 : increment(delta),
        [`yearCounts.${yearKey}`]:
            isDecrement && !hasYearCount ? 0 : increment(delta),
    };
};

export const buildPreviewUpdate = ({ eventData, participant, delta }) => {
    const existing = Array.isArray(eventData?.participantsPreview)
        ? eventData.participantsPreview
        : [];
    const normalizedExisting = existing
        .map(item => ({
            userId: item?.userId ?? item?.id,
            name: item?.name,
        }))
        .filter(item => item.userId);

    const safeParticipant = {
        userId: participant.userId,
        name: participant.name || 'Anonymous',
    };

    const filtered = normalizedExisting.filter(item => item?.userId !== safeParticipant.userId);

    if (delta > 0) {
        return [safeParticipant, ...filtered].slice(0, MAX_PREVIEW_ENTRIES);
    }

    return filtered;
};

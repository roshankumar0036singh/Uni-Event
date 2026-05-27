export const DEFAULT_PROFILE_BADGE_ID = 'fresh-face';

export const PROFILE_BADGES = [
    {
        id: 'fresh-face',
        label: 'Day One Drip',
        description: 'New on campus, already showing up',
        requiredLevel: 1,
        icon: 'shirt-outline',
        color: '#38BDF8',
    },
    {
        id: 'first-rsvp',
        label: 'Snack Pass',
        description: 'Found the event with food first',
        requiredLevel: 1,
        icon: 'pizza-outline',
        color: '#22C55E',
    },
    {
        id: 'campus-rookie',
        label: 'Map Wanderer',
        description: 'Lost once, explored twice',
        requiredLevel: 1,
        icon: 'trail-sign-outline',
        color: '#F97316',
    },
    {
        id: 'club-hopper',
        label: 'Club Hopper',
        description: 'Checking every club table before lunch',
        requiredLevel: 2,
        icon: 'walk-outline',
        color: '#8B5CF6',
    },
    {
        id: 'map-runner',
        label: 'Venue Scout',
        description: 'Knows where the good rooms are',
        requiredLevel: 2,
        icon: 'earth-outline',
        color: '#14B8A6',
    },
    {
        id: 'event-regular',
        label: 'Front Row Fan',
        description: 'Somehow always near the stage',
        requiredLevel: 3,
        icon: 'megaphone-outline',
        color: '#F59E0B',
    },
    {
        id: 'ticket-collector',
        label: 'Memory Collector',
        description: 'Turns events into stories',
        requiredLevel: 3,
        icon: 'camera-outline',
        color: '#EC4899',
    },
    {
        id: 'crowd-favorite',
        label: 'Hype Signal',
        description: 'Brings the energy with them',
        requiredLevel: 4,
        icon: 'radio-outline',
        color: '#EF4444',
    },
    {
        id: 'campus-connector',
        label: 'Squad Builder',
        description: 'Never attends alone for long',
        requiredLevel: 4,
        icon: 'chatbubbles-outline',
        color: '#6366F1',
    },
    {
        id: 'campus-star',
        label: 'Aftermovie Lead',
        description: 'The highlight reel needs them',
        requiredLevel: 5,
        icon: 'film-outline',
        color: '#A855F7',
    },
    {
        id: 'legend-mode',
        label: 'Campus Myth',
        description: 'People mention them before events start',
        requiredLevel: 5,
        icon: 'rocket-outline',
        color: '#EAB308',
    },
];

export const getProfileBadgeById = badgeId => {
    return PROFILE_BADGES.find(badge => badge.id === badgeId) || null;
};

export const getDefaultProfileBadge = () => {
    return getProfileBadgeById(DEFAULT_PROFILE_BADGE_ID);
};

export const getUnlockedProfileBadges = level => {
    const safeLevel = Number.isFinite(Number(level)) ? Number(level) : 1;
    return PROFILE_BADGES.filter(badge => badge.requiredLevel <= safeLevel);
};

export const canUseProfileBadge = (badgeId, level) => {
    const badge = getProfileBadgeById(badgeId);
    if (!badge) return false;

    const safeLevel = Number.isFinite(Number(level)) ? Number(level) : 1;
    return badge.requiredLevel <= safeLevel;
};

export const getSafeSelectedProfileBadge = (badgeId, level) => {
    if (canUseProfileBadge(badgeId, level)) {
        return getProfileBadgeById(badgeId);
    }

    return getDefaultProfileBadge();
};

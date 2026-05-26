import {
    canUseProfileBadge,
    DEFAULT_PROFILE_BADGE_ID,
    getDefaultProfileBadge,
    getProfileBadgeById,
    getSafeSelectedProfileBadge,
    getUnlockedProfileBadges,
    PROFILE_BADGES,
} from '../profileBadges';
import { USER_LEVELS } from '../userLevels';

const ionicons = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');

describe('profileBadges', () => {
    test('returns badge metadata by id', () => {
        expect(getProfileBadgeById('club-hopper').label).toBe('Club Hopper');
        expect(getProfileBadgeById('missing-badge')).toBeNull();
    });

    test('returns the default badge', () => {
        expect(getDefaultProfileBadge().id).toBe(DEFAULT_PROFILE_BADGE_ID);
    });

    test('returns all badges unlocked at a user level', () => {
        const levelOneBadges = getUnlockedProfileBadges(1);
        const levelThreeBadges = getUnlockedProfileBadges(3);

        expect(levelOneBadges.every(badge => badge.requiredLevel <= 1)).toBe(true);
        expect(levelThreeBadges.every(badge => badge.requiredLevel <= 3)).toBe(true);
        expect(levelThreeBadges.length).toBeGreaterThan(levelOneBadges.length);
    });

    test('checks whether a badge can be used at the current level', () => {
        expect(canUseProfileBadge('first-rsvp', 1)).toBe(true);
        expect(canUseProfileBadge('legend-mode', 4)).toBe(false);
        expect(canUseProfileBadge('missing-badge', 5)).toBe(false);
    });

    test('falls back to default badge when saved badge is missing or locked', () => {
        expect(getSafeSelectedProfileBadge('legend-mode', 2).id).toBe(DEFAULT_PROFILE_BADGE_ID);
        expect(getSafeSelectedProfileBadge('missing-badge', 5).id).toBe(DEFAULT_PROFILE_BADGE_ID);
    });

    test('keeps the selected badge when it is unlocked', () => {
        expect(getSafeSelectedProfileBadge('campus-star', 5).id).toBe('campus-star');
    });

    test('keeps badge ids unique', () => {
        const ids = PROFILE_BADGES.map(badge => badge.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('uses valid Ionicons names', () => {
        expect(PROFILE_BADGES.every(badge => ionicons[badge.icon])).toBe(true);
    });

    test('does not duplicate level names or icons', () => {
        const levelTitles = new Set(USER_LEVELS.map(level => level.title));
        const levelIcons = new Set(USER_LEVELS.map(level => level.icon));

        expect(PROFILE_BADGES.some(badge => levelTitles.has(badge.label))).toBe(false);
        expect(PROFILE_BADGES.some(badge => levelIcons.has(badge.icon))).toBe(false);
    });
});

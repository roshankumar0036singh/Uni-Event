import { getNextUserLevel, getUserLevel, getUserLevelProgress, USER_LEVELS } from '../userLevels';

describe('userLevels', () => {
    test('returns the first level for missing, invalid, or negative points', () => {
        expect(getUserLevel()).toEqual(USER_LEVELS[0]);
        expect(getUserLevel('not-a-number')).toEqual(USER_LEVELS[0]);
        expect(getUserLevel(-25)).toEqual(USER_LEVELS[0]);
    });

    test('returns the matching level at point boundaries', () => {
        expect(getUserLevel(0).title).toBe('Novice');
        expect(getUserLevel(50).title).toBe('Explorer');
        expect(getUserLevel(150).title).toBe('Achiever');
        expect(getUserLevel(300).title).toBe('Campus Pro');
        expect(getUserLevel(600).title).toBe('Campus Star');
    });

    test('returns the highest unlocked level between point boundaries', () => {
        expect(getUserLevel(49).title).toBe('Novice');
        expect(getUserLevel(149).title).toBe('Explorer');
        expect(getUserLevel(299).title).toBe('Achiever');
        expect(getUserLevel(599).title).toBe('Campus Pro');
    });

    test('returns the next level until max level is reached', () => {
        expect(getNextUserLevel(10).title).toBe('Explorer');
        expect(getNextUserLevel(320).title).toBe('Campus Star');
        expect(getNextUserLevel(600)).toBeNull();
    });

    test('calculates progress toward the next level', () => {
        const progress = getUserLevelProgress(100);

        expect(progress.currentLevel.title).toBe('Explorer');
        expect(progress.nextLevel.title).toBe('Achiever');
        expect(progress.pointsIntoLevel).toBe(50);
        expect(progress.pointsForNextLevel).toBe(100);
        expect(progress.remainingPoints).toBe(50);
        expect(progress.progress).toBe(0.5);
        expect(progress.isMaxLevel).toBe(false);
    });

    test('marks progress complete at max level', () => {
        const progress = getUserLevelProgress(900);

        expect(progress.currentLevel.title).toBe('Campus Star');
        expect(progress.nextLevel).toBeNull();
        expect(progress.remainingPoints).toBe(0);
        expect(progress.progress).toBe(1);
        expect(progress.isMaxLevel).toBe(true);
    });
});

export const USER_LEVELS = [
    {
        level: 1,
        title: 'Novice',
        minPoints: 0,
        icon: 'leaf-outline',
    },
    {
        level: 2,
        title: 'Explorer',
        minPoints: 50,
        icon: 'compass-outline',
    },
    {
        level: 3,
        title: 'Achiever',
        minPoints: 150,
        icon: 'ribbon-outline',
    },
    {
        level: 4,
        title: 'Campus Pro',
        minPoints: 300,
        icon: 'medal-outline',
    },
    {
        level: 5,
        title: 'Campus Star',
        minPoints: 600,
        icon: 'star-outline',
    },
];

// for handling undefined, null, etc. values
const normalizePoints = points => {
    const value = Number(points);
    if (!Number.isFinite(value) || value < 0) return 0;
    return value;
};

export const getUserLevel = points => {
    const safePoints = normalizePoints(points);

    return USER_LEVELS.reduce((currentLevel, candidate) => {
        if (safePoints >= candidate.minPoints) return candidate;
        return currentLevel;
    }, USER_LEVELS[0]);
};

export const getNextUserLevel = points => {
    const currentLevel = getUserLevel(points);
    return USER_LEVELS.find(candidate => candidate.level > currentLevel.level) || null;
};

// progress bar data
export const getUserLevelProgress = points => {
    const safePoints = normalizePoints(points);
    const currentLevel = getUserLevel(safePoints);
    const nextLevel = getNextUserLevel(safePoints);

    if (!nextLevel) {
        return {
            currentLevel,
            nextLevel: null,
            pointsIntoLevel: 0,
            pointsForNextLevel: 0,
            remainingPoints: 0,
            progress: 1,
            isMaxLevel: true,
        };
    }

    const pointsIntoLevel = safePoints - currentLevel.minPoints;
    const pointsForNextLevel = nextLevel.minPoints - currentLevel.minPoints;
    const remainingPoints = Math.max(nextLevel.minPoints - safePoints, 0);

    return {
        currentLevel,
        nextLevel,
        pointsIntoLevel,
        pointsForNextLevel,
        remainingPoints,
        progress: pointsForNextLevel > 0 ? pointsIntoLevel / pointsForNextLevel : 0,
        isMaxLevel: false,
    };
};

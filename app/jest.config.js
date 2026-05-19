module.exports = {
    preset: 'jest-expo',
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
    ],
    collectCoverage: true,
    collectCoverageFrom: ['src/lib/**/*.{js,jsx,ts,tsx}', '!**/node_modules/**'],
    coverageThreshold: {
        global: {
            branches: 20,
            functions: 30,
            lines: 30,
            statements: 30,
        },
    },
};

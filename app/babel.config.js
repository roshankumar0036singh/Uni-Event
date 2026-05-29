module.exports = function (api) {
    api.cache(true);
    const plugins = [];

    try {
        require.resolve('react-native-reanimated/plugin');
        plugins.push('react-native-reanimated/plugin');
    } catch (_error) {
        // Allow tests to run in environments where the optional plugin is not installed.
    }

    return {
        presets: ['babel-preset-expo'],
        plugins,
    };
};

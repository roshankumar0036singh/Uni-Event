module.exports = function (api) {
    api.cache(true);
    const plugins = [];

    try {
        require.resolve('react-native-reanimated/plugin');
        plugins.push('react-native-reanimated/plugin');
    } catch (_error) {
        if (_error?.code !== 'MODULE_NOT_FOUND') {
            throw _error;
        }
    }

    return {
        presets: ['babel-preset-expo'],
        plugins,
    };
};

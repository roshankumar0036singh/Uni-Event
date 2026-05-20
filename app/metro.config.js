// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'generator-function': require.resolve('generator-function'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'node:sea') {
        return { type: 'empty' };
    }
    if (moduleName === 'generator-function') {
        return {
            filePath: require.resolve('generator-function'),
            type: 'sourceFile',
        };
    }
    // Redirect react-native-maps to empty shim on web
    if (moduleName === 'react-native-maps' && platform === 'web') {
        return { type: 'empty' };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

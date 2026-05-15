// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');

config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'generator-function': require.resolve('generator-function'),
};

// Workaround for Windows issue with node:sea
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'node:sea') {
        return {
            type: 'empty',
        };
    }
    if (moduleName === 'generator-function') {
        return {
            filePath: require.resolve('generator-function'),
            type: 'sourceFile',
        };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

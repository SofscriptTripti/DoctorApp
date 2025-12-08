// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// Get the default config for this project
const defaultConfig = getDefaultConfig(__dirname);

// Destructure the existing resolver settings
const {
  resolver: { assetExts, sourceExts },
} = defaultConfig;

// Add "pdf" to asset extensions so require('./PDF/File_1.pdf') works
const config = {
  resolver: {
    assetExts: [...assetExts, 'pdf'],
    sourceExts,
  },
};

module.exports = mergeConfig(defaultConfig, config);

const { withUniwindConfig } = require('uniwind/metro');
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Let Metro bundle the textured rock model as a local app asset.
config.resolver.assetExts.push('glb');

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  polyfills: { rem: 16 },
});

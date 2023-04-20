module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      [
        'module-resolver',
        {
          alias: {
            '@src': './src/',
            '@features': './src/features',
          },
        },
      ],
      // has to be listed last
      'react-native-reanimated/plugin',
    ],
  };
};

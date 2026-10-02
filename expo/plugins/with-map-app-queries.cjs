/* global require, module */
// Expo loads config plugins as CommonJS modules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

// Allow map-app discovery through Linking.canOpenURL on iOS and Android 11+.
const schemes = [
  'maps',
  'comgooglemaps',
  'citymapper',
  'transit',
  'truckmap',
  'waze',
  'yandexnavi',
  'moovit',
  'yandexmaps',
  'kakaomap',
  'tmap',
  'szn-mapy',
  'mapycz',
  'mapsme',
  'osmandmaps',
  'osmand.geo',
  'nmap',
  'dgis',
  'petalmaps',
  'sygic',
  'com.sygic.aura',
  'here-route',
  'tomtomgo',
  'dashtagmaps',
  'truckerpath',
];

module.exports = (config) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.LSApplicationQueriesSchemes = [
      ...new Set([
        ...(config.modResults.LSApplicationQueriesSchemes ?? []),
        ...schemes,
      ]),
    ];
    return config;
  });

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries ??= [{}];
    manifest.queries[0] ??= {};
    const intents = (manifest.queries[0].intent ??= []);
    for (const scheme of schemes) {
      if (
        !intents.some((intent) =>
          intent.data?.some((data) => data.$['android:scheme'] === scheme),
        )
      ) {
        intents.push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': scheme } }],
        });
      }
    }
    return config;
  });
};

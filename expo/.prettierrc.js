// @ts-check

/** @type {import("prettier").Config} */
module.exports = {
  // Standard prettier options
  singleQuote: true,
  semi: true,
  // Since prettier 3.0, manually specifying plugins is required
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  // This plugin's options
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    '',
    '^(~/context|~/hooks|~/lib|~/utils)(.*)$',
    '',
    '~/components/(.*)$',
    '',
    '^[./]',
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderTypeScriptVersion: '5.0.0',
  importOrderCaseSensitive: false,
};

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import i18nJsonPlugin from 'eslint-plugin-i18n-json';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.expo',
      '/android',
      '/ios',
      'node_modules',
      'tailwind.config.js',
      'metro.config.js',
      'babel.config.js',
      '.prettierrc.js',
      'tsconfig.json',
      'package.json',
    ],
  },
  {
    files: ['**/*.json'],
    plugins: { 'i18n-json': i18nJsonPlugin },
    processor: {
      meta: { name: '.json' },
      ...i18nJsonPlugin.processors['.json'],
    },
    rules: {
      ...i18nJsonPlugin.configs.recommended.rules,
      'i18n-json/valid-message-syntax': 'off',
      'i18n-json/sorted-keys': 'off',
      'i18n-json/identical-keys': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        require: 'readonly',
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
);

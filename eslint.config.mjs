import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
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
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
);

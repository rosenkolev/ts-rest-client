import eslint from '@eslint/js';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginJest from 'eslint-plugin-jest';

import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["src/**/*.{js,mjs,cjs,ts}"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    plugins: {
      ...eslintConfigPrettier.plugins,
      prettier: eslintPluginPrettier
    },
    languageOptions: {
      globals: globals.browser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      }
    },
    rules: {
      ...eslintPluginPrettierRecommended.rules,
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
      'prettier/prettier': ['error']
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    extends: [
      ...tseslint.configs.recommended
    ],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: pluginJest.environments.globals.globals,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: pluginJest.configs.recommended.rules
  }
]);

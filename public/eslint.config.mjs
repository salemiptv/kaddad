import globals from 'globals';
import { ESLint } from 'eslint';

export default {
  env: {
    node: true,
    browser: true,
  },
  globals: {
    ...globals,
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // القواعد الخاصة بك
  },
};

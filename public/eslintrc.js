module.exports = {
  env: {
    node: true,
    browser: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // قواعد مبدئية
    'no-unused-vars': 'warn',
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};

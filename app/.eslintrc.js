// ESLint config for the Laxie Expo app.
// Kept intentionally light: TypeScript's compiler is the primary correctness
// gate (see `npm run typecheck`); ESLint catches the rest.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    es2021: true,
    node: true,
    browser: true,
  },
  ignorePatterns: [
    'node_modules/',
    'babel.config.js',
    'metro.config.js',
    'postcss.config.mjs',
    '*.d.ts',
  ],
  rules: {
    // TypeScript handles undefined-symbol detection; the lint rule double-flags.
    'no-undef': 'off',
    // The demo intentionally casts `new Date() as any` for mock timestamps.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};

import { FlatCompat } from '@eslint/eslintrc';

// eslint-config-next still ships eslintrc-style config, so it has to go
// through the compat layer to be usable from ESLint 9's flat config.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      // Its own config file: linting the linter's config is noise.
      'eslint.config.mjs',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
];

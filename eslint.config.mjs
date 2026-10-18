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
      // 一次性分析脚本与临时产物（已在 .gitignore 里）。这些不是产品代码：
      // 它们是评审时跑出来的探针，经常含刻意写坏的片段（比如验证 SW 行为时
      // 拼的半截字符串），ld 进来只会制造噪音，而 CI 里也从不构建它们。
      'work/**',
      // 由 scripts/generate-sw.mjs 生成到 public/，是经典脚本（非模块），
      // 由浏览器直接执行而不是被 webpack 处理。
      'public/sw.js',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
];

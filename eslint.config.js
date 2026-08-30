import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * 依赖方向与确定性红线（架构文档 02 §1 / 知识文档 6439fc3e）：
 * 1) core/content 零 DOM、零 three、零 react；content 不依赖 core；
 * 2) core 内禁止 Math.random / Date.now（确定性红线）；
 * 3) three 只允许在 src/render 内 import。
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'docs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // content 不得依赖任何其他模块
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'react', 'react-dom'], message: 'content 禁止依赖渲染/UI' },
            { group: ['**/core/**', '*/core/*'], message: 'content 禁止依赖 core（依赖方向：core -> content）' },
          ],
        },
      ],
    },
  },
  {
    // core：确定性红线 + 禁渲染/UI 依赖
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '确定性红线：core 内禁止 Math.random，请使用 seeded Rng' },
        { object: 'Date', property: 'now', message: '确定性红线：core 内禁止 Date.now' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'react', 'react-dom'], message: 'core 禁止依赖渲染/UI' },
            { group: ['**/render/**', '**/ui/**', '**/input/**'], message: 'core 禁止依赖表现层' },
          ],
        },
      ],
    },
  },
  {
    // three 只能在 render 内使用
    files: ['src/**/*.ts'],
    ignores: ['src/render/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['three', '@types/three'], message: 'three 只允许在 src/render 内 import（引擎边界）' }] },
      ],
    },
  },
  {
    // render 禁止依赖 ui
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/ui/**', 'react', 'react-dom'], message: 'render 禁止依赖 ui' }] },
      ],
    },
  },
);

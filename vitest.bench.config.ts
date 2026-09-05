import { defineConfig } from 'vitest/config';

/**
 * 性能基准专用配置（与 npm run test 的确定性套件分离）：
 * - npm run bench → 跑 tests/bench（标准场景基准，--expose-gc 供活堆采样）；
 * - npm run test  → 排除 tests/bench，只跑确定性断言。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/bench/**/*.bench.ts'],
    // 单 fork + --expose-gc：基准内可强制 GC，度量「活堆」增长（剔除未回收垃圾的干扰）
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        execArgv: ['--expose-gc'],
      },
    },
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});

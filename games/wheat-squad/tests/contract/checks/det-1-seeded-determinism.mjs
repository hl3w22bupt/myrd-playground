// checks/det-1-seeded-determinism.mjs — acceptance check 薄壳（断言零复制，真实转发实体件；由 tools/build-checks-shims.mjs 生成）
// acceptance: det-1-seeded-determinism · 实体单源: tests/contract/ac-01-seeded-determinism.spec.mjs
await import(new URL('../ac-01-seeded-determinism.spec.mjs', import.meta.url));

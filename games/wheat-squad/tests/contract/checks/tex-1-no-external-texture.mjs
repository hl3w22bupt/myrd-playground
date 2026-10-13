// checks/tex-1-no-external-texture.mjs — acceptance check 薄壳（断言零复制，真实转发实体件；由 tools/build-checks-shims.mjs 生成）
// acceptance: tex-1-no-external-texture · 实体单源: tests/contract/ac-07-no-texture.spec.mjs
await import(new URL('../ac-07-no-texture.spec.mjs', import.meta.url));

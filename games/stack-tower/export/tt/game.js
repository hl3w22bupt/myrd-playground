/**
 * Stack Tower（霓虹夜塔）· 抖音小游戏入口（C · spec v1.5 content.platform dy-runtime）。
 * 依赖链：tt 运行时注入 tt 全局 → build-tt/app/boot-tt.js 装配（DOM/localStorage shim +
 * Platform + boot + 分享闭环）。主包 CJS 树由 tools/build-tt.mjs 以 tsconfig.tt.json
 * （module=commonjs）产出。
 */
require('./build-tt/app/boot-tt.js');

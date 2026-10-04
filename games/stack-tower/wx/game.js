/**
 * Stack Tower（霓虹夜塔）· 微信小游戏入口（B0 · spec v1.3 content.platform wx-runtime）。
 * 依赖链：wx 运行时注入 wx 全局 → build-wx/app/boot-wx.js 装配（DOM shim + Platform + boot）。
 * 主包 CJS 树由 tools/build-wx.mjs 以 tsconfig.wx.json（module=commonjs）产出。
 */
require('./build-wx/app/boot-wx.js');

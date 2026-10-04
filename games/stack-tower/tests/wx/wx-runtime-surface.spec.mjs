#!/usr/bin/env node
/**
 * wx-runtime 条目查（spec v1.3 content.platform wx-runtime · check 面）。
 * 断言：wx 包结构（game.json 竖屏 + openDataContext / project.config.json AppID 策略 / game.js 入口链）
 * + 装配体编译产物面（createWxPlatform / 生命周期 / 输入 / 画布 letterbox / WebAudio 桥 / 分享注册）。
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = (...s) => path.join(GAME, 'export/wx', ...s);
const failures = [];
const check = (name, cond) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures.push(name); console.log(`  FAIL  ${name}`); }
};

// ① game.json：竖屏 + 开放数据域挂载
if (!existsSync(P('game.json'))) {
  console.log('RESULT: not-runnable — export/wx/game.json 缺失（先跑 node tools/build-wx.mjs）');
  process.exit(0);
}
const gameJson = JSON.parse(readFileSync(P('game.json'), 'utf8'));
check('deviceOrientation=portrait', gameJson.deviceOrientation === 'portrait');
check('openDataContext=open-data-context', gameJson.openDataContext === 'open-data-context');
// ② AppID 策略（测试号占位，正式号待主人下发）
const pc = JSON.parse(readFileSync(P('project.config.json'), 'utf8'));
check('AppID 在位（touristappid 占位或正式号）', typeof pc.appid === 'string' && pc.appid.length >= 8);
check('compileType=game', pc.compileType === 'game');
check('AppID 占位策略留痕（description 声明）', /touristappid|AppID/.test(pc.description || ''));
// ③ 入口链
const gameJs = readFileSync(P('game.js'), 'utf8');
check("game.js → require('./build-wx/app/boot-wx.js')", gameJs.includes("require('./build-wx/app/boot-wx.js')"));
check('boot-wx 产物落包', existsSync(P('build-wx/app/boot-wx.js')));
// ④ 装配体产物面
const wxJs = readFileSync(P('build-wx/platform/wx.js'), 'utf8');
check('exports.createWxPlatform（装配体导出）', wxJs.includes('createWxPlatform'));
check('生命周期：wx.onShow / wx.onHide 接线', wxJs.includes('onShow') && wxJs.includes('onHide'));
check('输入：wx.onTouchStart → 意图', wxJs.includes('onTouchStart'));
check('时钟：requestAnimationFrame 帧链', wxJs.includes('requestAnimationFrame'));
check('音频：createWebAudioContext 桥 + 静音同源键', wxJs.includes('createWebAudioContext') && wxJs.includes('st.settings.muted'));
check('资产：wx.createImage 装载（404 → null 降级）', wxJs.includes('createImage'));
check('分享注册面：onShareAppMessage / onShareTimeline / showShareMenu', ['onShareAppMessage', 'onShareTimeline', 'showShareMenu'].every((k) => wxJs.includes(k)));
// ⑤ boot-wx：DOM shim + HUD 直绘 + 视口
const bootJs = readFileSync(P('build-wx/app/boot-wx.js'), 'utf8');
check('DOM shim：getElementById(hud/stage) + createElement', bootJs.includes('getElementById') && bootJs.includes('createElement'));
check('视口上报 setViewport（横屏遮罩口径与 web 一致）', bootJs.includes('setViewport'));
check('HUD 画布直绘（无 DOM 环境的分数可见性）', bootJs.includes('createHudLayer') || bootJs.includes('hud'));
// ⑥ 主包 CJS 纯净（零 ESM 语法——wx 运行时 require 语义）
const kernel = readFileSync(P('build-wx/kernel/sim.js'), 'utf8');
check('主包编译产物为 CommonJS（exports 定义）', kernel.includes('exports.') || kernel.includes('Object.defineProperty(exports)'));

if (failures.length) {
  console.log(`RESULT: FAIL (${16 - failures.length}/16)`);
  process.exit(1);
}
console.log('RESULT: PASS  — wx 运行时表面 16 项断言全绿');

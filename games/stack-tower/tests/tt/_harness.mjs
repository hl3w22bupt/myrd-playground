/**
 * tt 门禁共享 harness（C · tests/tt 三份条目查共用）。
 *
 * 职责：
 *  - RESULT 三态聚合（与 tests/contract 同约定：PASS / FAIL / not-runnable，无第四种静默）；
 *  - fake tt 宿主（Map 存储 + rAF 手动泵 + 可选云存储 API）——门禁在 Node 机跑，零真实容器依赖；
 *  - 编译产物 CJS 装载：工程 package.json type:module 会让 .js 被当 ESM，故把 export/tt/build-tt
 *    复制到无 type 声明的临时目录后 require（wx 判例 .cjs 副本 trick 的整树版，相对 require 不断链）。
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ROOT = path.join(GAME, '..', '..');
export const SPEC_PATH = path.join(ROOT, '.myrd', 'spec', 'stack-tower-spec.json');

export const failures = [];
let totalChecks = 0;
export const check = (name, cond) => {
  totalChecks += 1;
  if (cond) console.log(`  PASS  ${name}`);
  else { failures.push(name); console.log(`  FAIL  ${name}`); }
};
/** 条目查收尾：全 PASS → RESULT: PASS；可达但有断言失败 → RESULT: FAIL（exit 1） */
export function finish(okLabel) {
  if (failures.length) {
    console.log(`RESULT: FAIL (${totalChecks - failures.length}/${totalChecks})`);
    process.exit(1);
  }
  console.log(`RESULT: PASS  — ${okLabel}（${totalChecks} 项断言全绿）`);
}

/** 产物前置检查：缺失 → not-runnable（显式单列，不计绿不静默），附缺因与复现命令 */
export function requireProd(rel, buildCmd) {
  if (existsSync(path.join(GAME, rel))) return true;
  console.log(`RESULT: not-runnable — ${rel} 缺失（先跑 ${buildCmd}）`);
  process.exit(0);
  return false;
}

export const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
export const loadSpec = () => JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
export const specItem = (id) => loadSpec().spec.content.platform.items.find((i) => i.id === id);
export const srcOf = (rel) => readFileSync(path.join(GAME, rel), 'utf8');

/** fake tt 宿主：视口/安全区 + Map 存储 + rAF 手动泵；apiLevel 控制云存储/分享 API 在位与否 */
export function makeTtHost(opts = {}) {
  const store = new Map();
  const frameHandlers = new Set();
  const calls = { share: [], passiveShare: [], cloudWrite: [], cloudRead: [] };
  const has = (k) => !(opts.omit ?? []).includes(k);
  const host = {
    __store: store,
    __calls: calls,
    __pumpFrames(nowMs) { for (const h of [...frameHandlers]) h(nowMs); },
    getSystemInfoSync: () => ({
      windowWidth: 390, windowHeight: 844, pixelRatio: 2,
      safeArea: { top: 44, bottom: 812, left: 0, right: 390, width: 390, height: 768 },
    }),
    createCanvas: () => ({
      width: 0, height: 0,
      getContext: () => ({ setTransform() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeStyle: '', fillStyle: '', font: '', textBaseline: '', lineWidth: 1 }),
    }),
    createImage: () => ({ src: '', width: 0, height: 0, onload: null, onerror: null }),
    onTouchStart: (cb) => { host.__onTouch = cb; },
    onShow: (cb) => { host.__onShow = cb; },
    onHide: (cb) => { host.__onHide = cb; },
    createInnerAudioContext: () => ({
      src: '', loop: false, autoplay: false, volume: 1, obeyMuteSwitch: false,
      play() { calls.audioPlay = (calls.audioPlay ?? 0) + 1; },
      pause() {}, stop() {}, destroy() {}, onError() {},
    }),
    getStorageSync: (k) => (store.has(k) ? store.get(k) : null),
    setStorageSync: (k, v) => { store.set(k, v); },
  };
  if (has('onShareAppMessage')) host.onShareAppMessage = (cb) => { calls.passiveShare.push(cb); };
  if (has('shareAppMessage')) host.shareAppMessage = (msg) => { calls.share.push(msg); msg?.fail?.(); };
  if (has('showShareMenu')) host.showShareMenu = () => { calls.shareMenuShown = true; };
  if (has('setUserCloudStorage')) host.setUserCloudStorage = (o) => { calls.cloudWrite.push(o); o?.success?.(); };
  if (has('getFriendCloudStorage')) {
    host.getFriendCloudStorage = (o) => {
      calls.cloudRead.push(o);
      o?.success?.({ data: [{ value: { KVDataList: [{ key: 'score', value: '45' }] } }, { value: { KVDataList: [{ key: 'score', value: '72' }] } }] });
    };
  }
  return host;
}

/** 编译产物 CJS 装载（临时目录无 type 声明 → CJS；相对 require 在副本树内解析） */
export function loadTtBuild() {
  const TMP = mkdtempSync(path.join(tmpdir(), 'tt-gate-'));
  cpSync(path.join(GAME, 'export/tt/build-tt'), path.join(TMP, 'build-tt'), { recursive: true });
  writeFileSync(path.join(TMP, 'package.json'), JSON.stringify({ name: 'tt-gate-harness' }));
  const req = createRequire(path.join(TMP, 'probe.cjs'));
  const load = (rel) => req(path.join(TMP, 'build-tt', rel));
  return {
    load,
    dispose: () => rmSync(TMP, { recursive: true, force: true }),
  };
}

/** 门禁 Node 环境无 rAF：注入手动泵（真实容器由宿主提供全局 rAF） */
export function installRafPump() {
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    const handlers = new Set();
    globalThis.requestAnimationFrame = (cb) => { handlers.add(cb); return handlers.size; };
    globalThis.__rafPump = (nowMs) => { for (const h of [...handlers]) h(nowMs); };
  }
}

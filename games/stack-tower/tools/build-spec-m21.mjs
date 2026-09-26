#!/usr/bin/env node
/**
 * spec 版本链构建器：v2（approved）→ v3「M2.1 有声可装」内容稿。
 * 复现：node games/stack-tower/tools/build-spec-m21.mjs
 *
 * 纪律（主策划红线）：
 *  - 冻结段守卫：world / levels / frozen numeric 四组（cut_width/difficulty/perfect_window/scoring）
 *    / 顶层 seed·step 三键 / 8 条 gameplay acceptance 必须与 v2 逐字节等价，否则非零退出拒绝产出；
 *  - 只做增量：numeric 追加 audio/mobile/deploy 三组；entities 追加 5 个；assets 追加 2 条；
 *    content 追加 sfxPack / mobile / pwa 三段 + towerRipple.restart 事件；acceptance 追加 14 条；
 *  - 输出：.myrd/spec/stack-tower-spec-v3-content.json（POST /revisions 的 spec 载荷，禁止覆盖 v2）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const V2 = JSON.parse(readFileSync(join(ROOT, '.myrd', 'spec', 'stack-tower-spec-v2.json'), 'utf8')).spec;
const v3 = structuredClone(V2);

// ---------- 冻结段守卫 ----------
function die(msg) {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) die(`冻结段被改动: ${msg}`);
};
const FROZEN_NUMERIC = ['DEFAULT_SEED', 'FIXED_STEP_MS', 'MAX_DT_MS', 'cut_width', 'difficulty', 'perfect_window', 'scoring'];
for (const k of FROZEN_NUMERIC) eq(v3.numeric[k], V2.numeric[k], `numeric.${k}`);
eq(v3.world, V2.world, 'world');
eq(v3.levels, V2.levels, 'levels');
eq(v3.acceptance, V2.acceptance, 'acceptance(8 条 gameplay)');

// ---------- meta ----------
v3.meta = {
  ...v3.meta,
  revision_note:
    'v3：M2.1「有声可装」——sfx-pack-v1（12 文件）+ 移动端适配（触控归一/安全区/横屏遮罩）+ PWA 可安装壳。' +
    'QA 预审 4 项修正落条：①acc-a4 拆 a4a（5 连逐块 +1 半音）/a4b（≥14 连验第 13、14 块均 +12 封顶）；' +
    '②acc-a5 拆 a5a（单元级 spy：8 voices 满载时 miss/game-over 不被挤占）/a5b（seeded 3 秒 20 连 tap，判据=有声局相对静音局无新增 >50ms 帧）；' +
    '③sfx-pack-v1 命名统一「文件名 = sfx- + 事件 id」，acc-a1 改断言资产注册表完整性（404 子句移入 acc-d2 断网冒烟）；' +
    '④tower-ripple 契约正式新增 restart 事件（payload {source}），acc-m4 遮罩判定基于视口宽高比、acc-m1 安全区写明证据形式。' +
    'v2 冻结四组 numeric 与 world/levels 零改动，8 条 gameplay acceptance 原样保留；v2 为 M2 首卡基线（approved），本版只增不改。',
};

// ---------- numeric：追加 audio / mobile / deploy（键序与 src/kernel/numeric.ts 保持一致） ----------
v3.numeric.audio = {
  SFX_BUS_GAIN: 0.9,
  VOICE_POOL_SIZE: 8,
  COMBO_PITCH_STEP_SEMITONES: 1,
  COMBO_PITCH_CAP_SEMITONES: 12,
  SAMPLE_RATE_HZ: 44100,
  RESTART_SFX_MAX_MS: 200,
};
v3.numeric.mobile = {
  ROTATE_ASPECT_RATIO: 1,
};
v3.numeric.deploy = {
  PRECACHE_REVISION: 1,
  PWA_ICON_SIZES: [192, 512],
  APPLE_TOUCH_ICON_SIZE: 180,
};

// ---------- entities：追加 5 个 ----------
v3.entities.push(
  {
    id: 'e-audio-manager',
    name: '音频管理器',
    role: 'iOS 首手势解锁 AudioContext（解锁前入队、解锁后补放）→ sfx 预解码 → 8 音池调度 → sfx_bus_gain 0.9；' +
      '静音持久于 localStorage `st.settings.muted`；critical（miss/game-over/restart）满载不挤占；连击升调 playbackRate=2^(semitones/12) cap +12；' +
      '文件缺失回程序化合成，任何失败不抛错',
    script: 'games/stack-tower/src/audio/audio-manager.ts',
  },
  {
    id: 'e-touch-input-layer',
    name: '触控输入层',
    role: 'pointerdown 单一入口（触摸/笔/鼠标归一）+ touch-action: manipulation + 禁双击缩放/长按菜单（contextmenu/gesturestart preventDefault）；去抖 300ms 收口本层',
    script: 'games/stack-tower/src/platform/input.ts',
  },
  {
    id: 'e-sfx-pack-v1',
    name: '音效包 v1',
    role: '12 文件 = 6 事件（place/perfect/miss/game-over/restart/level-clear）× 双格式（.m4a+.ogg），命名 = `sfx-` + 事件 id，44.1kHz 单声道；注册表 manifest.json 为完整性断言点',
    script: 'games/stack-tower/assets/sfx/',
  },
  {
    id: 'e-pwa-shell',
    name: 'PWA 壳',
    role: 'manifest.webmanifest（standalone + 192/512 maskable 图标）+ sw.js 版本化 precache（REVISION=numeric.deploy.PRECACHE_REVISION）+ apple-touch-icon-180；`?fps=1` 帧率覆盖层（p95 / jank 计数）',
    script: 'games/stack-tower/{index.html,manifest.webmanifest,sw.js,assets/icons/}',
  },
  {
    id: 'e-rotate-overlay',
    name: '横屏遮罩',
    role: '视口宽高比 w/h > numeric.mobile.ROTATE_ASPECT_RATIO(=1) 即激活，激活即暂停内核 tick 与输入；纯函数 isLandscapeViewport(w,h) 判定；恢复竖屏自动解除',
    script: 'games/stack-tower/src/ui/rotate-overlay.ts',
  },
);

// ---------- content：towerRipple.restart 事件 + sfxPack / mobile / pwa 三段 ----------
v3.content.towerRipple = {
  ...v3.content.towerRipple,
  sfx_mapping: {
    place: 'block-placed（非 perfect）→ sfx-place',
    perfect: 'tower-ripple → sfx-perfect',
    miss: 'keepWidth 收窄但未触底（width-floor 之外的普通切损）→ sfx-miss',
    'game-over': 'game-over → sfx-game-over（critical）',
    restart: 'restart 事件 → sfx-restart（critical，≤200ms）',
    'level-clear': 'status→level-clear → sfx-level-clear',
  },
  restart: {
    event: 'restart',
    payload: { source: "'button' | 'keyboard'（HUD 按钮=button；键盘 R=keyboard）" },
    trigger: 'HUD 重开按钮 click / 键盘 R；事件先于内核复位被表现层消费',
    forbidden: '不携带 screen-flash / 整屏 aha 语义字段（与主波纹同纪律）',
  },
};
v3.content.sfxPack = {
  id: 'sfx-pack-v1',
  events: ['place', 'perfect', 'miss', 'game-over', 'restart', 'level-clear'],
  naming: '文件名 = `sfx-` + 事件 id（kebab-case），双格式 .m4a + .ogg 成对，共 12 文件',
  registry: 'assets/sfx/manifest.json（生成器产出）：{event_id → {m4a, ogg, duration_ms, sampleRateHz, channels}}；acc-a1 唯一断言点',
  sampleRate: '44100Hz 单声道（numeric.audio.SAMPLE_RATE_HZ）',
  gain: 'sfx_bus_gain = 0.9（numeric.audio.SFX_BUS_GAIN）',
  comboPitch: 'place 音连击升调：第 n 连 +n 半音（step=1），cap +12；miss 重置连击；playbackRate = 2^(semitones/12)',
  priority: 'critical = miss / game-over / restart：8 voices 满载时不得被挤占（可抢占最老非 critical voice）',
  persistence: '静音开关持久 localStorage `st.settings.muted`（刷新/重开保持）',
  degrade: '文件缺失/解码失败 → 回程序化合成（与 a04/a05 同源 voice 表）；任何失败不抛错、不刷 console.error',
  generator: 'tools/gen-audio.mjs（voice 表 → 16-bit PCM → WAV → afconvert/ffmpeg 编码，确定性可复现）',
};
v3.content.mobile = {
  input: 'pointerdown 单一入口；touch-action: manipulation；contextmenu/gesturestart preventDefault（禁长按菜单/双指缩放）',
  rotateOverlay: {
    active: '视口宽高比 w/h > numeric.mobile.ROTATE_ASPECT_RATIO(=1) → 激活',
    behavior: '激活即暂停内核 tick 与输入意图；恢复竖屏自动解除并续跑',
    text: '请竖屏游玩',
  },
  safeArea: {
    css: 'env(safe-area-inset-top/right/bottom/left) 换算 #hud padding',
    evidence: 'acc-m1 证据形式 = getComputedStyle 计算样式快照（注入模拟 inset 后 padding 随动）+ 真机清单（iPhone 刘海 / Android 手势条）',
  },
};
v3.content.pwa = {
  manifest: 'manifest.webmanifest：name/short_name/start_url=./scope=./display=standalone/theme_color/background_color + icons 192/512（purpose "maskable any"）',
  icons: ['assets/icons/icon-192-maskable.png', 'assets/icons/icon-512-maskable.png', 'assets/icons/apple-touch-icon-180.png'],
  serviceWorker: 'sw.js 版本化 precache：CACHE 名含 numeric.deploy.PRECACHE_REVISION；install 全量预缓存核心资源；activate 清理旧版本缓存',
  fpsOverlay: '`?fps=1` 帧率覆盖层：逐帧耗时 + p95 + >50ms jank 计数（acc-a5b 真机核查入口）',
  hosting: 'PWA 可安装要求 HTTPS 托管；托管地址待主人指认（acc-d1 真机安装项挂账，不阻塞开发与自动化验收）',
};

// ---------- assets：追加 2 条 ----------
v3.assets.push(
  {
    id: 'a06-sfx-restart',
    file: 'games/stack-tower/assets/sfx/',
    generator: 'procedural:webaudio→wav→afconvert/ffmpeg（tools/gen-audio.mjs）',
    kind: 'audio',
    license: '仓库内合成，无第三方素材',
    source: 'generated',
  },
  {
    id: 'a07-pwa-icons',
    file: 'games/stack-tower/assets/icons/',
    generator: 'procedural:canvas2d（tools/pnglib.mjs）',
    kind: 'image',
    license: '仓库内程序化生成',
    source: 'generated',
  },
);

// ---------- acceptance：追加 14 条 M2.1 增量 ----------
const C = 'node games/stack-tower/tests/contract/';
v3.acceptance.push(
  {
    id: 'acc-a1',
    statement: 'sfx-pack-v1 资产注册表完整性：12 文件（6 事件 × m4a+ogg 成对）、命名 = `sfx-` + 事件 id、44.1kHz 单声道、时长≤400ms（restart ≤200ms）；manifest.json 与落盘逐项对号 + 音频头采样率/声道校验。（QA 修正③：不再断言网络 404，404 子句移入 acc-d2）',
    check: `${C}m21-acc-a1-sfx-pack-registry.spec.mjs`,
  },
  {
    id: 'acc-a2',
    statement: '移动端首次手势解锁：AudioManager 在首个 pointerdown 内完成 AudioContext resume；spy 断言解锁前 play 不出声（入队挂起），解锁后 state=running 且挂起/后续事件正常出声。真机（iOS Safari）项挂日期另行核销。',
    check: `${C}m21-acc-a2-unlock.spec.mjs`,
  },
  {
    id: 'acc-a3',
    statement: '静音持久：toggle 后 localStorage `st.settings.muted` 落盘；重建实例读回静音态；静音态 play 零输出节点（零 source 挂载）。',
    check: `${C}m21-acc-a3-mute-persist.spec.mjs`,
  },
  {
    id: 'acc-a4a',
    statement: '连击升调（QA 修正①拆分 a4a）：place 音第 n 连（n=1..5）升 n 半音（逐块 +1），playbackRate = 2^(semitones/12)；miss 后重置回 0 半音。',
    check: `${C}m21-acc-a4a-combo-pitch.spec.mjs`,
  },
  {
    id: 'acc-a4b',
    statement: '连击升调封顶（QA 修正①拆分 a4b）：第 13、14 块（及任意更高连击）升调均 +12 封顶，不再随连击增加。',
    check: `${C}m21-acc-a4b-combo-cap.spec.mjs`,
  },
  {
    id: 'acc-a5a',
    statement: 'critical 音不挤占（QA 修正②拆分 a5a，单元级 spy）：8 voices 全满载时 miss / game-over / restart 仍出声（critical 绕过池上限，抢占最老非 critical voice）；非 critical 满载时新 place 被丢弃不超池。',
    check: `${C}m21-acc-a5a-critical-priority.spec.mjs`,
  },
  {
    id: 'acc-a5b',
    statement: '有声开销预算（QA 修正②拆分 a5b）：seed=20260925、3 秒（187 tick）20 连 tap，有声局相对静音局逐 tick 帧耗对比——有声局零新增 >50ms 帧。',
    check: `${C}m21-acc-a5b-audio-frame-budget.spec.mjs`,
  },
  {
    id: 'acc-a6',
    statement: 'tower-ripple 契约新增 restart 事件：sim.restart(source) 上抛恰 {type,source} 载荷（HUD 按钮=button，键盘 R=keyboard）；无 screen-flash 语义字段；restart 触发 sfx-restart（12 文件清单内，≤200ms）。',
    check: `${C}m21-acc-a6-restart-event.spec.mjs`,
  },
  {
    id: 'acc-m1',
    statement: '安全区：#hud padding 由 env(safe-area-inset-*) 换算；证据形式 = getComputedStyle 计算样式快照（注入模拟 inset 后 padding 逐边随动）+ 真机清单（iPhone 刘海/Android 手势条）挂日期。',
    check: `${C}m21-acc-m1-safe-area.spec.mjs`,
  },
  {
    id: 'acc-m2',
    statement: '触控归一：pointerdown 单一入口（触摸/笔/鼠标）、touch-action: manipulation、禁长按菜单/双指缩放（contextmenu/gesturestart preventDefault）；300ms 去抖语义与既有 INTENT_DEBOUNCE_MS 一致。真机（中端 Android/iOS）项挂日期。',
    check: `${C}m21-acc-m2-touch-input.spec.mjs`,
  },
  {
    id: 'acc-m3',
    statement: '横屏遮罩激活即暂停：RotateOverlay 激活期间内核 tick 不推进、输入意图被忽略；恢复竖屏自动解除。真机项挂日期。',
    check: `${C}m21-acc-m3-rotate-pause.spec.mjs`,
  },
  {
    id: 'acc-m4',
    statement: '遮罩判定基于视口宽高比（QA 修正④）：isLandscapeViewport(w,h) ⇔ w/h > 1；横屏(720×480)激活、竖屏(480×720)不激活、正方形(500×500)不激活；纯函数逐组断言。',
    check: `${C}m21-acc-m4-rotate-aspect.spec.mjs`,
  },
  {
    id: 'acc-d1',
    statement: 'PWA 可安装壳：manifest.webmanifest（standalone + icons 192/512 purpose maskable）+ apple-touch-icon-180 link + index.html 引用 + sw.js 注册；HTTPS 托管地址待主人指认，真机安装项挂账不阻塞自动化验收。',
    check: `${C}m21-acc-d1-pwa-shell.spec.mjs`,
  },
  {
    id: 'acc-d2',
    statement: '断网冒烟全链路（SW precache 后离线）：冷启动→一局（tap 落块计分）→结算→重开→静音持久；含无音频 404 负面用例（sfx 全 404 不抛错、核心循环可玩）。（QA 修正③：承接 acc-a1 移出的 404 子句）',
    check: `${C}m21-acc-d2-offline-smoke.spec.mjs`,
  },
);

const OUT = join(ROOT, '.myrd', 'spec', 'stack-tower-spec-v3-content.json');
writeFileSync(OUT, JSON.stringify(v3, null, 2));
console.log(`  ok    冻结段守卫通过（world/levels/frozen numeric/8 条 gameplay acceptance 逐字节等价）`);
console.log(`  ok    增量：numeric +3 组 / entities +5 / assets +2 / content +3 段 + restart 事件 / acceptance +14`);
console.log(`  ok    acceptance 总数 ${v3.acceptance.length}（8 冻结 + 14 增量）`);
console.log(`RESULT: PASS — ${OUT}`);

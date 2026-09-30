"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSilentAudioManager = createSilentAudioManager;
exports.boot = boot;
/**
 * 组装根 — 事件单向流的翻译站：内核事件 → 表现层副作用。
 * 纪律：main 不写玩法逻辑；数值一律取自 kernel/numeric；平台差异一律经 platform/。
 * M2.1 新增：AudioManager（解锁/音池/静音持久/连击升调）、横屏遮罩暂停、?fps=1 帧率面板、SW 注册。
 */
const sim_js_1 = require("../kernel/sim.js");
const numeric_js_1 = require("../kernel/numeric.js");
const audio_manager_js_1 = require("../audio/audio-manager.js");
const audio_manager_js_2 = require("../audio/audio-manager.js");
const renderer_js_1 = require("../render/renderer.js");
const assets_js_1 = require("../render/assets.js");
const hud_js_1 = require("../ui/hud.js");
const rotate_overlay_js_1 = require("../ui/rotate-overlay.js");
const emitter_js_1 = require("../telemetry/emitter.js");
const meta_js_1 = require("../telemetry/meta.js");
const fps_overlay_js_1 = require("../ui/fps-overlay.js");
const meta_badge_js_1 = require("../ui/meta-badge.js");
const meta_daily_card_js_1 = require("../ui/meta-daily-card.js");
const save_js_1 = require("../meta/save.js");
const streak_js_1 = require("../meta/streak.js");
const claim_js_1 = require("../meta/claim.js");
const daily_js_1 = require("../meta/daily.js");
/** localStorage 不可用（隐私模式/无头）时的空存储（meta 全部退化为会话态，不抛错） */
function safeStorage() {
    try {
        if (typeof localStorage !== 'undefined')
            return localStorage;
    }
    catch {
        /* fallthrough */
    }
    return { getItem: () => null, setItem: () => { } };
}
/** headless 兜底音频管理器（ctx=null → play 一律 no-ctx 静音，不抛错） */
function createSilentAudioManager() {
    return (0, audio_manager_js_1.createAudioManager)({ ctx: null, storage: null, now: () => 0, loadBuffer: async () => null });
}
function boot(platform, opts) {
    const sim = (0, sim_js_1.createSim)({ seed: opts?.seed ?? numeric_js_1.NUMERIC.DEFAULT_SEED });
    const renderer = new renderer_js_1.Renderer();
    const audio = platform.audioManager ?? createSilentAudioManager();
    const hud = (0, hud_js_1.mountHud)(document.getElementById('hud'));
    hud.setMutedVisual(audio.isMuted());
    // —— M2.1：横屏遮罩（激活即暂停）+ ?fps=1 帧率面板 ——
    const rotate = (0, rotate_overlay_js_1.createRotateOverlay)(numeric_js_1.NUMERIC.mobile.ROTATE_ASPECT_RATIO);
    rotate.mount(document.getElementById('stage'));
    let paused = false;
    rotate.onChange((active) => {
        paused = active;
    });
    // —— v1.2：五钩子埋点（e-telemetry-emitter，acc-e1 契约；异常隔离，零 PII）——
    // 埋点出口：默认 no-op 浏览器依赖；QA 契约经 opts.telemetrySink 注入采集器（不写一行平台代码）
    const telemetry = (0, emitter_js_1.createTelemetryEmitter)(opts?.telemetrySink
        ? { ...(0, emitter_js_1.browserTelemetryDeps)(() => platform.clock.now()), sink: opts.telemetrySink }
        : (0, emitter_js_1.browserTelemetryDeps)(() => platform.clock.now()));
    telemetry.emit('session_start', { data: { seed: String(opts?.seed ?? numeric_js_1.NUMERIC.DEFAULT_SEED) } });
    const offPageHide = (() => {
        const onHide = () => telemetry.emit('session_end');
        window.addEventListener('pagehide', onHide);
        return () => window.removeEventListener('pagehide', onHide);
    })();
    const fpsEnabled = new URLSearchParams(location.search).has('fps');
    const fps = (0, fps_overlay_js_1.createFpsOverlay)();
    if (fpsEnabled)
        fps.mount(document.body);
    // 输入：platform 归一后的意图 → 内核（在下一个 tick 起点生效）；遮罩激活期间忽略
    const pendingIntents = [];
    const offInput = platform.input.onIntent((intent) => {
        if (!paused)
            pendingIntents.push(intent);
    });
    // —— 事件翻译：内核 → 表现层（唯一副作用入口）。连击升调取自内核快照 combo ——
    /** acc-j3 可测点：play 调用毫秒（与 dispatch 同源时钟） */
    const play_msOf = (ms) => ms;
    let lastStatus = sim.snapshot().status;
    /** B1 meta 层挂载结果（初始化失败为 null；onMatchOutcome 由事件翻译站驱动） */
    let metaLayer = null;
    const handleEvents = (events, combo, status) => {
        const semis = (0, audio_manager_js_2.semitonesForCombo)(combo);
        const dispatchMs = platform.clock.now(); // acc-j3 起点：事件进入翻译站（dispatch）
        for (const e of events) {
            if (e.type === 'tower-ripple') {
                renderer.enqueueRipple(e, platform.clock.now());
                const playMs = platform.clock.now(); // acc-j3 终点：AudioContext 播放调用（play 调用点）
                audio.play('perfect', semis);
                telemetry.emit('perfect_hit', { dispatch_ms: dispatchMs, play_ms: play_msOf(playMs), data: { combo } });
            }
            else if (e.type === 'block-placed') {
                // 落块闷响按连击逐块升调（+1 半音/块，cap +12；miss 后 combo=0 归零）
                audio.play('place', semis);
                telemetry.emit('block_place', { data: { combo, perfect: e.perfect } });
            }
            else if (e.type === 'game-over') {
                // critical：完全脱靶=miss，切损触底=game-over（满载不挤占）
                audio.play(e.reason === 'total-miss' ? 'miss' : 'game-over', 0);
                telemetry.emit('game_over', { data: { reason: e.reason } });
                metaLayer?.onMatchOutcome('game-over'); // B1：连胜清零（acc-b4）
            }
            else if (e.type === 'restart') {
                audio.play('restart', 0);
                telemetry.emit('restart');
            }
        }
        if (status === 'level-clear' && lastStatus !== 'level-clear') {
            audio.play('level-clear', 0);
            metaLayer?.onMatchOutcome('level-clear'); // B1：连胜 +1 / 当日挑战完成记账（acc-b4/b7）
        }
        lastStatus = status;
    };
    // 固定步长双循环：rAF 可变渲染 + 16ms 固定逻辑（累加器，dt 钳制 MAX_DT）
    let last = platform.clock.now();
    let acc = 0;
    let frameStart = platform.clock.now();
    const offFrame = platform.clock.onNextFrame((now) => {
        if (fpsEnabled)
            fps.sample(now - frameStart);
        frameStart = now;
        acc += Math.min(now - last, numeric_js_1.NUMERIC.MAX_DT_MS);
        last = now;
        if (paused) {
            acc = 0; // 遮罩激活即暂停：不推进内核（摆块冻结）、丢弃时间片防累积追帧
        }
        else {
            while (acc >= numeric_js_1.NUMERIC.FIXED_STEP_MS) {
                const events = sim.tick(pendingIntents.shift());
                const snap = sim.snapshot();
                handleEvents(events, snap.combo, snap.status);
                acc -= numeric_js_1.NUMERIC.FIXED_STEP_MS;
            }
        }
        const snapshot = sim.snapshot();
        if (platform.canvas) {
            renderer.draw(platform.canvas.context2d(), snapshot, platform.clock.now(), {
                width: platform.canvas.logicalWidth,
                height: platform.canvas.logicalHeight,
            });
        }
        hud.update(snapshot);
    });
    // 重开入口：HUD 按钮（source=button）/ 键盘 R（source=keyboard）→ 契约级 restart 事件
    const restart = (source = 'button') => {
        const events = sim.restart(source);
        handleEvents(events, sim.snapshot().combo, sim.snapshot().status);
        renderer.clearFx();
    };
    hud.onRestart(() => restart('button'));
    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R')
            restart('keyboard');
    });
    // —— M2.1：静音开关（localStorage st.settings.muted 持久）+ 首手势解锁 ——
    hud.onToggleMute(() => {
        const muted = audio.toggleMute();
        hud.setMutedVisual(muted);
    });
    // assets/ 实体贴图预载（异步、非阻塞；失败静默回程序化绘制 —— 引用失败不得破坏运行）
    if (platform.assets) {
        void (0, assets_js_1.loadGameAssets)((url) => platform.assets.loadImage(url), (msg) => console.info(msg)).then((assets) => {
            renderer.applyAssets(assets);
            if (assets.restartButton)
                hud.applyRestartSkin(assets.restartButton.src);
        });
    }
    // —— B1 上头循环（spec v1.4 content.retention：daily-challenge / streak-display / meta 埋点）——
    // 红线：meta 全部 try/catch 隔离；数值零取自 numeric（完成判定由内核 status 驱动）；失败不阻断游戏。
    try {
        const metaStorage = safeStorage();
        (0, save_js_1.migrateV13)(metaStorage, new Date().toISOString()); // v1.3 → v2 迁移（既有键零触碰，幂等）
        const metaSave = (0, save_js_1.loadMetaSave)(metaStorage, new Date().toISOString());
        const persistMeta = () => (0, save_js_1.saveMetaSave)(metaStorage, metaSave, new Date().toISOString());
        const metaTelemetry = (0, meta_js_1.createMetaTelemetry)(opts?.telemetrySink
            ? {
                ...(0, meta_js_1.browserMetaTelemetryDeps)(telemetry.anonId, () => platform.clock.now()),
                sender: (p) => {
                    opts?.telemetrySink?.(p);
                    return true;
                },
            }
            : (0, meta_js_1.browserMetaTelemetryDeps)(telemetry.anonId, () => platform.clock.now()));
        const daily = (0, daily_js_1.createDailyChallenge)(new Date().toISOString());
        metaTelemetry.emit('daily_challenge_start', { challengeDate: daily.challengeDate });
        const badge = (0, meta_badge_js_1.createStreakBadge)(document, { appendChild: (n) => document.getElementById('stage')?.appendChild(n) });
        badge.update(metaSave);
        // 每日挑战卡（纯呈现：日期 + 领取态；非交互零弹窗，acc-j5 红线）
        const card = (0, meta_daily_card_js_1.createDailyCard)(document, { appendChild: (n) => document.getElementById('stage')?.appendChild(n) });
        const refreshCard = () => {
            card.update(daily.challengeDate, metaSave.daily.claimedDates.includes(daily.challengeDate));
        };
        refreshCard();
        // N2 meta 资产即插即换（窄口径 3 件：streak-badge / daily-challenge-card / icon-badge；
        // mission-panel = missions-deferred 预留件不接线）：装载失败静默回主题令牌态，绝不抛错
        if (platform.assets) {
            void (0, assets_js_1.loadMetaAssets)((url) => platform.assets.loadImage(url), (msg) => console.info(msg)).then((metaAssets) => {
                if (metaAssets.streakBadge)
                    badge.applyBadgeSkin(metaAssets.streakBadge.src);
                if (metaAssets.dailyChallengeCard)
                    card.applyCardSkin(metaAssets.dailyChallengeCard.src);
                if (metaAssets.iconBadge)
                    card.applyIconSkin(metaAssets.iconBadge.src);
                refreshCard(); // 皮肤化后重算角标形态（字形 ✓ ↔ icon-badge 图）
            });
        }
        metaLayer = {
            onMatchOutcome(outcome) {
                (0, streak_js_1.applyMatchResult)(metaSave, outcome);
                metaTelemetry.emit('streak_update', { streak: metaSave.streak.current, reason: outcome });
                if (outcome === 'level-clear') {
                    try {
                        (0, claim_js_1.claimDailyReward)(metaSave, daily.challengeDate, persistMeta);
                        metaTelemetry.emit('daily_challenge_result', { challengeDate: daily.challengeDate, layers: sim.snapshot().layers, claimed: true });
                    }
                    catch {
                        /* 崩溃注入路径：落盘失败由下次对局重试（幂等，acc-b7） */
                    }
                }
                try {
                    persistMeta();
                }
                catch {
                    /* 存储不可用 → 会话态 */
                }
                badge.update(metaSave);
                refreshCard();
            },
        };
    }
    catch {
        metaLayer = null; // meta 整层故障不影响核心玩法
    }
    // M2.1：Service Worker 注册（PWA 可安装壳；失败不抛错）
    // R1②（U6 修复）：显式 script + scope，不再依赖文档 base URL 隐式推导——
    //  - script 仍按 <base> 解析：壳形态落在 api/public/assets/sw.js（与 sw.js 内
    //    precache 的相对键同源）；本地/静态形态落在页面目录下。
    //  - scope 取页面所在目录（new URL('./', location.href)）：壳形态 = /apps/<slug>/，
    //    本地根形态 = /。默认 max scope（脚本目录）覆盖不了页面 → 由壳对 sw.js 响应
    //    的 Service-Worker-Allowed 头放宽（serve.mjs 根路径形态本就允许，无需头）。
    if ('serviceWorker' in navigator) {
        const script = new URL('sw.js', document.baseURI).href;
        const scope = new URL('./', location.href).href;
        navigator.serviceWorker
            .register(script, { scope })
            .catch(() => console.info('[pwa] SW 注册失败（离线 precache 不可用）'));
    }
    return {
        restart,
        setViewport: (width, height) => rotate.setViewport(width, height),
        dispose() {
            telemetry.emit('session_end');
            offPageHide();
            offInput();
            offFrame();
            rotate.dispose();
            fps.dispose();
            audio.dispose();
        },
    };
}

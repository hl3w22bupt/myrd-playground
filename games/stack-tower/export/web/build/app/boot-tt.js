/**
 * tt 入口装配（C 抖音小游戏移植轮 · dy-runtime / dy-share-loop 落点；tt/game.js require 本模块编译产物）。
 *
 * 职责：在动态 import 组装根（app/main.js）之前安装最小 shim（boot 的依赖面：hud/stage/window/
 * location/navigator + **localStorage**——meta 存档经 main.ts safeStorage() 走 tt 存储，键
 * st.meta.save.v2 / st.settings.muted 与 web 同键同读写路径零分叉），使游戏代码零改动跑在
 * tt 运行时；HUD 由 shim 直绘 tt 画布（分数/连击/关卡/状态 + 重开/静音/分享三按钮）。
 * web 链路（main.ts / index.html）不 import 本文件 → web 行为零变化。
 */
import { createTtPlatform, createTtShareRegistrar, TT_STORAGE_KEYS } from '../platform/tt.js';
import { installShareMenuWith, TT_SHARE_CARDS } from '../platform/share.js';
/** 会话 id：本地 UUID v4（与埋点 anon_id 同源语义，零 PII） */
function sessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
const BTN_W = 128;
const BTN_H = 34;
/** HUD 画布直绘层：行文案 + 重开/静音/分享按钮（触控命中在 tt 装配体拦截；安全区避让） */
function createHudLayer(ctx, viewW) {
    const lines = [];
    const buttons = new Map();
    const panel = 'rgba(6,12,28,0.72)';
    const cyan = '#00e5ff';
    const white = '#e8f6ff';
    return {
        setLine(name, text) {
            const l = lines.find((x) => x.name === name);
            if (l)
                l.text = text;
            else
                lines.push({ name, text });
        },
        addButton(name) {
            if (!buttons.has(name))
                buttons.set(name, { text: '', rect: { x: 0, y: 0, w: BTN_W, h: BTN_H }, handlers: [] });
        },
        setButtonText(name, text) {
            const b = buttons.get(name);
            if (b)
                b.text = text;
        },
        bindHandler(name, handler) {
            buttons.get(name)?.handlers.push(handler);
        },
        /** 触控命中：true = 按钮消费（不产生落块意图） */
        hitTest(x, y) {
            for (const b of buttons.values()) {
                const r = b.rect;
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    b.handlers.forEach((h) => h());
                    return true;
                }
            }
            return false;
        },
        /** 每帧末尾覆盖绘制（注册晚于游戏帧链 → 永在最上层）；safeTop/safeBottom = 安全区内缩 */
        draw(viewH, safeTop, safeBottom) {
            const names = [...buttons.keys()];
            names.forEach((name, i) => {
                const b = buttons.get(name);
                if (!b)
                    return;
                const x = i === 0 ? 16 : i === names.length - 1 ? viewW - BTN_W - 16 : (viewW - BTN_W) / 2;
                b.rect = { x, y: viewH - BTN_H - 18 - safeBottom, w: BTN_W, h: BTN_H };
            });
            const lineH = 22;
            ctx.fillStyle = panel;
            ctx.fillRect(8, 8 + safeTop, Math.min(viewW - 16, 220), lines.length * lineH + 16);
            ctx.font = '14px sans-serif';
            ctx.textBaseline = 'middle';
            lines.forEach((l, i) => {
                ctx.fillStyle = l.name.includes('status') ? cyan : white;
                ctx.fillText(l.text, 18, 18 + safeTop + i * lineH);
            });
            for (const b of buttons.values()) {
                ctx.fillStyle = panel;
                ctx.fillRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
                ctx.strokeStyle = cyan;
                ctx.lineWidth = 2;
                ctx.strokeRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
                ctx.fillStyle = cyan;
                ctx.fillText(b.text, b.rect.x + 14, b.rect.y + BTN_H / 2);
            }
        },
    };
}
/** 最小 DOM shim：className/textContent 按钮与 HUD 行直路由；其余 no-op（boot 依赖面外零假设） */
function installDomShim(hud) {
    const noop = () => { };
    let windowListeners = {};
    const makeEl = (tag) => {
        const el = {
            tagName: tag.toUpperCase(),
            children: [],
            style: new Proxy({}, { set: () => true, get: () => '' }),
            appendChild(child) { el.children.push(child); },
            setAttribute: noop,
            removeEventListener: noop,
        };
        if (tag === 'button') {
            let name = '';
            Object.defineProperty(el, 'className', {
                set(v) {
                    name = v.includes('restart') ? 'st-hud-restart' : v.includes('mute') ? 'st-hud-mute' : v.includes('share') ? 'st-hud-share' : v;
                    hud.addButton(name);
                },
                get: () => name,
            });
            Object.defineProperty(el, 'textContent', {
                set(v) { hud.setButtonText(name, String(v)); },
                get: () => '',
            });
            el.addEventListener = (type, handler) => {
                if (type === 'click')
                    hud.bindHandler(name, handler);
            };
        }
        else {
            let cls = '';
            Object.defineProperty(el, 'className', { set(v) { cls = v; }, get: () => cls });
            Object.defineProperty(el, 'textContent', {
                set(v) { if (cls.startsWith('st-hud-'))
                    hud.setLine(cls, String(v)); },
                get: () => '',
            });
            el.addEventListener = noop;
        }
        return el;
    };
    const hudEl = makeEl('div');
    const stageEl = makeEl('div');
    Object.assign(globalThis, {
        document: {
            getElementById: (id) => (id === 'hud' ? hudEl : id === 'stage' ? stageEl : null),
            createElement: (tag) => makeEl(tag),
            body: makeEl('body'),
            head: makeEl('head'),
            addEventListener: noop,
        },
        window: {
            addEventListener(type, h) { (windowListeners[type] ??= []).push(h); },
            removeEventListener(type, h) {
                windowListeners[type] = (windowListeners[type] ?? []).filter((x) => x !== h);
            },
            __dispatch(type) { (windowListeners[type] ?? []).forEach((h) => h()); },
        },
        location: { search: '' },
        navigator: {},
    });
    return () => {
        windowListeners = {};
    };
}
/** localStorage shim（tt 存储背书）：main.ts safeStorage() → tt 存储，同键同读写路径零分叉 */
function installStorageShim() {
    const read = (key) => {
        try {
            const v = tt.getStorageSync(key);
            return typeof v === 'string' ? v : v == null ? null : String(v);
        }
        catch {
            return null;
        }
    };
    const write = (key, value) => {
        try {
            tt.setStorageSync(key, value);
        }
        catch {
            /* 存储满/隐私态：meta 退化为会话态，不抛错 */
        }
    };
    const backing = new Map();
    Object.assign(globalThis, {
        localStorage: {
            getItem: (key) => backing.has(key) ? backing.get(key) : read(key),
            setItem: (key, value) => {
                backing.set(key, value);
                write(key, value);
            },
            removeItem: (key) => { backing.delete(key); },
            clear: () => { backing.clear(); },
            key: (i) => [...backing.keys()][i] ?? null,
            get length() { return backing.size; },
        },
    });
}
export async function bootTt() {
    const info = tt.getSystemInfoSync();
    const canvas = tt.createCanvas();
    const sid = sessionId();
    const safeTop = Math.max(0, Math.round(info.safeArea?.top ?? 0));
    const safeBottom = Math.max(0, Math.round((info.windowHeight - (info.safeArea?.bottom ?? info.windowHeight))));
    const hud = createHudLayer(canvas.getContext('2d'), info.windowWidth);
    installStorageShim();
    const resetWindowListeners = installDomShim(hud);
    const registrar = createTtShareRegistrar();
    const handles = createTtPlatform({
        canvas,
        sessionId: sid,
        interceptTouch: (x, y) => hud.hitTest(x, y),
        ttGlobal: typeof tt === 'undefined' ? undefined : tt,
    });
    const { boot } = await import('./main.js');
    const session = boot(handles.platform);
    session.setViewport(info.windowWidth, info.windowHeight);
    // 好友榜通道（dy-runtime 口径①）：装配期打印通道态（门禁可见；接入=cloud / 显式降级=degraded+原因）
    console.log(handles.friendRank.mode === 'cloud'
        ? 'DY_FRIEND_RANK=cloud'
        : `DY_FRIEND_RANK=degraded reason=${handles.friendRank.reason ?? 'unknown'}`);
    // 分享闭环（dy-share-loop）：dy-share-card 主判据 + sid 载荷；注册面在 platform/tt.ts
    installShareMenuWith(registrar, sid, TT_SHARE_CARDS);
    hud.addButton('st-hud-share');
    hud.setButtonText('st-hud-share', '分享');
    hud.bindHandler('st-hud-share', () => registrar.shareNow());
    // tt 生命周期补发 web 语义事件（pagehide → session_end 埋点口径对齐）+ BGM 环由装配体同步
    tt.onHide(() => globalThis.window.__dispatch('pagehide'));
    // HUD 绘制链：注册晚于游戏帧链 → 每帧覆盖绘制在最上层（安全区内缩仅表现层布局输入）
    const drawHud = () => {
        hud.draw(info.windowHeight, safeTop, safeBottom);
        requestAnimationFrame(drawHud);
    };
    requestAnimationFrame(drawHud);
    void resetWindowListeners;
    void handles.safeArea; // 安全区已折算进 HUD 内缩（表现层布局输入，零进内核）
    void TT_STORAGE_KEYS; // 键名常量单源自证（tt.ts 导出面在门禁断言）
}

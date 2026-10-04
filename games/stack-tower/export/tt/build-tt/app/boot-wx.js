"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootWx = bootWx;
/**
 * wx 入口装配（B0 · wx/game.js require 本模块编译产物）。
 *
 * 职责：在动态 import 组装根（app/main.js）之前安装最小 DOM shim（boot 的依赖面：
 * hud/stage/window/location/navigator——rotate/fps/SW 均空安全或守卫），使游戏代码零改动跑在
 * wx 运行时；HUD 由 shim 直绘 wx 画布（分数/连击/关卡/状态 + 重开/静音两按钮，静音键与
 * AudioManager 同源）。web 链路（main.ts）不 import 本文件 → web 行为零变化。
 */
const wx_js_1 = require("../platform/wx.js");
const share_js_1 = require("../platform/share.js");
/** 会话 id：本地 UUID v4（与埋点 anon_id 同源语义，零 PII） */
function sessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
const BTN_W = 128;
const BTN_H = 34;
/** HUD 画布直绘层：行文案 + 重开/静音按钮（触控命中在 wx 装配体拦截） */
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
        /** 每帧末尾覆盖绘制（注册晚于游戏帧链 → 永在最上层） */
        draw(viewH) {
            const names = [...buttons.keys()];
            names.forEach((name, i) => {
                const b = buttons.get(name);
                if (b)
                    b.rect = { x: i === 0 ? 16 : viewW - BTN_W - 16, y: viewH - BTN_H - 18, w: BTN_W, h: BTN_H };
            });
            const lineH = 22;
            ctx.fillStyle = panel;
            ctx.fillRect(8, 8, Math.min(viewW - 16, 220), lines.length * lineH + 16);
            ctx.font = '14px sans-serif';
            ctx.textBaseline = 'middle';
            lines.forEach((l, i) => {
                ctx.fillStyle = l.name.includes('status') ? cyan : white;
                ctx.fillText(l.text, 18, 18 + i * lineH);
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
                    name = v.includes('restart') ? 'st-hud-restart' : v.includes('mute') ? 'st-hud-mute' : v;
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
async function bootWx() {
    const info = wx.getSystemInfoSync();
    const canvas = wx.createCanvas();
    const sid = sessionId();
    const hud = createHudLayer(canvas.getContext('2d'), info.windowWidth);
    const resetWindowListeners = installDomShim(hud);
    const handles = (0, wx_js_1.createWxPlatform)({
        canvas,
        sessionId: sid,
        interceptTouch: (x, y) => hud.hitTest(x, y),
    });
    const { boot } = await Promise.resolve().then(() => require('./main.js'));
    const session = boot(handles.platform);
    session.setViewport(info.windowWidth, info.windowHeight);
    // 分享闭环（wx-share-loop）：会话卡主判据 + 朋友圈附带项，注册面在 platform/wx.ts
    (0, share_js_1.installShareMenu)((0, wx_js_1.createWxShareRegistrar)(), sid);
    // wx 生命周期补发 web 语义事件（pagehide → session_end 埋点口径对齐）
    wx.onHide(() => globalThis.window.__dispatch('pagehide'));
    // HUD 绘制链：注册晚于游戏帧链 → 每帧覆盖绘制在最上层
    const drawHud = () => {
        hud.draw(info.windowHeight);
        wx.requestAnimationFrame(drawHud);
    };
    wx.requestAnimationFrame(drawHud);
    void resetWindowListeners;
}

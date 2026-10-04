"use strict";
/**
 * platform/ 适配层 — 平台差异（DOM 事件 / rAF / 时钟 / 音频）在此归一。
 * 红线：内核（kernel/）禁止 import 本层以外的任何平台 API；表现层经本层接口取用。
 * 依赖方向：app/main → platform + kernel + render + ui；kernel 不依赖 platform。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManualClock = createManualClock;
exports.createSilentAudio = createSilentAudio;
exports.createNoopInput = createNoopInput;
/** 手动泵时钟（契约测试 / 无头环境）：由测试代码推进帧，零真实时间依赖 */
function createManualClock(startMs = 0) {
    let now = startMs;
    let handler = null;
    return {
        onNextFrame(h) {
            handler = h;
            return () => {
                handler = null;
            };
        },
        now() {
            return now;
        },
        advance(ms) {
            now += ms;
        },
        pump() {
            handler?.(now);
        },
    };
}
/** 无声音频（headless / 静音模式） */
function createSilentAudio() {
    return { play: () => { } };
}
/** 无输入源（headless）：契约测试直接注入 intent，不经输入层 */
function createNoopInput() {
    return { onIntent: () => () => { } };
}

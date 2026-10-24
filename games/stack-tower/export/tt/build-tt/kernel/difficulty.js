"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetLayers = exports.perfectWindowMs = exports.swingSpeed = void 0;
exports.levelId = levelId;
exports.levelTuning = levelTuning;
exports.isLevelClear = isLevelClear;
exports.nextLevel = nextLevel;
exports.baseBlockWidth = baseBlockWidth;
/**
 * 难度调度（实体 e-difficulty-scheduler）— 关卡推进与 id 派生。
 * 红线：速度/窗口/层目标一律取自 numeric.ts 公式，禁止散落魔法数。
 */
const numeric_js_1 = require("./numeric.js");
Object.defineProperty(exports, "swingSpeed", { enumerable: true, get: function () { return numeric_js_1.swingSpeed; } });
Object.defineProperty(exports, "perfectWindowMs", { enumerable: true, get: function () { return numeric_js_1.perfectWindowMs; } });
Object.defineProperty(exports, "targetLayers", { enumerable: true, get: function () { return numeric_js_1.targetLayers; } });
/** 关卡 id 派生：1 → 'lvl-01-stack-tower'（spec.levels[].id 命名约定） */
function levelId(level) {
    return `lvl-${String(level).padStart(2, '0')}-stack-tower`;
}
function levelTuning(level) {
    const speedPxs = (0, numeric_js_1.swingSpeed)(level);
    const windowMs = (0, numeric_js_1.perfectWindowMs)(level);
    return {
        level,
        id: levelId(level),
        speedPxs,
        windowMs,
        distancePx: (speedPxs * windowMs) / 1000,
        target: (0, numeric_js_1.targetLayers)(level),
    };
}
/** 是否已达本关层目标（cumulative：塔身已落块数，不含塔基） */
function isLevelClear(layers, level) {
    return layers >= (0, numeric_js_1.targetLayers)(level);
}
/** 进入下一关（层数累计，塔身不清；速度/窗口只随关卡公式变化） */
function nextLevel(level) {
    return Math.min(level + 1, numeric_js_1.NUMERIC.difficulty.LEVEL_COUNT);
}
/** 塔基块宽度参照（=BLOCK_BASE_WIDTH） */
function baseBlockWidth() {
    return numeric_js_1.NUMERIC.cut_width.BLOCK_BASE_WIDTH;
}

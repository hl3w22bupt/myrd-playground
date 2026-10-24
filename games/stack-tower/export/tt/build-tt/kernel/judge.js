"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.judgeDrop = judgeDrop;
/**
 * 完美判定（实体 e-perfect-judge）。
 * 判据：|offset| ≤ swingSpeed(level) × perfectWindowMs(level) / 1000（L1 = 22.4px）。
 * perfect → 宽度不减、combo+1、发射 tower-ripple。
 */
const numeric_js_1 = require("./numeric.js");
function judgeDrop(offsetPx, level) {
    const thresholdPx = (0, numeric_js_1.perfectDistance)(level);
    return { perfect: Math.abs(offsetPx) <= thresholdPx, thresholdPx, offsetPx };
}

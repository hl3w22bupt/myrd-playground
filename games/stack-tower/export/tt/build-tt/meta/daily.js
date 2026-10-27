"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TZ_OFFSET_MINUTES = void 0;
exports.challengeDateOf = challengeDateOf;
exports.createDailyChallenge = createDailyChallenge;
exports.isChallengeComplete = isChallengeComplete;
/**
 * 每日挑战（实体 e-meta-daily，spec v1.4 acc-b2/b3）。
 *
 * 契约：
 *  - 时区 = UTC+8：challengeDate = 注入时钟 ISO → UTC+8 日期字符串 YYYY-MM-DD；
 *    UTC 23:30 与该时区 00:30 必须归入不同挑战日（+8h 后跨自然日，机械成立）；
 *  - seed：challengeDate → seedFromDate（确定性哈希 → sfc32，全链路禁 Math.random）；
 *  - 完成判定复用既有 targetLayers 口径（numeric 冻结不动）。
 */
const seed_js_1 = require("./seed.js");
exports.TZ_OFFSET_MINUTES = 480; // UTC+8
/** ISO8601 → UTC+8 日期字符串 YYYY-MM-DD（纯字符串/算术派生，零 Date.now） */
function challengeDateOf(isoNow, offsetMinutes = exports.TZ_OFFSET_MINUTES) {
    const ms = Date.parse(isoNow);
    if (Number.isNaN(ms))
        throw new Error(`invalid iso: ${isoNow}`);
    const shifted = new Date(ms + offsetMinutes * 60_000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
/** 构造当日挑战（同输入同输出，逐 tick 可复现） */
function createDailyChallenge(isoNow) {
    const challengeDate = challengeDateOf(isoNow);
    const seed = (0, seed_js_1.seedFromDate)(challengeDate);
    return { challengeDate, seed, rng: (0, seed_js_1.createSfc32)(challengeDate) };
}
/** 挑战完成判定：达到 targetLayers 即完成（口径复用既有关卡目标，不改 numeric） */
function isChallengeComplete(layers, targetLayers) {
    return layers >= targetLayers;
}

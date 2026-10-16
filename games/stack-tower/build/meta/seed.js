/**
 * meta 确定性 seed（实体 e-meta-seed，spec v1.4 acc-b2/b3）。
 *
 * 红线：
 *  - 全链路禁 Math.random / Date.now：字符串哈希（xmur3）→ sfc32，确定性可复现；
 *  - 与内核 rng.ts（mulberry32）并列：meta 层专用，不改内核随机流；
 *  - 输入 = UTC+8 日期字符串 YYYY-MM-DD（由 daily.ts 的注入时钟派生，本模块不做时间读取）。
 */
/** 字符串 → 32 位确定性哈希（xmur3；同串同值，跨平台一致） */
export function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
}
/** sfc32（Small Fast Counting，4×32 位状态；seedStr 派生四字状态，确定性） */
export function createSfc32(seedStr) {
    let a = hashString(seedStr);
    let b = hashString(`${seedStr}#b`);
    let c = hashString(`${seedStr}#c`);
    let d = hashString(`${seedStr}#d`);
    // 预热 12 轮（sfc32 惯例：初始状态经充分扰动后进入稳定周期）
    for (let i = 0; i < 12; i++) {
        a = (a + b) >>> 0;
        d = (d ^ a) >>> 0;
        b = (b ^ c) >>> 0;
        c = (c + d) >>> 0;
        const t = a;
        a = (c + (c >>> 11)) >>> 0;
        c = (d + ((d << 7) | (d >>> 25))) >>> 0;
        d = (b + ((b << 9) | (b >>> 23))) >>> 0;
        b = (t + b) >>> 0;
    }
    return {
        next() {
            a = (a + b) >>> 0;
            d = (d ^ a) >>> 0;
            b = (b ^ c) >>> 0;
            c = (c + d) >>> 0;
            const t = a;
            a = (c + (c >>> 11)) >>> 0;
            c = (d + ((d << 7) | (d >>> 25))) >>> 0;
            d = (b + ((b << 9) | (b >>> 23))) >>> 0;
            b = (t + b) >>> 0;
            return ((a + b) >>> 0) / 4294967296;
        },
    };
}
/** 挑战 seed：UTC+8 日期字符串 → 32 位整数 seed（逐字节可复现） */
export function seedFromDate(dateStr) {
    return hashString(`stack-tower/daily/${dateStr}`);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSim = createSim;
exports.currentTuning = currentTuning;
/**
 * 确定性仿真内核（实体 e-kernel-sim）— fixed 16ms 步长累加器 + fastForward 无头复现。
 * 红线（world.architecture_rules）：
 *  - 零 DOM / 零 Canvas / 零平台 API；Node 可直接运行；
 *  - 一切随机取自 mulberry32(seed)；禁 Math.random / Date.now / performance.now；
 *  - 事件单向流：本层只上抛，不等待、不轮询表现层。
 */
const numeric_js_1 = require("./numeric.js");
const rng_js_1 = require("./rng.js");
const tower_js_1 = require("./tower.js");
const block_js_1 = require("./block.js");
const cut_js_1 = require("./cut.js");
const ripple_js_1 = require("./ripple.js");
const difficulty_js_1 = require("./difficulty.js");
function createSim(options = {}) {
    const seed = options.seed ?? numeric_js_1.NUMERIC.DEFAULT_SEED;
    let s;
    /** 全量复位（createSim 与 restart 共用同一初始态构造，保证逐字节一致——含开局初始摆位同 seed 同摆位） */
    function reset() {
        const rng = (0, rng_js_1.createRng)(seed);
        const base = (0, tower_js_1.createBaseBlock)();
        const opening = (0, tower_js_1.buildOpeningStack)(rng);
        s = {
            rng,
            tower: [base, ...opening],
            openingCount: opening.length,
            moving: null,
            debris: [],
            score: 0,
            combo: 0,
            level: 1,
            status: 'running',
        };
        s.moving = (0, block_js_1.spawnMoving)(s.rng, s.level, (0, tower_js_1.topOf)(s.tower).x, (0, tower_js_1.topOf)(s.tower).width);
    }
    /** 完美连击加分：+25 + min((combo−1)×5, 75) */
    function perfectBonus(combo) {
        const { PERFECT_BONUS_BASE, PERFECT_COMBO_STEP, PERFECT_COMBO_BONUS_CAP } = numeric_js_1.NUMERIC.scoring;
        return PERFECT_BONUS_BASE + Math.min((combo - 1) * PERFECT_COMBO_STEP, PERFECT_COMBO_BONUS_CAP);
    }
    /** 生成下一摆动块（宽度继承新塔顶；同 tick 内完成） */
    function respawnMoving() {
        const top = (0, tower_js_1.topOf)(s.tower);
        s.moving = (0, block_js_1.spawnMoving)(s.rng, s.level, top.x, top.width);
    }
    /** 处理 drop 意图：在本 tick 起点生效（以当前摆块位置判定，不再推进） */
    function handleDrop(events) {
        if (!s.moving)
            return;
        const top = (0, tower_js_1.topOf)(s.tower);
        const result = (0, cut_js_1.resolveCut)(top, s.moving.x, s.level);
        if (result.outcome === 'perfect') {
            (0, tower_js_1.pushBlock)(s.tower, result.placed);
            s.combo += 1;
            s.score += numeric_js_1.NUMERIC.scoring.PLACE_SCORE + perfectBonus(s.combo);
            events.push({ type: 'block-placed', level_id: (0, difficulty_js_1.levelId)(s.level), perfect: true });
            events.push((0, ripple_js_1.emitTowerRipple)(s.level)); // 同 tick 上抛，先于渲染消费
        }
        else if (result.outcome === 'cut') {
            (0, tower_js_1.pushBlock)(s.tower, result.placed);
            s.combo = 0;
            s.score += numeric_js_1.NUMERIC.scoring.PLACE_SCORE;
            if (result.debris)
                s.debris.push(result.debris);
            events.push({ type: 'block-placed', level_id: (0, difficulty_js_1.levelId)(s.level), perfect: false });
        }
        else {
            // 整块掉落 / 跌破宽度下限：不加分、不升层，本局终了
            if (result.debris)
                s.debris.push(result.debris);
            s.combo = 0;
            s.moving = null;
            s.status = 'game-over';
            events.push({ type: 'game-over', level_id: (0, difficulty_js_1.levelId)(s.level), reason: result.failReason ?? 'width-floor' });
            return;
        }
        // 关卡推进：层数累计达标 → level-clear（塔身不清，速度/窗口随公式走）
        if ((0, difficulty_js_1.isLevelClear)((0, tower_js_1.layerCount)(s.tower, s.openingCount), s.level)) {
            s.moving = null;
            s.status = 'level-clear';
            return;
        }
        respawnMoving();
    }
    function tick(intent) {
        const events = [];
        if (s.status === 'game-over')
            return events; // 冻结：快照不再变化
        if (intent && intent.type === 'drop') {
            if (s.status === 'level-clear') {
                // 过关确认：进入下一关（摆速/窗口按公式更新，塔身延续）
                s.level = (0, difficulty_js_1.nextLevel)(s.level);
                s.status = 'running';
            }
            else {
                handleDrop(events);
            }
        }
        if (s.status === 'running' && s.moving) {
            (0, block_js_1.advanceMoving)(s.moving, (0, tower_js_1.topOf)(s.tower).x, numeric_js_1.NUMERIC.FIXED_STEP_MS);
        }
        return events;
    }
    function snapshot() {
        return {
            tower: s.tower.map((b) => ({ ...b })),
            moving: s.moving ? { ...s.moving } : null,
            debris: s.debris.map((d) => ({ ...d })),
            score: s.score,
            combo: s.combo,
            level: s.level,
            layers: (0, tower_js_1.layerCount)(s.tower, s.openingCount),
            target: (0, numeric_js_1.targetLayers)(s.level),
            status: s.status,
        };
    }
    reset();
    return {
        tick,
        fastForward(n) {
            const events = [];
            for (let i = 0; i < n; i++)
                events.push(...tick());
            return events;
        },
        snapshot,
        /** 全量复位并上抛契约级 restart 事件（spec v3 content.towerRipple.restart，载荷恰 {source}） */
        restart(source) {
            reset();
            return source ? [{ type: 'restart', source }] : [];
        },
    };
}
/** 关卡调参只读出口（表现层/HUD 复用，避免二次实现公式） */
function currentTuning(handle) {
    return (0, difficulty_js_1.levelTuning)(handle.snapshot().level);
}

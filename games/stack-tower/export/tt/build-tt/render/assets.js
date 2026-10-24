"use strict";
/**
 * 资产清单与加载（T3 美术线 assets/ 实体接线层）。
 * 纪律：
 *  - 文件名与 spec lvl-01-stack-tower 元素 id 逐字对应（e01–e08）+ tileset/ui 分类；
 *  - 三态：无加载器（headless/Node 契约测试）→ 空 → 程序化绘制；
 *          加载失败（404/解码失败）→ 该项为 null → 同样回程序化，绝不抛错、不破坏运行；
 *  - 零外部资源：全部相对路径（同源 serve），禁止 http(s) 外链（黑板 assets.md 红线）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_ASSET_MANIFEST = exports.ASSET_MANIFEST = void 0;
exports.emptyAssets = emptyAssets;
exports.loadGameAssets = loadGameAssets;
exports.loadMetaAssets = loadMetaAssets;
/** 资产清单：key = 接线点名，value = 工程内相对路径（文件名含 spec 元素 id） */
exports.ASSET_MANIFEST = {
    /** e01-spawn-first-block：塔基块贴图 */
    blockBase: 'assets/sprites/e01-spawn-first-block.png',
    /** e02-swing-motion：摆动块贴图（下缘反弹光已烘焙） */
    blockMove: 'assets/sprites/e02-swing-motion.png',
    /** e03-drop-input：落点参考虚线（构图脚本 L4 引导层） */
    guide: 'assets/sprites/e03-drop-input.png',
    /** e04-overlap-cut：切面错口碎块 */
    debris: 'assets/sprites/e04-overlap-cut.png',
    /** e05-perfect-window：完美切面脉冲框（风格卡 §1 特殊时刻光） */
    perfectPulse: 'assets/sprites/e05-perfect-window.png',
    /** e06-tower-ripple：塔身涟漪环贴图 */
    rippleRing: 'assets/sprites/e06-tower-ripple.png',
    /** e07-score-hud：HUD 顶部 56px 安全区渐隐衬底（L5，无底板） */
    hudScrim: 'assets/ui/e07-score-hud.png',
    /** e08-fail-recover：重开入口按钮皮肤（HUD DOM） */
    restartButton: 'assets/ui/e08-fail-recover.png',
    /** 塔块三循环 tileset（陶土橙/砖红/沙黄，层序读数） */
    blockTileset: 'assets/tileset/blocks-tower.png',
};
/**
 * meta 四件套清单（B1 上头循环 · spec v1.4 content.retention assets，与核心 9 项清单分立）。
 * 纪律：
 *  - 独立导出、不动 ASSET_MANIFEST（tests/assets-check.mjs 硬断言核心清单 9 项契约）；
 *  - scope_gate = narrow（spec v1.4 落死）：仅接线 daily-challenge-card / streak-badge / icon-badge 三件；
 *    mission-panel 为 missions-deferred 预留件——产出在档（assets/meta/mission-panel.png）不接线，下一轮增补；
 *  - 文件名与 spec id 逐字对应（assets/meta/<id>.png）；零外部资源。
 */
exports.META_ASSET_MANIFEST = {
    /** daily-challenge-card：每日挑战面板卡（360×160，9-slice 四角 24px 安全区） */
    dailyChallengeCard: 'assets/meta/daily-challenge-card.png',
    /** streak-badge：连胜徽章（96×96，透明底） */
    streakBadge: 'assets/meta/streak-badge.png',
    /** icon-badge：奖励角标图标（64×64，透明底） */
    iconBadge: 'assets/meta/icon-badge.png',
};
function emptyAssets() {
    return {};
}
/**
 * 并行加载全部清单项；单项失败静默降级为 null。
 * 无加载器（Node/无头契约测试）直接返回空清单 —— 引用失败不得破坏运行。
 */
async function loadGameAssets(loadImage, log) {
    if (!loadImage)
        return emptyAssets();
    const entries = Object.entries(exports.ASSET_MANIFEST);
    const loaded = await Promise.all(entries.map(async ([key, url]) => {
        try {
            return [key, await loadImage(url)];
        }
        catch {
            return [key, null];
        }
    }));
    const out = {};
    let ok = 0;
    for (const [key, img] of loaded) {
        if (img) {
            out[key] = img;
            ok++;
        }
    }
    log?.(`[assets] 贴图就绪 ${ok}/${entries.length}${ok < entries.length ? '（缺项走程序化 fallback）' : ''}`);
    return out;
}
/**
 * meta 四件套并行装载（三态语义与 loadGameAssets 同源）：
 *  无加载器（headless/Node 契约测试）→ 空清单 → 主题令牌占位；
 *  单项失败（404/解码失败）→ 该项 null → 同样回令牌态，绝不抛错、不破坏运行。
 */
async function loadMetaAssets(loadImage, log) {
    if (!loadImage)
        return {};
    const entries = Object.entries(exports.META_ASSET_MANIFEST);
    const loaded = await Promise.all(entries.map(async ([key, url]) => {
        try {
            return [key, await loadImage(url)];
        }
        catch {
            return [key, null];
        }
    }));
    const out = {};
    let ok = 0;
    for (const [key, img] of loaded) {
        if (img) {
            out[key] = img;
            ok++;
        }
    }
    log?.(`[assets] meta 贴图就绪 ${ok}/${entries.length}${ok < entries.length ? '（缺项走主题令牌 fallback）' : ''}`);
    return out;
}

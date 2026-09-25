/**
 * 确定性仿真内核（实体 e-kernel-sim）— fixed 16ms 步长累加器 + fastForward 无头复现。
 * 红线（world.architecture_rules）：
 *  - 零 DOM / 零 Canvas / 零平台 API；Node 可直接运行；
 *  - 一切随机取自 mulberry32(seed)；禁 Math.random / Date.now / performance.now；
 *  - 事件单向流：本层只上抛，不等待、不轮询表现层。
 */
import { NUMERIC, targetLayers } from './numeric.js';
import { createRng } from './rng.js';
import { createBaseBlock, topOf, pushBlock, layerCount } from './tower.js';
import { spawnMoving, advanceMoving } from './block.js';
import { resolveCut } from './cut.js';
import { emitTowerRipple } from './ripple.js';
import { levelId, nextLevel, isLevelClear, levelTuning } from './difficulty.js';
import type { KernelEvent, PlayerIntent, PlacedBlock, SimHandle, Snapshot } from './types.js';

export interface SimOptions {
  seed?: number;
}

interface SimState {
  rng: ReturnType<typeof createRng>;
  tower: PlacedBlock[];
  moving: Snapshot['moving'];
  debris: Snapshot['debris'];
  score: number;
  combo: number;
  level: number;
  status: Snapshot['status'];
}

export function createSim(options: SimOptions = {}): SimHandle {
  const seed = options.seed ?? NUMERIC.DEFAULT_SEED;
  let s: SimState;

  /** 全量复位（createSim 与 restart 共用同一初始态构造，保证逐字节一致） */
  function reset(): void {
    s = {
      rng: createRng(seed),
      tower: [createBaseBlock()],
      moving: null,
      debris: [],
      score: 0,
      combo: 0,
      level: 1,
      status: 'running',
    };
    s.moving = spawnMoving(s.rng, s.level, topOf(s.tower).x, topOf(s.tower).width);
  }

  /** 完美连击加分：+25 + min((combo−1)×5, 75) */
  function perfectBonus(combo: number): number {
    const { PERFECT_BONUS_BASE, PERFECT_COMBO_STEP, PERFECT_COMBO_BONUS_CAP } = NUMERIC.scoring;
    return PERFECT_BONUS_BASE + Math.min((combo - 1) * PERFECT_COMBO_STEP, PERFECT_COMBO_BONUS_CAP);
  }

  /** 生成下一摆动块（宽度继承新塔顶；同 tick 内完成） */
  function respawnMoving(): void {
    const top = topOf(s.tower);
    s.moving = spawnMoving(s.rng, s.level, top.x, top.width);
  }

  /** 处理 drop 意图：在本 tick 起点生效（以当前摆块位置判定，不再推进） */
  function handleDrop(events: KernelEvent[]): void {
    if (!s.moving) return;
    const top = topOf(s.tower);
    const result = resolveCut(top, s.moving.x, s.level);

    if (result.outcome === 'perfect') {
      pushBlock(s.tower, result.placed!);
      s.combo += 1;
      s.score += NUMERIC.scoring.PLACE_SCORE + perfectBonus(s.combo);
      events.push({ type: 'block-placed', level_id: levelId(s.level), perfect: true });
      events.push(emitTowerRipple(s.level)); // 同 tick 上抛，先于渲染消费
    } else if (result.outcome === 'cut') {
      pushBlock(s.tower, result.placed!);
      s.combo = 0;
      s.score += NUMERIC.scoring.PLACE_SCORE;
      if (result.debris) s.debris.push(result.debris);
      events.push({ type: 'block-placed', level_id: levelId(s.level), perfect: false });
    } else {
      // 整块掉落 / 跌破宽度下限：不加分、不升层，本局终了
      if (result.debris) s.debris.push(result.debris);
      s.combo = 0;
      s.moving = null;
      s.status = 'game-over';
      events.push({ type: 'game-over', level_id: levelId(s.level), reason: result.failReason ?? 'width-floor' });
      return;
    }

    // 关卡推进：层数累计达标 → level-clear（塔身不清，速度/窗口随公式走）
    if (isLevelClear(layerCount(s.tower), s.level)) {
      s.moving = null;
      s.status = 'level-clear';
      return;
    }
    respawnMoving();
  }

  function tick(intent?: PlayerIntent): KernelEvent[] {
    const events: KernelEvent[] = [];
    if (s.status === 'game-over') return events; // 冻结：快照不再变化

    if (intent && intent.type === 'drop') {
      if (s.status === 'level-clear') {
        // 过关确认：进入下一关（摆速/窗口按公式更新，塔身延续）
        s.level = nextLevel(s.level);
        s.status = 'running';
      } else {
        handleDrop(events);
      }
    }

    if (s.status === 'running' && s.moving) {
      advanceMoving(s.moving, topOf(s.tower).x, NUMERIC.FIXED_STEP_MS);
    }
    return events;
  }

  function snapshot(): Snapshot {
    return {
      tower: s.tower.map((b) => ({ ...b })),
      moving: s.moving ? { ...s.moving } : null,
      debris: s.debris.map((d) => ({ ...d })),
      score: s.score,
      combo: s.combo,
      level: s.level,
      layers: layerCount(s.tower),
      target: targetLayers(s.level),
      status: s.status,
    };
  }

  reset();

  return {
    tick,
    fastForward(n: number): KernelEvent[] {
      const events: KernelEvent[] = [];
      for (let i = 0; i < n; i++) events.push(...tick());
      return events;
    },
    snapshot,
    restart(): void {
      reset();
    },
  };
}

/** 关卡调参只读出口（表现层/HUD 复用，避免二次实现公式） */
export function currentTuning(handle: SimHandle): ReturnType<typeof levelTuning> {
  return levelTuning(handle.snapshot().level);
}

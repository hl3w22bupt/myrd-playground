/**
 * ui/hudState —— HUD 纯逻辑层：计算各字段的目标值与「是否变化」，供 DOM 直写层做脏检查。
 *
 * 背景：HUD 每帧无条件写 textContent/style 会在值未变化时也触发样式失效与布局计算
 * （强制布局 / forced reflow），是 60FPS 的稳定开销来源。
 * 本模块与 DOM 解耦（Node 可直接测试）：同一字段值不变 → 不产生任何 DOM 写入。
 */

import type { WorldSnapshot } from '../core/types';
import { ITEMS, WEAPONS } from '../content';
import type { MedkitItemDef } from '../content';

const STATE_LABEL: Record<string, string> = {
  plane: '✈ 运输机上 —— 按 F 跳伞',
  freefall: '🪂 自由落体 —— WASD 控制方向，Shift 俯冲，空格开伞',
  parachute: '🪂 滑翔中 —— WASD 微调落点',
  ground: '',
  dead: '☠ 已淘汰',
};

/** HUD 各字段的一次快照值（脏检查的比对单元） */
export interface HudFrameState {
  hpWidth: string;
  hpColor: string;
  hpText: string;
  armorText: string;
  weaponText: string;
  ammoText: string;
  reloadText: string;
  aliveText: string;
  killsText: string;
  zoneText: string;
  stateText: string;
  vignetteDanger: boolean;
  medkitVisible: boolean;
  medkitFillWidth: string;
}

export function createEmptyHudState(): HudFrameState {
  return {
    hpWidth: '',
    hpColor: '',
    hpText: '',
    armorText: '',
    weaponText: '',
    ammoText: '',
    reloadText: '',
    aliveText: '',
    killsText: '',
    zoneText: '',
    stateText: '',
    vignetteDanger: false,
    medkitVisible: false,
    medkitFillWidth: '',
  };
}

/** 字段级脏标记：true = 该字段需要写 DOM */
export interface HudDirtyFlags {
  hpWidth: boolean;
  hpColor: boolean;
  hpText: boolean;
  armorText: boolean;
  weaponText: boolean;
  ammoText: boolean;
  reloadText: boolean;
  aliveText: boolean;
  killsText: boolean;
  zoneText: boolean;
  stateText: boolean;
  vignetteDanger: boolean;
  medkitVisible: boolean;
  medkitFillWidth: boolean;
}

function createFalseFlags(): HudDirtyFlags {
  return {
    hpWidth: false,
    hpColor: false,
    hpText: false,
    armorText: false,
    weaponText: false,
    ammoText: false,
    reloadText: false,
    aliveText: false,
    killsText: false,
    zoneText: false,
    stateText: false,
    vignetteDanger: false,
    medkitVisible: false,
    medkitFillWidth: false,
  };
}

/**
 * 有状态 HUD 计算器：compute(snap) 得到目标状态 + 与上次写入值的差集（脏标记）。
 * 首次调用全部字段视为脏（保证初始渲染完整）。
 */
export class HudState {
  /** 上一次实际写入 DOM 的值 */
  private readonly written: HudFrameState = createEmptyHudState();
  private readonly flags: HudDirtyFlags = createFalseFlags();
  private firstRun = true;
  /** 复用字符串缓冲，避免每帧为固定字段重建字符串对象 */
  private readonly computed: HudFrameState = createEmptyHudState();

  compute(snap: WorldSnapshot): { state: HudFrameState; dirty: HudDirtyFlags; changed: boolean } {
    const c = this.computed;
    const f = this.flags;
    const p = snap.player;

    if (!p) {
      // 无玩家数据（尚未开始）：不改动任何字段
      return { state: this.written, dirty: this.flags, changed: false };
    }

    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    c.hpWidth = `${(hpRatio * 100).toFixed(1)}%`;
    c.hpColor = hpRatio > 0.55 ? '#59c159' : hpRatio > 0.25 ? '#e0b23a' : '#d8564a';
    c.hpText = `${Math.ceil(p.hp)}`;
    c.armorText =
      `${p.armorReduction > 0 ? '🛡' + Math.round(p.armorReduction * 100) + '%' : ''}` +
      `${p.helmetReduction > 0 ? ' ⛑' + Math.round(p.helmetReduction * 100) + '%' : ''}`;

    const weaponId = p.weapon;
    if (weaponId) {
      const def = WEAPONS[weaponId as keyof typeof WEAPONS];
      c.weaponText = def ? def.name : weaponId;
      c.ammoText = p.reloading ? '--' : `${p.magazine} / ${p.reserve ?? 0}`;
      c.reloadText = p.reloading ? '换弹中…' : '';
    } else {
      c.weaponText = '空手（E 拾取）';
      c.ammoText = '-';
      c.reloadText = '';
    }

    c.aliveText = `${p.aliveCount}`;
    c.killsText = `${p.kills}`;
    const zone = snap.zone;
    c.zoneText =
      zone.mode === 'wait'
        ? `${zone.phase + 1}/${zone.phaseCount} 缩圈 ${Math.ceil(zone.timeLeftMs / 1000)}s`
        : zone.mode === 'shrink'
          ? `${zone.phase + 1}/${zone.phaseCount} 收缩中 ${Math.ceil(zone.timeLeftMs / 1000)}s`
          : '终局';
    c.stateText = STATE_LABEL[p.state] ?? '';
    c.vignetteDanger = hpRatio < 0.35;

    if (p.medkitChannelMsLeft > 0) {
      const total = (ITEMS.medkit_large as MedkitItemDef).useMs;
      c.medkitVisible = true;
      c.medkitFillWidth = `${(100 - (p.medkitChannelMsLeft / total) * 100).toFixed(0)}%`;
    } else {
      c.medkitVisible = false;
      c.medkitFillWidth = '';
    }

    // 差集：只标记真正变化的字段
    let changed = this.firstRun;
    f.hpWidth = this.firstRun || c.hpWidth !== this.written.hpWidth;
    f.hpColor = this.firstRun || c.hpColor !== this.written.hpColor;
    f.hpText = this.firstRun || c.hpText !== this.written.hpText;
    f.armorText = this.firstRun || c.armorText !== this.written.armorText;
    f.weaponText = this.firstRun || c.weaponText !== this.written.weaponText;
    f.ammoText = this.firstRun || c.ammoText !== this.written.ammoText;
    f.reloadText = this.firstRun || c.reloadText !== this.written.reloadText;
    f.aliveText = this.firstRun || c.aliveText !== this.written.aliveText;
    f.killsText = this.firstRun || c.killsText !== this.written.killsText;
    f.zoneText = this.firstRun || c.zoneText !== this.written.zoneText;
    f.stateText = this.firstRun || c.stateText !== this.written.stateText;
    f.vignetteDanger = this.firstRun || c.vignetteDanger !== this.written.vignetteDanger;
    f.medkitVisible = this.firstRun || c.medkitVisible !== this.written.medkitVisible;
    f.medkitFillWidth = this.firstRun || c.medkitFillWidth !== this.written.medkitFillWidth;

    if (!changed) {
      changed =
        f.hpWidth || f.hpColor || f.hpText || f.armorText || f.weaponText || f.ammoText ||
        f.reloadText || f.aliveText || f.killsText || f.zoneText || f.stateText ||
        f.vignetteDanger || f.medkitVisible || f.medkitFillWidth;
    }
    this.firstRun = false;
    return { state: c, dirty: f, changed };
  }

  /** DOM 写入完成后调用：把目标值登记为「已写入」 */
  commit(): void {
    const c = this.computed;
    const w = this.written;
    w.hpWidth = c.hpWidth;
    w.hpColor = c.hpColor;
    w.hpText = c.hpText;
    w.armorText = c.armorText;
    w.weaponText = c.weaponText;
    w.ammoText = c.ammoText;
    w.reloadText = c.reloadText;
    w.aliveText = c.aliveText;
    w.killsText = c.killsText;
    w.zoneText = c.zoneText;
    w.stateText = c.stateText;
    w.vignetteDanger = c.vignetteDanger;
    w.medkitVisible = c.medkitVisible;
    w.medkitFillWidth = c.medkitFillWidth;
  }

  /** 重开对局时强制下一帧全量重绘 */
  invalidate(): void {
    this.firstRun = true;
  }
}

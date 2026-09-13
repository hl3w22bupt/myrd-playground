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
  hpTier: string;
  hpText: string;
  armorText: string;
  weaponText: string;
  ammoText: string;
  reserveText: string;
  ammoLow: boolean;
  reloadText: string;
  aliveText: string;
  killsText: string;
  zoneText: string;
  zoneBadgeMode: string;
  zoneFillWidth: string;
  stateText: string;
  vignetteDanger: boolean;
  medkitVisible: boolean;
  medkitFillWidth: string;
  airdropText: string;
}

export function createEmptyHudState(): HudFrameState {
  return {
    hpWidth: '',
    hpTier: '',
    hpText: '',
    armorText: '',
    weaponText: '',
    ammoText: '',
    reserveText: '',
    ammoLow: false,
    reloadText: '',
    aliveText: '',
    killsText: '',
    zoneText: '',
    zoneBadgeMode: '',
    zoneFillWidth: '',
    stateText: '',
    vignetteDanger: false,
    medkitVisible: false,
    medkitFillWidth: '',
    airdropText: '',
  };
}

/** 字段级脏标记：true = 该字段需要写 DOM */
export interface HudDirtyFlags {
  hpWidth: boolean;
  hpTier: boolean;
  hpText: boolean;
  armorText: boolean;
  weaponText: boolean;
  ammoText: boolean;
  reserveText: boolean;
  ammoLow: boolean;
  reloadText: boolean;
  aliveText: boolean;
  killsText: boolean;
  zoneText: boolean;
  zoneBadgeMode: boolean;
  zoneFillWidth: boolean;
  stateText: boolean;
  vignetteDanger: boolean;
  medkitVisible: boolean;
  medkitFillWidth: boolean;
  airdropText: boolean;
}

function createFalseFlags(): HudDirtyFlags {
  return {
    hpWidth: false,
    hpTier: false,
    hpText: false,
    armorText: false,
    weaponText: false,
    ammoText: false,
    reserveText: false,
    ammoLow: false,
    reloadText: false,
    aliveText: false,
    killsText: false,
    zoneText: false,
    zoneBadgeMode: false,
    zoneFillWidth: false,
    stateText: false,
    vignetteDanger: false,
    medkitVisible: false,
    medkitFillWidth: false,
    airdropText: false,
  };
}

/**
 * 有状态 HUD 计算器：compute(snap) 得到目标状态 + 与上次写入值的差集（脏标记）。
 * 首次调用全部字段视为脏（保证初始渲染完整）。
 */
const NO_DIRTY_FLAGS: HudDirtyFlags = createFalseFlags();
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
      // 无玩家数据（尚未开始）：不改动任何字段，且不返回 this.flags（避免调用方拿到上一帧残留脏标记重复写 DOM）
      return { state: this.written, dirty: NO_DIRTY_FLAGS, changed: false };
    }

    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    c.hpWidth = `${(hpRatio * 100).toFixed(1)}%`;
    c.hpTier = hpRatio > 0.55 ? 'ok' : hpRatio > 0.25 ? 'warn' : 'crit';
    c.hpText = `${Math.ceil(p.hp)}`;
    c.armorText =
      `${p.armorReduction > 0 ? '🛡' + Math.round(p.armorReduction * 100) + '%' : ''}` +
      `${p.helmetReduction > 0 ? ' ⛑' + Math.round(p.helmetReduction * 100) + '%' : ''}`;

    const weaponId = p.weapon;
    if (weaponId) {
      const def = WEAPONS[weaponId as keyof typeof WEAPONS];
      c.weaponText = def ? def.name : weaponId;
      c.ammoText = p.reloading ? '--' : `${p.magazine}`;
      c.reserveText = p.reloading ? '' : `/ ${p.reserve ?? 0}`;
      c.ammoLow = !p.reloading && (p.magazine ?? 0) <= 5;
      c.reloadText = p.reloading ? '换弹中…' : '';
    } else {
      c.weaponText = '空手（E 拾取）';
      c.ammoText = '-';
      c.reserveText = '';
      c.ammoLow = false;
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
    c.zoneBadgeMode = zone.mode;
    // 阶段进度条：wait 递减警示 / shrink 全速 / done 归零
    const zonePct = zone.mode === 'done' ? 0 : Math.max(0, Math.min(1, zone.timeLeftMs / 1000 / 30));
    c.zoneFillWidth = `${(zonePct * 100).toFixed(1)}%`;
    c.stateText = STATE_LABEL[p.state] ?? '';
    c.vignetteDanger = hpRatio < 0.35;

    if (p.medkitChannelMsLeft > 0) {
      // 引导总时长按实际使用的医疗物品取（medkitItem 为空时兜底医疗包）
      const itemDef = p.medkitItem ? (ITEMS[p.medkitItem as keyof typeof ITEMS] as MedkitItemDef | undefined) : undefined;
      const total = itemDef && typeof itemDef.useMs === 'number' ? itemDef.useMs : (ITEMS.medkit_large as MedkitItemDef).useMs;
      c.medkitVisible = true;
      c.medkitFillWidth = `${(100 - (p.medkitChannelMsLeft / total) * 100).toFixed(0)}%`;
    } else {
      c.medkitVisible = false;
      c.medkitFillWidth = '';
    }

    // 空投状态横幅（AC 空投可见性：降落/落地均提示，位置见小地图）
    const falling = snap.airdrops.some((a) => a.phase === 'falling');
    const landed = snap.airdrops.some((a) => a.phase === 'landed');
    c.airdropText = falling ? '🎁 空投正在降落' : landed ? '🎁 空投已落地 · 见小地图标记' : '';

    // 差集：只标记真正变化的字段
    let changed = this.firstRun;
    f.hpWidth = this.firstRun || c.hpWidth !== this.written.hpWidth;
    f.hpTier = this.firstRun || c.hpTier !== this.written.hpTier;
    f.hpText = this.firstRun || c.hpText !== this.written.hpText;
    f.armorText = this.firstRun || c.armorText !== this.written.armorText;
    f.weaponText = this.firstRun || c.weaponText !== this.written.weaponText;
    f.ammoText = this.firstRun || c.ammoText !== this.written.ammoText;
    f.reserveText = this.firstRun || c.reserveText !== this.written.reserveText;
    f.ammoLow = this.firstRun || c.ammoLow !== this.written.ammoLow;
    f.reloadText = this.firstRun || c.reloadText !== this.written.reloadText;
    f.aliveText = this.firstRun || c.aliveText !== this.written.aliveText;
    f.killsText = this.firstRun || c.killsText !== this.written.killsText;
    f.zoneText = this.firstRun || c.zoneText !== this.written.zoneText;
    f.zoneBadgeMode = this.firstRun || c.zoneBadgeMode !== this.written.zoneBadgeMode;
    f.zoneFillWidth = this.firstRun || c.zoneFillWidth !== this.written.zoneFillWidth;
    f.stateText = this.firstRun || c.stateText !== this.written.stateText;
    f.vignetteDanger = this.firstRun || c.vignetteDanger !== this.written.vignetteDanger;
    f.medkitVisible = this.firstRun || c.medkitVisible !== this.written.medkitVisible;
    f.medkitFillWidth = this.firstRun || c.medkitFillWidth !== this.written.medkitFillWidth;
    f.airdropText = this.firstRun || c.airdropText !== this.written.airdropText;

    if (!changed) {
      changed =
        f.hpWidth || f.hpTier || f.hpText || f.armorText || f.weaponText || f.ammoText ||
        f.reserveText || f.ammoLow || f.reloadText || f.aliveText || f.killsText ||
        f.zoneText || f.zoneBadgeMode || f.zoneFillWidth || f.stateText ||
        f.vignetteDanger || f.medkitVisible || f.medkitFillWidth || f.airdropText;
    }
    this.firstRun = false;
    return { state: c, dirty: f, changed };
  }

  /** DOM 写入完成后调用：把目标值登记为「已写入」 */
  commit(): void {
    const c = this.computed;
    const w = this.written;
    w.hpWidth = c.hpWidth;
    w.hpTier = c.hpTier;
    w.hpText = c.hpText;
    w.armorText = c.armorText;
    w.weaponText = c.weaponText;
    w.ammoText = c.ammoText;
    w.reserveText = c.reserveText;
    w.ammoLow = c.ammoLow;
    w.reloadText = c.reloadText;
    w.aliveText = c.aliveText;
    w.killsText = c.killsText;
    w.zoneText = c.zoneText;
    w.zoneBadgeMode = c.zoneBadgeMode;
    w.zoneFillWidth = c.zoneFillWidth;
    w.stateText = c.stateText;
    w.vignetteDanger = c.vignetteDanger;
    w.medkitVisible = c.medkitVisible;
    w.medkitFillWidth = c.medkitFillWidth;
    w.airdropText = c.airdropText;
  }

  /** 重开对局时强制下一帧全量重绘 */
  invalidate(): void {
    this.firstRun = true;
  }
}

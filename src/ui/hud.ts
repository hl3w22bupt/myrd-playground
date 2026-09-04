/**
 * ui/hud —— 高频 HUD 直写 DOM（ADR-005：高频 HUD 不走 React/框架，避免每帧重渲染）。
 * 数据源：core snapshot + events，只读展示，不回写仿真。
 * 美化：血条刻度分段 / 命中标记 × / 开火准星扩散 / 缩圈进度徽章 / 低弹药与低血量警示。
 * 性能：值脏检查（textContent 仅在变化时写入），减少无谓 reflow（60FPS 红线）。
 */

import type { GameEvent, MatchHandle, WorldSnapshot } from '../core/types';
import { ITEMS, WEAPONS } from '../content';
import type { MedkitItemDef } from '../content';

const STATE_LABEL: Record<string, string> = {
  plane: '✈ 运输机上 —— 按 F 跳伞',
  freefall: '🪂 自由落体 —— WASD 控制方向，Shift 俯冲，空格开伞',
  parachute: '🪂 滑翔中 —— WASD 微调落点',
  ground: '',
  dead: '☠ 已淘汰',
};

const HITMARKER_MS = 140;
const CROSSHAIR_KICK_MS = 90;

export class Hud {
  private root: HTMLDivElement;
  private hpBar: HTMLDivElement;
  private hpText: HTMLDivElement;
  private armorTag: HTMLDivElement;
  private ammoText: HTMLDivElement;
  private reserveText: HTMLDivElement;
  private ammoBox: HTMLDivElement;
  private weaponText: HTMLDivElement;
  private reloadTag: HTMLDivElement;
  private aliveText: HTMLDivElement;
  private killsText: HTMLDivElement;
  private zoneText: HTMLDivElement;
  private zoneFill: HTMLDivElement;
  private zoneBadge: HTMLDivElement;
  private stateText: HTMLDivElement;
  private killFeed: HTMLDivElement;
  private medkitBar: HTMLDivElement;
  private debugText: HTMLDivElement;
  private vignette: HTMLDivElement;
  private hitmarker: HTMLDivElement;
  private crosshair: HTMLDivElement;

  // 脏检查缓存（避免每帧 textContent 写入）
  private cache = new Map<HTMLDivElement, string>();
  private hitmarkerUntil = 0;
  private crosshairKickUntil = 0;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="vignette" data-ref="vignette"></div>
      <div class="crosshair" data-ref="crosshair"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="hitmarker" data-ref="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div class="hud-top-left">
        <div class="stat"><span class="stat-label">存活</span><span data-ref="alive">0</span></div>
        <div class="stat stat-accent"><span class="stat-label">淘汰</span><span data-ref="kills">0</span></div>
        <div class="zone-badge" data-ref="zonebadge">
          <span class="zone-icon">◎</span>
          <span class="zone-info"><em data-ref="zone">-</em><i class="zone-track"><i class="zone-fill" data-ref="zonefill"></i></i></span>
        </div>
      </div>
      <div class="hud-state" data-ref="state"></div>
      <div class="killfeed" data-ref="killfeed"></div>
      <div class="hud-bottom-left">
        <div class="hpwrap">
          <div class="hpbar"><div class="hpbar-fill" data-ref="hp"></div><div class="hpbar-ticks"></div></div>
          <div class="hprow"><span class="hpnum" data-ref="hptext">100</span><span class="gear" data-ref="armor"></span></div>
        </div>
        <div class="medkit" data-ref="medkit"><div class="medkit-fill" data-ref="medkitbar"></div></div>
      </div>
      <div class="hud-bottom-right">
        <div class="weapon" data-ref="weapon">空手</div>
        <div class="ammo" data-ref="ammobox"><span data-ref="ammo">-</span><span class="reserve" data-ref="reserve"></span></div>
        <div class="reload" data-ref="reload"></div>
      </div>
      <div class="hud-debug" data-ref="debug"></div>
    `;
    container.appendChild(this.root);
    const ref = <T extends HTMLElement>(name: string): T =>
      this.root.querySelector(`[data-ref="${name}"]`) as T;
    this.vignette = ref('vignette');
    this.crosshair = ref('crosshair');
    this.hitmarker = ref('hitmarker');
    this.hpBar = ref('hp');
    this.hpText = ref('hptext');
    this.armorTag = ref('armor');
    this.ammoText = ref('ammo');
    this.reserveText = ref('reserve');
    this.ammoBox = ref('ammobox');
    this.weaponText = ref('weapon');
    this.reloadTag = ref('reload');
    this.aliveText = ref('alive');
    this.killsText = ref('kills');
    this.zoneText = ref('zone');
    this.zoneFill = ref('zonefill');
    this.zoneBadge = ref('zonebadge');
    this.stateText = ref('state');
    this.killFeed = ref('killfeed');
    this.medkitBar = ref('medkit');
    this.debugText = ref('debug');
  }

  /** 值变化才写 DOM（textContent / width / class） */
  private set(el: HTMLDivElement, value: string): void {
    if (this.cache.get(el) === value) return;
    this.cache.set(el, value);
    el.textContent = value;
  }

  update(snap: WorldSnapshot, nowMs: number): void {
    const p = snap.player;
    if (!p) return;

    // 血量：宽度 + 档位色 + 低血量脉冲
    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    this.hpBar.style.width = `${(hpRatio * 100).toFixed(1)}%`;
    const hpTier = hpRatio > 0.55 ? 'ok' : hpRatio > 0.25 ? 'warn' : 'crit';
    this.root.dataset.hp = hpTier;
    this.set(this.hpText, `${Math.ceil(p.hp)}`);
    const armor =
      `${p.armorReduction > 0 ? '🛡' + Math.round(p.armorReduction * 100) + '%' : ''}` +
      `${p.helmetReduction > 0 ? ' ⛑' + Math.round(p.helmetReduction * 100) + '%' : ''}`;
    this.set(this.armorTag, armor);

    // 武器与弹药（低弹药警示）
    const weaponId = p.weapon;
    if (weaponId) {
      const def = WEAPONS[weaponId as keyof typeof WEAPONS];
      this.set(this.weaponText, def ? def.name : weaponId);
      this.set(this.ammoText, p.reloading ? '--' : `${p.magazine}`);
      this.set(this.reserveText, p.reloading ? '' : `/ ${p.reserve ?? 0}`);
      this.set(this.reloadTag, p.reloading ? '换弹中…' : '');
      this.ammoBox.classList.toggle('low', !p.reloading && (p.magazine ?? 0) <= 5);
    } else {
      this.set(this.weaponText, '空手（E 拾取）');
      this.set(this.ammoText, '-');
      this.set(this.reloadTag, '');
      this.ammoBox.classList.remove('low');
    }

    // 局势
    this.set(this.aliveText, `${p.aliveCount}`);
    this.set(this.killsText, `${p.kills}`);
    const zone = snap.zone;
    const zoneLabel =
      zone.mode === 'wait'
        ? `第 ${zone.phase + 1}/${zone.phaseCount} 阶段 ${Math.ceil(zone.timeLeftMs / 1000)}s`
        : zone.mode === 'shrink'
          ? `收缩中 ${Math.ceil(zone.timeLeftMs / 1000)}s`
          : '终局圈';
    this.set(this.zoneText, zoneLabel);
    this.zoneBadge.dataset.mode = zone.mode;
    // 阶段进度条：wait 递减警示 / shrink 全速
    const pct = zone.mode === 'done' ? 0 : Math.max(0, Math.min(1, zone.timeLeftMs / 1000 / 30));
    this.zoneFill.style.width = `${(pct * 100).toFixed(1)}%`;

    // 状态横幅
    this.set(this.stateText, STATE_LABEL[p.state] ?? '');
    this.vignette.classList.toggle('danger', hpRatio < 0.35);

    // 命中标记 / 开火准星扩散（计时自动消退）
    this.hitmarker.classList.toggle('show', nowMs < this.hitmarkerUntil);
    this.crosshair.classList.toggle('kick', nowMs < this.crosshairKickUntil);

    // 医疗引导
    if (p.medkitChannelMsLeft > 0) {
      this.medkitBar.style.display = 'block';
      const total = (ITEMS.medkit_large as MedkitItemDef).useMs;
      const fill = this.medkitBar.firstElementChild as HTMLElement | null;
      if (fill) fill.style.width = `${(100 - (p.medkitChannelMsLeft / total) * 100).toFixed(0)}%`;
    } else {
      this.medkitBar.style.display = 'none';
    }
  }

  consumeEvents(events: GameEvent[], match: MatchHandle): void {
    for (const ev of events) {
      if (ev.type === 'entityEliminated') {
        const by = ev.byId === 'zone' ? '毒圈' : ev.byId === 'player' ? '你' : ev.byId;
        const row = document.createElement('div');
        row.className = 'killfeed-row';
        row.textContent = `${by} 淘汰了 ${ev.entityId === 'player' ? '你' : ev.entityId}`;
        this.killFeed.prepend(row);
        setTimeout(() => row.remove(), 6000);
        while (this.killFeed.children.length > 6) this.killFeed.lastChild?.remove();
      } else if (ev.type === 'damageDealt' && ev.byId === 'player') {
        // 命中标记：击中即亮 ×（爆头更醒目由 CSS data-part 区分）
        this.hitmarker.dataset.part = ev.bodyPart;
        this.hitmarkerUntil = performance.now() + HITMARKER_MS;
      } else if (ev.type === 'shotFired' && ev.entityId === 'player') {
        this.crosshairKickUntil = performance.now() + CROSSHAIR_KICK_MS;
      } else if (ev.type === 'matchEnded') {
        void match;
      }
    }
  }

  setDebug(text: string): void {
    this.set(this.debugText, text);
  }

  dispose(): void {
    this.root.remove();
  }
}

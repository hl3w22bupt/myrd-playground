/**
 * ui/hud —— 高频 HUD 直写 DOM（ADR-005：高频 HUD 不走 React/框架，避免每帧重渲染）。
 * 数据源：core snapshot + events，只读展示，不回写仿真。
 * 美化：血条刻度分段 / 命中标记 × / 开火准星扩散 / 缩圈进度徽章 / 低弹药与低血量警示。
 * 性能：值脏检查（textContent 仅在变化时写入），减少无谓 reflow（60FPS 红线）。
 */

import type { GameEvent, MatchHandle, WorldSnapshot } from '../core/types';
import { HudState } from './hudState';

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
  private airdropBanner: HTMLDivElement;
  private killFeed: HTMLDivElement;
  private medkitBar: HTMLDivElement;
  private debugText: HTMLDivElement;
  private vignette: HTMLDivElement;
  private hitmarker: HTMLDivElement;
  private crosshair: HTMLDivElement;

  /** 字段级脏检查器（纯逻辑，Node 可测） */
  private readonly hudState = new HudState();
  private lastDebug: string | null = null;
  private hitmarkerUntil = 0;
  private crosshairKickUntil = 0;
  // 计时型视觉（hitmarker/准星后座）按布尔状态翻转时才写 class，避免每帧 DOM 写入
  private hitmarkerShown = false;
  private crosshairKicked = false;

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
      <div class="airdrop-banner" data-ref="airdrop"></div>
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
    this.airdropBanner = ref('airdrop');
    this.killFeed = ref('killfeed');
    this.medkitBar = ref('medkit');
    this.debugText = ref('debug');
  }

  update(snap: WorldSnapshot): void {
    // 纯逻辑计算 + 字段级脏检查：值不变的字段不产生任何 DOM 写入（消除强制布局）
    const { state, dirty } = this.hudState.compute(snap);

    if (dirty.hpWidth) this.hpBar.style.width = state.hpWidth;
    if (dirty.hpTier) this.root.dataset.hp = state.hpTier;
    if (dirty.hpText) this.hpText.textContent = state.hpText;
    if (dirty.armorText) this.armorTag.textContent = state.armorText;
    if (dirty.weaponText) this.weaponText.textContent = state.weaponText;
    if (dirty.ammoText) this.ammoText.textContent = state.ammoText;
    if (dirty.reserveText) this.reserveText.textContent = state.reserveText;
    if (dirty.ammoLow) this.ammoBox.classList.toggle('low', state.ammoLow);
    if (dirty.reloadText) this.reloadTag.textContent = state.reloadText;
    if (dirty.aliveText) this.aliveText.textContent = state.aliveText;
    if (dirty.killsText) this.killsText.textContent = state.killsText;
    if (dirty.zoneText) this.zoneText.textContent = state.zoneText;
    if (dirty.zoneBadgeMode) this.zoneBadge.dataset.mode = state.zoneBadgeMode;
    if (dirty.zoneFillWidth) this.zoneFill.style.width = state.zoneFillWidth;
    if (dirty.stateText) this.stateText.textContent = state.stateText;
    if (dirty.airdropText) {
      this.airdropBanner.textContent = state.airdropText;
      this.airdropBanner.style.display = state.airdropText ? 'block' : 'none';
    }
    if (dirty.vignetteDanger) this.vignette.classList.toggle('danger', state.vignetteDanger);

    if (dirty.medkitVisible) this.medkitBar.style.display = state.medkitVisible ? 'block' : 'none';
    if (state.medkitVisible && dirty.medkitFillWidth) {
      const fill = this.medkitBar.firstElementChild as HTMLElement | null;
      if (fill) fill.style.width = state.medkitFillWidth;
    }

    // 命中标记 / 开火准星扩散（计时自动消退；仅状态翻转时写 class）
    const nowMs = performance.now();
    const hmShow = nowMs < this.hitmarkerUntil;
    if (hmShow !== this.hitmarkerShown) {
      this.hitmarkerShown = hmShow;
      this.hitmarker.classList.toggle('show', hmShow);
    }
    const chKick = nowMs < this.crosshairKickUntil;
    if (chKick !== this.crosshairKicked) {
      this.crosshairKicked = chKick;
      this.crosshair.classList.toggle('kick', chKick);
    }

    this.hudState.commit();
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
    // 文案未变化不写 DOM（调用方按 DEBUG_TEXT_HZ 节流，这里兜底拦截相同字符串）
    if (this.lastDebug === text) return;
    this.lastDebug = text;
    this.debugText.textContent = text;
  }

  dispose(): void {
    this.root.remove();
  }
}

/**
 * ui/hud —— 高频 HUD 直写 DOM（ADR-005：高频 HUD 不走 React/框架，避免每帧重渲染）。
 * 数据源：core snapshot + events，只读展示，不回写仿真。
 */

import type { GameEvent, MatchHandle, WorldSnapshot } from '../core/types';
import { HudState } from './hudState';

export class Hud {
  private root: HTMLDivElement;
  private hpBar: HTMLDivElement;
  private hpText: HTMLDivElement;
  private armorTag: HTMLDivElement;
  private ammoText: HTMLDivElement;
  private weaponText: HTMLDivElement;
  private reloadTag: HTMLDivElement;
  private aliveText: HTMLDivElement;
  private killsText: HTMLDivElement;
  private zoneText: HTMLDivElement;
  private stateText: HTMLDivElement;
  private killFeed: HTMLDivElement;
  private medkitBar: HTMLDivElement;
  private debugText: HTMLDivElement;
  private vignette: HTMLDivElement;
  /** 字段级脏检查器（纯逻辑，Node 可测） */
  private readonly hudState = new HudState();
  private lastDebug: string | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="vignette" data-ref="vignette"></div>
      <div class="crosshair"></div>
      <div class="hud-top-left">
        <div class="stat"><span class="stat-label">存活</span><span data-ref="alive">0</span></div>
        <div class="stat"><span class="stat-label">淘汰</span><span data-ref="kills">0</span></div>
        <div class="stat"><span class="stat-label">缩圈</span><span data-ref="zone">-</span></div>
      </div>
      <div class="hud-state" data-ref="state"></div>
      <div class="killfeed" data-ref="killfeed"></div>
      <div class="hud-bottom-left">
        <div class="hpbar"><div class="hpbar-fill" data-ref="hp"></div></div>
        <div class="hprow"><span data-ref="hptext">100</span><span class="gear" data-ref="armor"></span></div>
        <div class="medkit" data-ref="medkit"><div class="medkit-fill" data-ref="medkitbar"></div></div>
      </div>
      <div class="hud-bottom-right">
        <div class="weapon" data-ref="weapon">空手</div>
        <div class="ammo"><span data-ref="ammo">-</span><span class="reserve" data-ref="reserve"></span></div>
        <div class="reload" data-ref="reload"></div>
      </div>
      <div class="hud-debug" data-ref="debug"></div>
    `;
    container.appendChild(this.root);
    const ref = <T extends HTMLElement>(name: string): T =>
      this.root.querySelector(`[data-ref="${name}"]`) as T;
    this.vignette = ref('vignette');
    this.hpBar = ref('hp');
    this.hpText = ref('hptext');
    this.armorTag = ref('armor');
    this.ammoText = ref('ammo');
    this.weaponText = ref('weapon');
    this.reloadTag = ref('reload');
    this.aliveText = ref('alive');
    this.killsText = ref('kills');
    this.zoneText = ref('zone');
    this.stateText = ref('state');
    this.killFeed = ref('killfeed');
    this.medkitBar = ref('medkit');
    this.debugText = ref('debug');
  }

  update(snap: WorldSnapshot): void {
    // 纯逻辑计算 + 字段级脏检查：值不变的字段不产生任何 DOM 写入（消除强制布局）
    const { state, dirty } = this.hudState.compute(snap);

    if (dirty.hpWidth) this.hpBar.style.width = state.hpWidth;
    if (dirty.hpColor) this.hpBar.style.background = state.hpColor;
    if (dirty.hpText) this.hpText.textContent = state.hpText;
    if (dirty.armorText) this.armorTag.textContent = state.armorText;
    if (dirty.weaponText) this.weaponText.textContent = state.weaponText;
    if (dirty.ammoText) this.ammoText.textContent = state.ammoText;
    if (dirty.reloadText) this.reloadTag.textContent = state.reloadText;
    if (dirty.aliveText) this.aliveText.textContent = state.aliveText;
    if (dirty.killsText) this.killsText.textContent = state.killsText;
    if (dirty.zoneText) this.zoneText.textContent = state.zoneText;
    if (dirty.stateText) this.stateText.textContent = state.stateText;
    if (dirty.vignetteDanger) this.vignette.classList.toggle('danger', state.vignetteDanger);

    if (dirty.medkitVisible) this.medkitBar.style.display = state.medkitVisible ? 'block' : 'none';
    if (state.medkitVisible && dirty.medkitFillWidth) {
      const fill = this.medkitBar.firstElementChild as HTMLElement | null;
      if (fill) fill.style.width = state.medkitFillWidth;
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

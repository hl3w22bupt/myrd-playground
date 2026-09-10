/**
 * ui/hud —— 高频 HUD 直写 DOM（ADR-005：高频 HUD 不走 React/框架，避免每帧重渲染）。
 * 数据源：core snapshot + events，只读展示，不回写仿真。
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
  private pickupHint: HTMLDivElement;
  private zoneWarn: HTMLDivElement;

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
      <div class="pickup-hint" data-ref="pickup"></div>
      <div class="zone-warn" data-ref="zonewarn"></div>
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
    this.pickupHint = ref('pickup');
    this.zoneWarn = ref('zonewarn');
    this.debugText = ref('debug');
  }

  update(snap: WorldSnapshot): void {
    const p = snap.player;
    if (!p) return;

    // 血量
    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    this.hpBar.style.width = `${(hpRatio * 100).toFixed(1)}%`;
    this.hpBar.style.background = hpRatio > 0.55 ? '#59c159' : hpRatio > 0.25 ? '#e0b23a' : '#d8564a';
    this.hpText.textContent = `${Math.ceil(p.hp)}`;
    this.armorTag.textContent =
      `${p.armorReduction > 0 ? '🛡' + Math.round(p.armorReduction * 100) + '%' : ''}` +
      `${p.helmetReduction > 0 ? ' ⛑' + Math.round(p.helmetReduction * 100) + '%' : ''}`;

    // 武器与弹药
    const weaponId = p.weapon;
    if (weaponId) {
      const def = WEAPONS[weaponId as keyof typeof WEAPONS];
      this.weaponText.textContent = def ? def.name : weaponId;
      this.ammoText.textContent = p.reloading ? '--' : `${p.magazine} / ${p.reserve ?? 0}`;
      this.reloadTag.textContent = p.reloading ? '换弹中…' : '';
    } else {
      this.weaponText.textContent = '空手（E 拾取）';
      this.ammoText.textContent = '-';
    }

    // 局势
    this.aliveText.textContent = `${p.aliveCount}`;
    this.killsText.textContent = `${p.kills}`;
    const zone = snap.zone;
    const zoneLabel =
      zone.mode === 'wait'
        ? `${zone.phase + 1}/${zone.phaseCount} 缩圈 ${Math.ceil(zone.timeLeftMs / 1000)}s`
        : zone.mode === 'shrink'
          ? `${zone.phase + 1}/${zone.phaseCount} 收缩中 ${Math.ceil(zone.timeLeftMs / 1000)}s`
          : '终局';
    this.zoneText.textContent = zoneLabel;

    // 状态横幅
    this.stateText.textContent = STATE_LABEL[p.state] ?? '';
    this.vignette.classList.toggle('danger', hpRatio < 0.35);

    // 医疗引导
    if (p.medkitChannelMsLeft > 0) {
      this.medkitBar.style.display = 'block';
      const medDef = p.medkitItem ? ITEMS[p.medkitItem as keyof typeof ITEMS] : null;
      const total =
        medDef && medDef.kind === 'medkit' ? medDef.useMs : (ITEMS.medkit_large as MedkitItemDef).useMs;
      const fill = this.medkitBar.firstElementChild as HTMLElement | null;
      if (fill) fill.style.width = `${(100 - (p.medkitChannelMsLeft / total) * 100).toFixed(0)}%`;
    } else {
      this.medkitBar.style.display = 'none';
    }

    // 拾取提示（AC3）：范围内最近物资 → 「按 E 拾取 xx」
    const near = p.nearbyLoot;
    if (near) {
      const def = ITEMS[near.item as keyof typeof ITEMS];
      this.pickupHint.textContent = `按 E 拾取 ${def?.name ?? near.item}`;
      this.pickupHint.style.display = 'block';
    } else {
      this.pickupHint.style.display = 'none';
    }

    // 毒圈警示（AC5）：处于安全区外 → 提示当前掉血速率
    if (p.outsideZone) {
      this.zoneWarn.textContent = `⚠ 已在安全区外 —— 每秒 ${zone.dps.toFixed(1)} 点伤害，立即进圈！`;
      this.zoneWarn.style.display = 'block';
      this.vignette.classList.add('poison');
    } else {
      this.zoneWarn.style.display = 'none';
      this.vignette.classList.remove('poison');
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
      } else if (ev.type === 'matchEnded') {
        void match;
      }
    }
  }

  setDebug(text: string): void {
    this.debugText.textContent = text;
  }

  dispose(): void {
    this.root.remove();
  }
}

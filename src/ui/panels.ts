/**
 * ui/panels —— 低频界面：开始屏 / 背包（Tab）/ 结算屏（ADR-005 低频层）。
 */

import type { MatchHandle, MatchResult } from '../core/types';
import { ITEMS } from '../content';

export interface StartOptions {
  seed: number;
  quality: 'low' | 'medium' | 'high';
  aiCount: number;
}

export class StartScreen {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, onStart: (opts: StartOptions) => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay start';
    this.root.innerHTML = `
      <div class="panel">
        <h1>和平精英 · Web 版</h1>
        <p class="sub">跳伞 → 拾取 → 射击 → 缩圈 → 唯一存活者 · pubg-web-core 最小可玩闭环</p>
        <div class="form-row">
          <label>种子 <input data-ref="seed" type="number" value="20260831" /></label>
          <label>画质
            <select data-ref="quality">
              <option value="low">流畅</option>
              <option value="medium" selected>均衡</option>
              <option value="high">高清</option>
            </select>
          </label>
          <label>AI 数量 <input data-ref="ai" type="number" min="10" max="19" value="12" /></label>
        </div>
        <button class="primary" data-ref="start">开始对局</button>
        <div class="controls">
          <b>操作</b>：点击画面锁定鼠标 · WASD 移动 · Shift 疾跑/俯冲 · 左键射击 · R 换弹 · 1/2 切枪 ·
          E 拾取 · Q 使用医疗包 · F 跳伞 · 空格 开伞 · Tab 背包 · Esc 释放鼠标
        </div>
      </div>
    `;
    container.appendChild(this.root);
    const ref = <T extends HTMLElement>(name: string): T => this.root.querySelector(`[data-ref="${name}"]`) as T;
    ref('start').addEventListener('click', () => {
      const seed = Number((ref('seed') as HTMLInputElement).value) || 20260831;
      const quality = (ref('quality') as HTMLSelectElement).value as StartOptions['quality'];
      const aiCount = Math.max(10, Math.min(19, Number((ref('ai') as HTMLInputElement).value) || 12));
      this.hide();
      onStart({ seed, quality, aiCount });
    });
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  show(): void {
    this.root.style.display = 'flex';
  }
}

export class InventoryPanel {
  private root: HTMLDivElement;
  private grid: HTMLDivElement;
  private match: MatchHandle | null = null;
  visible = false;
  /** 背包内容签名：内容不变不重建 DOM */
  private lastSignature: number | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'overlay inventory';
    this.root.style.display = 'none';
    this.root.innerHTML = `
      <div class="panel small">
        <h2>背包</h2>
        <div class="inv-grid" data-ref="grid"></div>
        <p class="hint">点击物品丢弃 · Q 使用医疗包 · Tab 关闭</p>
      </div>
    `;
    container.appendChild(this.root);
    this.grid = this.root.querySelector('[data-ref="grid"]') as HTMLDivElement;
  }

  bind(match: MatchHandle): void {
    this.match = match;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? 'flex' : 'none';
    this.lastSignature = null; // 打开时强制重绘一次
    if (this.visible) this.render();
  }

  render(): void {
    if (!this.match) return;
    // 背包内容未变化时不重建 DOM（此前每帧 innerHTML 重建 + 20 个节点重建，是主循环最大强制布局源）
    const snap = this.match.snapshotReusable
      ? this.match.snapshotReusable()
      : this.match.snapshot();
    const p = snap.player;
    if (!p) return;
    const signature = inventorySignature(p.usedGrids, p.inventory);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.grid.innerHTML = '';
    p.inventory.forEach((slot, i) => {
      const cell = document.createElement('div');
      cell.className = 'inv-cell' + (slot ? ' filled' : '');
      if (slot) {
        const def = ITEMS[slot.item as keyof typeof ITEMS];
        cell.innerHTML = `<b>${def?.name ?? slot.item}</b><span>×${slot.count}</span>`;
        cell.title = '点击丢弃';
        cell.addEventListener('click', () => {
          this.onDrop(i);
          this.render();
        });
      }
      this.grid.appendChild(cell);
    });
    const used = p.usedGrids;
    const cap = p.inventory.length;
    const info = document.createElement('div');
    info.className = 'inv-info';
    info.textContent = `容量 ${used}/${cap}`;
    this.grid.appendChild(info);
  }

  private onDrop: (slot: number) => void = () => {};

  onDropAction(fn: (slot: number) => void): void {
    this.onDrop = fn;
  }

  dispose(): void {
    this.root.remove();
  }
}

/**
 * 背包内容签名（格子占用 + 物品与数量的 FNV-1a 数值哈希）：纯函数零分配，供脏检查。
 * 性能：背包面板打开期间 render() 每帧调用一次，此前每次拼接 ~20 段字符串产生垃圾。
 */
export function inventorySignature(
  usedGrids: number,
  inventory: Array<{ item: string; count: number } | null>,
): number {
  let hash = 0x811c9dc5;
  const mixByte = (v: number): void => {
    hash ^= v & 0xff;
    hash = Math.imul(hash, 0x01000193);
  };
  const mixInt = (v: number): void => {
    mixByte(v);
    mixByte(v >> 8);
    mixByte(v >> 16);
    mixByte(v >> 24);
  };
  const mixStr = (s: string): void => {
    for (let i = 0; i < s.length; i++) mixByte(s.charCodeAt(i));
    mixByte(0);
  };
  mixInt(usedGrids);
  for (let i = 0; i < inventory.length; i++) {
    const s = inventory[i];
    if (s) {
      mixByte(1);
      mixStr(s.item);
      mixInt(s.count);
    } else {
      mixByte(0);
    }
  }
  return hash >>> 0;
}

export class ResultScreen {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, onRestart: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay result';
    this.root.style.display = 'none';
    this.root.innerHTML = `
      <div class="panel">
        <h2 data-ref="title">对局结束</h2>
        <div class="result-rows" data-ref="rows"></div>
        <button class="primary" data-ref="again">再来一局</button>
      </div>
    `;
    container.appendChild(this.root);
    const again = this.root.querySelector('[data-ref="again"]') as HTMLButtonElement;
    again.addEventListener('click', () => {
      this.root.style.display = 'none';
      onRestart();
    });
  }

  show(result: MatchResult): void {
    const rows = this.root.querySelector('[data-ref="rows"]') as HTMLDivElement;
    const winner = result.winnerKind === 'player' ? '🏆 你是唯一幸存者！' : `Winner：${result.winnerId ?? '无'}`;
    const minutes = Math.floor(result.elapsedMs / 60_000);
    const seconds = Math.floor((result.elapsedMs % 60_000) / 1000);
    rows.innerHTML = `
      <div class="r-row big">${winner}</div>
      <div class="r-row"><span>排名</span><b>#${result.playerRank ?? '-'}</b></div>
      <div class="r-row"><span>淘汰数</span><b>${result.playerKills}</b></div>
      <div class="r-row"><span>用时</span><b>${minutes}:${String(seconds).padStart(2, '0')}</b></div>
      <div class="r-row"><span>参战人数</span><b>${result.totalEntities}</b></div>
    `;
    (this.root.querySelector('[data-ref="title"]') as HTMLElement).textContent = '对局结算';
    this.root.style.display = 'flex';
  }

  dispose(): void {
    this.root.remove();
  }
}

/**
 * HUD 层（实体 e-hud-dom）— DOM 直写分数/连击/关卡进度/重开入口。
 * 纪律：数值一律取自内核快照，不自行计算；formatHud(snap) 为纯函数（契约 e07 断言点，
 * Node 可直接 import，不得在模块顶层触碰 document）。
 */
import type { Snapshot } from '../kernel/types.js';

export interface HudView {
  score: number;
  combo: number;
  level: number;
  /** 关卡进度：`layers/target` */
  progress: string;
  /** 状态文案：进行中 / 过关 / 结束 */
  status: string;
}

const STATUS_TEXT: Record<Snapshot['status'], string> = {
  ready: '准备',
  running: '进行中',
  'level-clear': '过关 · 点击进入下一关',
  'game-over': '结束 · 点击重开',
};

/** 纯函数：内核快照 → HUD 视图模型（表现与状态一一对应，逐 tick 可断言） */
export function formatHud(snap: Snapshot): HudView {
  return {
    score: snap.score,
    combo: snap.combo,
    level: snap.level,
    progress: `${snap.layers}/${snap.target}`,
    status: STATUS_TEXT[snap.status],
  };
}

export interface HudHandle {
  update(snap: Snapshot): void;
  onRestart(handler: () => void): void;
}

/** 挂载 DOM HUD；root 缺失时退化为无操作（headless 安全） */
export function mountHud(root: HTMLElement | null): HudHandle {
  if (!root) {
    return { update: () => {}, onRestart: () => {} };
  }
  const scoreEl = spawnLine(root, 'score');
  const comboEl = spawnLine(root, 'combo');
  const levelEl = spawnLine(root, 'level');
  const statusEl = spawnLine(root, 'status');
  const restartBtn = document.createElement('button');
  restartBtn.textContent = '重开（R）';
  restartBtn.className = 'st-hud-restart';
  root.appendChild(restartBtn);

  let restartHandler: (() => void) | null = null;
  restartBtn.addEventListener('click', () => restartHandler?.());

  return {
    update(snap: Snapshot) {
      const view = formatHud(snap);
      scoreEl.textContent = `分数 ${view.score}`;
      comboEl.textContent = view.combo > 0 ? `连击 ×${view.combo}` : '连击 —';
      levelEl.textContent = `关卡进度 ${view.progress}`;
      statusEl.textContent = view.status;
    },
    onRestart(handler: () => void) {
      restartHandler = handler;
    },
  };
}

function spawnLine(root: HTMLElement, kind: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `st-hud-line st-hud-${kind}`;
  root.appendChild(el);
  return el;
}

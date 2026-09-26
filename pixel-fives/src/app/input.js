/**
 * 键盘输入（onboarding.text 对应：移动 WASD/方向键 · 射门 空格/J）。
 * 红（赤焰）= WASD + 空格；蓝（霜蓝）= 方向键 + J。
 */
import { TEAMS } from '../core/constants.js';

const KEYMAPS = {
  red: {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', kick: ['Space'],
  },
  blue: {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', kick: ['KeyJ'],
  },
};

export class KeyboardInput {
  constructor() {
    this.down = new Set();
    this.onAnyKey = null; // 首次按键回调（解锁 AudioContext 等用户手势场景）
    this._kd = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code) && this.onAnyKey) this.onAnyKey(e.code);
      this.down.add(e.code);
    };
    this._ku = (e) => this.down.delete(e.code);
    this._blur = () => this.down.clear();
  }

  attach() {
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', this._blur);
  }

  detach() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('blur', this._blur);
  }

  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  /** 读某队意图（轴量 −1/0/1，kick=boolean）。 */
  intent(team) {
    const km = KEYMAPS[team];
    return {
      moveX: (this.isDown(km.right) ? 1 : 0) - (this.isDown(km.left) ? 1 : 0),
      moveY: (this.isDown(km.down) ? 1 : 0) - (this.isDown(km.up) ? 1 : 0),
      kick: this.isDown(...km.kick),
    };
  }
}

/** 无操作意图（bot 对局的人类槽位占位 / 冻结期兜底）。 */
export const NO_INTENT = Object.freeze({ moveX: 0, moveY: 0, kick: false });

/** 队名（HUD 用，常量单源透传）。 */
export const TEAM_NAMES = { red: TEAMS.red.name, blue: TEAMS.blue.name };

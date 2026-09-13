/**
 * input/input —— 键鼠 → PlayerIntent（浏览器专用）。
 * 输入是意图流：本模块不理解玩法规则，只翻译按键。
 */

import type { PlayerIntent } from '../core/types';

export interface InputCallbacks {
  /** Tab / Esc 等系统键 */
  onToggleInventory?: () => void;
}

const KEY_MAP = {
  KeyW: 'w', KeyS: 's', KeyA: 'a', KeyD: 'd',
  ShiftLeft: 'shift', ShiftRight: 'shift',
} as const;

export class InputManager {
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private fireHeld = false;
  private queued: PlayerIntent[] = [];
  private onceActions = new Set<string>();
  private pointerLocked = false;

  private onKeyDown = (ev: KeyboardEvent) => {
    if (ev.code === 'Tab') {
      ev.preventDefault();
      this.callbacks.onToggleInventory?.();
      return;
    }
    if (ev.code === 'Space') ev.preventDefault();
    this.keys.add(KEY_MAP[ev.code as keyof typeof KEY_MAP] ?? ev.code);
    switch (ev.code) {
      case 'KeyR': this.onceActions.add('reload'); break;
      case 'Digit1': this.queued.push({ kind: 'switchWeapon', slot: 0 }); break;
      case 'Digit2': this.queued.push({ kind: 'switchWeapon', slot: 1 }); break;
      case 'KeyE': this.onceActions.add('interact'); break;
      case 'KeyQ': this.onceActions.add('medkit'); break;
      case 'KeyG': this.onceActions.add('drop'); break;
      case 'KeyF': this.onceActions.add('jump'); break;
      case 'Space': this.onceActions.add('chute'); break;
      default: break;
    }
  };

  private onKeyUp = (ev: KeyboardEvent) => {
    this.keys.delete(KEY_MAP[ev.code as keyof typeof KEY_MAP] ?? ev.code);
  };

  private onMouseDown = (ev: MouseEvent) => {
    if (ev.button === 0) {
      if (!this.pointerLocked) return;
      this.fireHeld = true;
    }
  };

  private onMouseUp = (ev: MouseEvent) => {
    if (ev.button === 0) this.fireHeld = false;
  };

  private onMouseMove = (ev: MouseEvent) => {
    if (!this.pointerLocked) return;
    const sens = 0.0021;
    this.yaw -= ev.movementX * sens;
    this.pitch -= ev.movementY * sens;
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.element;
    if (!this.pointerLocked) this.fireHeld = false;
  };

  constructor(private element: HTMLElement, private callbacks: InputCallbacks = {}) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  requestPointerLock(): void {
    this.element.requestPointerLock?.();
  }

  exitPointerLock(): void {
    document.exitPointerLock?.();
  }

  get locked(): boolean {
    return this.pointerLocked;
  }

  /** 每帧收集：返回本帧玩家意图（fire 为按住语义，每帧都发） */
  consume(): PlayerIntent[] {
    const intents: PlayerIntent[] = this.queued;
    this.queued = [];

    let dx = 0;
    let dz = 0;
    if (this.keys.has('w')) dx += 1;
    if (this.keys.has('s')) dx -= 1;
    if (this.keys.has('a')) dz -= 1;
    if (this.keys.has('d')) dz += 1;
    if (dx !== 0 || dz !== 0) {
      // 以镜头朝向为移动系
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      const wx = dx * cos - dz * sin;
      const wz = dx * sin + dz * cos;
      intents.push({ kind: 'move', dirX: wx, dirZ: wz, sprint: this.keys.has('shift') });
    }

    intents.push({ kind: 'aim', yaw: this.yaw, pitch: this.pitch });
    if (this.fireHeld) intents.push({ kind: 'fire' });
    else intents.push({ kind: 'stopFire' });

    if (this.onceActions.delete('reload')) intents.push({ kind: 'reload' });
    if (this.onceActions.delete('interact')) intents.push({ kind: 'interact' });
    // Q 使用医疗包：slot -1 = 仿真侧自动选择第一个可用医疗物品（背包物资管理语义）
    if (this.onceActions.delete('medkit')) intents.push({ kind: 'useItem', slot: -1 });
    // G 丢弃：slot -1 = 丢弃第一个非空背包格（具体丢弃在背包面板中点选）
    if (this.onceActions.delete('drop')) intents.push({ kind: 'drop', slot: -1 });
    if (this.onceActions.delete('jump')) intents.push({ kind: 'jumpFromPlane' });
    if (this.onceActions.delete('chute')) {
      intents.push({ kind: 'deployParachute' });
    }

    // 空中控制：WASD 直接映射为自由落体方向控制
    if (this.keys.has('w') || this.keys.has('s') || this.keys.has('a') || this.keys.has('d')) {
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      const wx = dx * cos - dz * sin;
      const wz = dx * sin + dz * cos;
      const dive = this.keys.has('shift') ? 1 : 0.2;
      intents.push({ kind: 'freefallControl', dirX: wx, dirZ: wz, dive });
    }

    return intents;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }
}

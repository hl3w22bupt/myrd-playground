/**
 * tests/input —— 输入层意图收集回归（Node 环境用最小 DOM 桩驱动 InputManager）。
 * 重点守护：意图缓冲双缓冲轮换（性能小步引入）不得丢失键盘事件预排队的意图
 * （Digit1/Digit2 切枪是唯一 switchWeapon 通道），也不得跨帧累积陈旧意图。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '../src/input/input';
import type { PlayerIntent } from '../src/core/types';

type KeydownLike = { code: string; preventDefault: () => void };

function noop(): void {
  /* 无副作用 */
}

function installDomStubs(): void {
  vi.stubGlobal(
    'window',
    { addEventListener: noop, removeEventListener: noop } as unknown as Window,
  );
  vi.stubGlobal(
    'document',
    {
      addEventListener: noop,
      removeEventListener: noop,
      pointerLockElement: null,
    } as unknown as Document,
  );
}

function makeManager(): InputManager {
  const element = {} as HTMLElement;
  return new InputManager(element);
}

/** 触发私有 onKeyDown（Node 桩环境下无真实 DOM 事件源） */
function pressKey(im: InputManager, code: string): void {
  const handlers = im as unknown as { onKeyDown: (ev: KeydownLike) => void };
  handlers.onKeyDown({ code, preventDefault: noop });
}

function hasSwitch(intents: PlayerIntent[], slot: number): boolean {
  for (let i = 0; i < intents.length; i++) {
    const it = intents[i];
    if (it.kind === 'switchWeapon' && it.slot === slot) return true;
  }
  return false;
}

describe('输入层意图收集（input/input 双缓冲轮换）', () => {
  beforeEach(() => {
    installDomStubs();
  });

  it('键盘事件预排队的切枪意图必须出现在下一次 consume 返回中（不被轮换清空）', () => {
    const im = makeManager();
    pressKey(im, 'Digit1');
    const intents = im.consume();
    expect(hasSwitch(intents, 0)).toBe(true);
    im.dispose();
  });

  it('consume 之后新排队的意图在下一帧返回，且不与上一帧重复累积', () => {
    const im = makeManager();
    pressKey(im, 'Digit1');
    const first = im.consume();
    expect(hasSwitch(first, 0)).toBe(true);

    pressKey(im, 'Digit2');
    const second = im.consume();
    expect(hasSwitch(second, 1)).toBe(true);
    // 上一帧已消费的 Digit1 不得跨帧重复出现
    expect(hasSwitch(second, 0)).toBe(false);

    const third = im.consume();
    expect(hasSwitch(third, 1)).toBe(false);
    expect(hasSwitch(third, 0)).toBe(false);
    im.dispose();
  });
});

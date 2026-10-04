#!/usr/bin/env node
/**
 * 契约测试 m21/acc-m2 — 触控归一（自动化面；真机项挂日期）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-m2-touch-input.spec.mjs
 * 断言：pointerdown 单一入口（触摸归一，300ms 去抖）；移动守卫注册 contextmenu/gesturestart/
 *       gesturechange/dblclick preventDefault；CSS 面 touch-action: manipulation（ui/style.ts 真源）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GAME_DIR = resolve(import.meta.dirname, '..', '..');

/** 收集式假 doc：记录 addEventListener(type) */
function spyDoc() {
  const registered = new Map();
  return {
    registered,
    addEventListener(type, handler) {
      if (!registered.has(type)) registered.set(type, []);
      registered.get(type).push(handler);
    },
    async emit(type) {
      let prevented = false;
      for (const h of registered.get(type) ?? []) h({ preventDefault: () => (prevented = true) });
      return prevented;
    },
  };
}

runContract({
  id: 'acc-m2',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-touch-input-layer',
  needs: ['build/platform/input.js', 'build/ui/style.js'],
  checks: [
    {
      name: 'pointerdown 单一入口 + 300ms 去抖（连点不做连落）',
      fn: async ({ 'build/platform/input.js': input }) => {
        const events = [];
        const fakeTarget = {
          addEventListener() {},
          onIntent: undefined,
        };
        // createDomInput 语义经既有 e03 契约覆盖；此处断言入口类型为 pointerdown（源契约）
        const src = readFileSync(join(GAME_DIR, 'src', 'platform', 'input.ts'), 'utf8');
        assert(src.includes("addEventListener('pointerdown'"), '落块意图单一入口 = pointerdown');
        assert(src.includes('INTENT_DEBOUNCE_MS = 300'), '去抖 300ms（与既有口径一致）');
        assert(typeof input.installMobileInputGuards === 'function', '导出 installMobileInputGuards');
        void fakeTarget;
        void events;
      },
    },
    {
      name: '移动守卫：contextmenu/gesturestart/gesturechange/dblclick 全部 preventDefault',
      fn: async ({ 'build/platform/input.js': input }) => {
        const doc = spyDoc();
        input.installMobileInputGuards(doc);
        for (const type of ['contextmenu', 'gesturestart', 'gesturechange', 'dblclick']) {
          assert(doc.registered.has(type), `守卫未注册: ${type}`);
          const prevented = await doc.emit(type);
          assert(prevented, `${type} 未被 preventDefault`);
        }
      },
    },
    {
      name: 'CSS 面：touch-action: manipulation + 禁长按选择/系统手势（style 真源）',
      fn: async ({ 'build/ui/style.js': style }) => {
        const css = style.STAGE_STYLE;
        assert(css.includes('touch-action:manipulation') || css.includes('touch-action: manipulation'), 'touch-action: manipulation');
        assert(css.includes('user-select:none') && css.includes('-webkit-touch-callout:none'), '禁长按选择');
        assert(css.includes('overscroll-behavior:none'), '禁橡皮筋滚动');
      },
    },
    {
      name: '浏览器装配接线：main 入口挂载守卫 + viewport-fit=cover',
      fn: async () => {
        const browserJs = readFileSync(join(GAME_DIR, 'build', 'platform', 'browser.js'), 'utf8');
        assert(browserJs.includes('installMobileInputGuards'), '浏览器装配调用移动守卫');
        const html = readFileSync(join(GAME_DIR, 'index.html'), 'utf8');
        assert(html.includes('viewport-fit=cover'), 'viewport-fit=cover（安全区环境生效前提）');
        assert(html.includes('user-scalable=no'), '禁页面捏合缩放');
      },
    },
  ],
});

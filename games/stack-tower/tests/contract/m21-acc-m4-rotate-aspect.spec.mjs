#!/usr/bin/env node
/**
 * 契约测试 m21/acc-m4 — 遮罩判定基于视口宽高比（QA 修正④）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-m4-rotate-aspect.spec.mjs
 * 断言：isLandscapeViewport(w,h) ⇔ w/h > ROTATE_ASPECT_RATIO(=1)；
 *       横屏(720×480)激活 / 竖屏(480×720)不激活 / 正方形(500×500)不激活 / 极端宽屏激活。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { isLandscapeViewport, createRotateOverlay } from '../../build/ui/rotate-overlay.js';

runContract({
  id: 'acc-m4',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-rotate-overlay',
  needs: ['build/ui/rotate-overlay.js'],
  checks: [
    {
      name: '宽高比判定：横屏激活 / 竖屏不激活 / 正方形不激活',
      fn: async ({ 'build/ui/rotate-overlay.js': _m }) => {
        assertEq(isLandscapeViewport(720, 480), true, '横屏(720×480) → 激活');
        assertEq(isLandscapeViewport(480, 720), false, '竖屏(480×720) → 不激活');
        assertEq(isLandscapeViewport(500, 500), false, '正方形 → 不激活');
        assertEq(isLandscapeViewport(812, 375), true, '全面屏横(812×375) → 激活');
        assertEq(isLandscapeViewport(375, 812), false, '全面屏竖(375×812) → 不激活');
        assertEq(isLandscapeViewport(0, 0), false, '非法尺寸 → 不激活（防御）');
      },
    },
    {
      name: '阈值取自 numeric.mobile.ROTATE_ASPECT_RATIO（=1，可注入比较）',
      fn: async () => {
        assertEq(isLandscapeViewport(501, 500, 1), true, 'w/h=1.002 > 1 → 激活');
        assertEq(isLandscapeViewport(500, 500, 1), false, 'w/h=1.0 不大于 1 → 不激活');
        assertEq(isLandscapeViewport(600, 500, 1.5), false, '阈值 1.5 时 w/h=1.2 → 不激活');
      },
    },
    {
      name: '遮罩状态机：setViewport 驱动激活/解除，onChange 同步（无 DOM 可跑）',
      fn: async () => {
        const overlay = createRotateOverlay(1);
        const events = [];
        overlay.onChange((a) => events.push(a));
        assertEq(overlay.setViewport(480, 720), false, '竖屏不激活');
        assertEq(overlay.setViewport(720, 480), true, '转横屏激活');
        assertEq(overlay.isActive(), true, 'isActive');
        assertEq(overlay.setViewport(480, 720), false, '回竖屏解除');
        assertEq(JSON.stringify(events), JSON.stringify([true, false]), 'onChange 序列恰两次');
        overlay.dispose();
      },
    },
  ],
});

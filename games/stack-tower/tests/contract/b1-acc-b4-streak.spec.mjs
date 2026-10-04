#!/usr/bin/env node
/**
 * 契约测试 acc-b4 — 连胜展示（spec v1.4）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b4-streak.spec.mjs
 * 断言：
 *  ① level-clear → 连胜 +1（best 同步）；game-over → 清零；restart 不清零（跨局累计）；
 *  ② 徽章视图：零连胜 visible=false（零占位）；徽章 DOM 注入式 update 生效；
 *  ③ 持久：applyMatchResult 后 persist 写盘可见。
 */
import { runContract, assert, assertEq, loadBuildModule } from './_runner.mjs';

const STREAK = 'build/meta/streak.js';
const SAVE = 'build/meta/save.js';
const BADGE = 'build/ui/meta-badge.js';

runContract({
  id: 'acc-b4',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-meta-streak',
  needs: [STREAK, SAVE, BADGE],
  checks: [
    {
      name: '计分口径：clear +1 / game-over 清零 / 重开不清零',
      fn: async () => {
        const streak = (await loadBuildModule(STREAK)).mod;
        const save = (await loadBuildModule(SAVE)).mod;
        const s = save.emptyMetaSave('2026-09-29T01:00:00.000Z');
        streak.applyMatchResult(s, 'level-clear');
        streak.applyMatchResult(s, 'level-clear');
        assertEq(s.streak.current, 2, '两胜连胜 2');
        assertEq(s.streak.best, 2, 'best 同步');
        streak.applyMatchResult(s, 'level-clear'); // 模拟重开后再胜：restart 不清零
        assertEq(s.streak.current, 3, '重开不清零（跨局累计）');
        streak.applyMatchResult(s, 'game-over');
        assertEq(s.streak.current, 0, 'game-over 清零');
        assertEq(s.streak.best, 3, 'best 保留');
      },
    },
    {
      name: '徽章视图：零连胜不渲染；有连胜 visible + count',
      fn: async () => {
        const streak = (await loadBuildModule(STREAK)).mod;
        const save = (await loadBuildModule(SAVE)).mod;
        const s = save.emptyMetaSave('2026-09-29T01:00:00.000Z');
        const zero = streak.streakBadgeView(s);
        assert(!zero.visible, '零连胜 visible=false');
        streak.applyMatchResult(s, 'level-clear');
        const one = streak.streakBadgeView(s);
        assert(one.visible && one.count === 1, '连胜 1 → visible + count=1');
      },
    },
    {
      name: '徽章 DOM 注入式：update 驱动 display/text；零连胜零占位',
      fn: async () => {
        const badge = (await loadBuildModule(BADGE)).mod;
        const streak = (await loadBuildModule(STREAK)).mod;
        const save = (await loadBuildModule(SAVE)).mod;
        const s = save.emptyMetaSave('2026-09-29T01:00:00.000Z');
        const mounted = [];
        const doc = { createElement: () => ({ style: {}, textContent: '', className: '' }) };
        const handle = badge.createStreakBadge(doc, { appendChild: (n) => mounted.push(n) });
        assertEq(mounted.length, 1, 'mount 一次');
        assertEq(handle.update(s).visible, false, '初始隐藏');
        assertEq(handle.el.style.display, 'none', 'display:none 零占位');
        streak.applyMatchResult(s, 'level-clear');
        const r = handle.update(s);
        assertEq(`${r.visible}:${r.count}`, 'true:1', 'update 返回视图');
        assertEq(handle.el.style.display, 'block', '显示');
        assertEq(handle.el.textContent, '×1', '计数文案');
      },
    },
    {
      name: '持久：结果写入存档后 saveMetaSave 落盘可见',
      fn: async () => {
        const streak = (await loadBuildModule(STREAK)).mod;
        const save = (await loadBuildModule(SAVE)).mod;
        const store = new Map();
        const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
        const s = save.loadMetaSave(storage, '2026-09-29T01:00:00.000Z');
        streak.applyMatchResult(s, 'level-clear');
        save.saveMetaSave(storage, s, '2026-09-29T01:05:00.000Z');
        const again = save.loadMetaSave(storage, '2026-09-29T02:00:00.000Z');
        assertEq(again.streak.current, 1, '连胜持久化');
      },
    },
  ],
});

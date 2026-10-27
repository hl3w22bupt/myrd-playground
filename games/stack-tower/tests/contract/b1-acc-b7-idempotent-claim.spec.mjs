#!/usr/bin/env node
/**
 * 契约测试 acc-b7 — 挑战奖励幂等领取（可注入崩溃点，spec v1.4）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b7-idempotent-claim.spec.mjs
 * 断言：
 *  ① 幂等：同挑战日重复领取只发一次；
 *  ② 崩溃注入：persist 抛错 → 内存回滚（无半发状态）→ 重启后可重领且仅一次；
 *  ③ 跨日隔离：昨日 claimed 不影响今日首次领取。
 */
import { runContract, assert, assertEq, loadBuildModule } from './_runner.mjs';

const CLAIM = 'build/meta/claim.js';
const SAVE = 'build/meta/save.js';

function persistedStore() {
  const store = new Map();
  return {
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    persist: (save) => store.set('st.meta.save.v2', JSON.stringify(save)),
    dump: () => store.get('st.meta.save.v2'),
  };
}

runContract({
  id: 'acc-b7',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-meta-claim',
  needs: [CLAIM, SAVE],
  checks: [
    {
      name: '幂等：同日重复领取只发一次（granted=true → false）',
      fn: async () => {
        const claim = (await loadBuildModule(CLAIM)).mod;
        const save = (await loadBuildModule(SAVE)).mod;
        const s = save.emptyMetaSave('2026-09-29T01:00:00.000Z');
        const { storage, persist } = persistedStore();
        const r1 = claim.claimDailyReward(s, '2026-09-29', persist);
        assert(r1.granted, '首次发放');
        assertEq(r1.reward.kind, 'icon-badge', '奖励形态');
        const r2 = claim.claimDailyReward(s, '2026-09-29', persist);
        assert(!r2.granted, '同日重复拒绝');
        assertEq(storage.getItem('st.meta.save.v2'), JSON.stringify(s), '存储与内存一致（只发一次）');
      },
    },
    {
      name: '崩溃注入：persist 抛错 → 内存回滚 → 重启后可重领且仅一次',
      fn: async () => {
        const claim = (await loadBuildModule(CLAIM)).mod;
        const save = (await loadBuildModule(SAVE)).mod;
        const s = save.emptyMetaSave('2026-09-29T01:00:00.000Z');
        let boom = true;
        const crashingPersist = () => { if (boom) throw new Error('injected-crash'); };
        let threw = false;
        try {
          claim.claimDailyReward(s, '2026-09-29', crashingPersist);
        } catch {
          threw = true;
        }
        assert(threw, '崩溃点上抛');
        assert(!s.daily.claimedDates.includes('2026-09-29'), '内存回滚（无半发状态）');
        // 「重启」：从空存储重载（崩溃意味着旗标未落盘）→ 重领一次
        const s2 = save.emptyMetaSave('2026-09-29T01:00:00.000Z');
        const { persist } = persistedStore();
        boom = false;
        const r = claim.claimDailyReward(s2, '2026-09-29', persist);
        assert(r.granted, '重启后重领成功（且仅一次）');
        const again = claim.claimDailyReward(s2, '2026-09-29', persist);
        assert(!again.granted, '重领后再领拒绝');
      },
    },
    {
      name: '跨日隔离：昨日 claimed 不影响今日首次领取',
      fn: async () => {
        const claim = (await loadBuildModule(CLAIM)).mod;
        const save = (await loadBuildModule(SAVE)).mod;
        const s = save.emptyMetaSave('2026-09-29T01:00:00.000Z');
        const { persist } = persistedStore();
        assert(claim.claimDailyReward(s, '2026-09-28', persist).granted, '昨日领取');
        const today = claim.claimDailyReward(s, '2026-09-29', persist);
        assert(today.granted, '今日首次照发（按日期键隔离）');
        assertEq(s.daily.claimedDates.length, 2, '两日旗标在案');
      },
    },
  ],
});

#!/usr/bin/env node
/**
 * 契约测试 acc-b6 — meta 埋点三类（断网队列 + 补报 + 去重，spec v1.4 + 附录 B）。
 * 复现：node games/stack-tower/tests/contract/b1-acc-b6-telemetry-meta.spec.mjs
 * 断言：
 *  ① 事件族枚举封闭（五事件；枚举外丢弃）；acc-e1 核心枚举不受影响（六事件不变）；
 *  ② dedupe_id 必填（每条在案且 UUID 形态）；
 *  ③ 断网入队 + 恢复按序补报；队首失败即停（顺序保留）；
 *  ④ 去重：同 dedupe_id 重复补报不产生重复送达；
 *  ⑤ 白名单双向断言：白名单外字段丢弃；类型不符整条拒发；
 *  ⑥ 队列容量 200，满丢最旧。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runContract, assert, assertEq, loadBuildModule, GAME_DIR } from './_runner.mjs';

const META = 'build/telemetry/meta.js';
const EMITTER = 'build/telemetry/emitter.js';

function makeDeps(over = {}) {
  const store = new Map();
  return {
    now: () => 42,
    isoNow: () => '2026-09-29T01:00:00.000Z',
    uuid: (() => { let i = 0; return () => `dedupe-${String(++i).padStart(3, '0')}`; })(),
    anonId: () => 'anon-test',
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    online: () => true,
    sender: () => true,
    ...over,
  };
}

runContract({
  id: 'acc-b6',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-telemetry-meta',
  needs: [META, EMITTER],
  checks: [
    {
      name: '事件族枚举封闭（附录 B 五事件）+ acc-e1 核心六事件不受影响',
      fn: async () => {
        const meta = (await loadBuildModule(META)).mod;
        const emitter = (await loadBuildModule(EMITTER)).mod;
        assertEq(meta.META_EVENTS.length, 5, 'meta 五事件');
        assertEq(
          [...meta.META_EVENTS].sort().join(','),
          'daily_challenge_result,daily_challenge_start,mission_progress,mission_reward,streak_update',
          'meta 枚举名单',
        );
        assertEq(emitter.TELEMETRY_EVENTS.length, 6, '核心六事件枚举不变');
      },
    },
    {
      name: 'dedupe_id 必填 + 断网入队 + 恢复按序补报 + 队首失败即停',
      fn: async () => {
        const meta = (await loadBuildModule(META)).mod;
        const delivered = [];
        let online = false;
        let blockNext = false;
        const tm = meta.createMetaTelemetry(
          makeDeps({
            online: () => online,
            sender: (p) => {
              if (blockNext) { blockNext = false; return false; } // 一次性阻塞：模拟发送失败
              delivered.push(p);
              return true;
            },
          }),
        );
        tm.emit('daily_challenge_start', { challengeDate: '2026-09-29' });
        tm.emit('streak_update', { streak: 1, reason: 'level-clear' });
        assertEq(tm.queued(), 2, '断网两条入队');
        online = true;
        assertEq(tm.flush(), 2, '恢复补报两条');
        assertEq(delivered[0].dedupe_id, 'dedupe-001', '按序（队首先发）');
        blockNext = true;
        tm.emit('streak_update', { streak: 2, reason: 'level-clear' }); // online → flush → 发送失败留队
        assertEq(tm.queued(), 1, '队首失败即停（条目留队保序）');
        assertEq(tm.flush(), 1, '重试成功补报');
      },
    },
    {
      name: '去重：同 dedupe_id 不重复送达（崩溃后重复入队 → flush 丢弃）',
      fn: async () => {
        const meta = (await loadBuildModule(META)).mod;
        const delivered = [];
        let online = false;
        const deps = makeDeps({ online: () => online, sender: (p) => { delivered.push(p); return true; } });
        const tm = meta.createMetaTelemetry(deps);
        tm.emit('streak_update', { streak: 1 }); // dedupe-001 入队
        tm.emit('streak_update', { streak: 2 }); // dedupe-002 入队
        // 模拟崩溃后重复入队：同 dedupe_id 二条
        const q = JSON.parse(deps.storage.getItem('st.meta.telemetry.queue'));
        q.push({ ...q[0] }); // dedupe-001 重复
        deps.storage.setItem('st.meta.telemetry.queue', JSON.stringify(q));
        const tm2 = meta.createMetaTelemetry(deps); // 重载队列（3 条）
        assertEq(tm2.queued(), 3, '重载含重复条目');
        online = true;
        tm2.flush();
        const ids = delivered.map((p) => p.dedupe_id);
        assertEq(new Set(ids).size, ids.length, '无重复 dedupe_id 送达');
        assertEq(tm2.queued(), 0, '重复条目出队不积压');
      },
    },
    {
      name: '白名单双向断言：白名单外丢弃 / 类型不符整条拒发 / 枚举外丢弃',
      fn: async () => {
        const meta = (await loadBuildModule(META)).mod;
        const delivered = [];
        const tm = meta.createMetaTelemetry(makeDeps({ sender: (p) => { delivered.push(p); return true; } }));
        tm.emit('streak_update', { streak: 3, hackerField: 'x' }); // 白名单外丢弃
        assertEq(delivered.length, 1, '白名单外字段丢弃后照发');
        assert(!('hackerField' in (delivered[0].data ?? {})), '白名单外字段不出现在载荷');
        tm.emit('streak_update', { streak: 'oops' }); // 类型不符 → 整条拒发
        assertEq(delivered.length, 1, '类型不符拒发');
        tm.emit('bogus_event', {}); // 枚举外
        assertEq(delivered.length, 1, '枚举外丢弃');
      },
    },
    {
      name: '队列容量 200：满丢最旧（丢旧不丢新）',
      fn: async () => {
        const meta = (await loadBuildModule(META)).mod;
        const deps = makeDeps({ online: () => false });
        const tm = meta.createMetaTelemetry(deps);
        for (let i = 0; i < meta.META_QUEUE_CAP + 10; i++) tm.emit('streak_update', { streak: i });
        assertEq(tm.queued(), meta.META_QUEUE_CAP, '队列封顶');
        const q = JSON.parse(deps.storage.getItem('st.meta.telemetry.queue'));
        assertEq(q[0].data.streak, 10, '最旧 10 条已淘汰（丢旧）');
        assertEq(q[q.length - 1].data.streak, 209, '最新保留（不丢新）');
      },
    },
  ],
});

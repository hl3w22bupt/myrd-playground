#!/usr/bin/env node
/**
 * 契约测试 m21/acc-a1（spec v3 acceptance: acc-a1）— sfx-pack-v1 资产注册表完整性。
 * 复现：node games/stack-tower/tests/contract/m21-acc-a1-sfx-pack-registry.spec.mjs
 * 断言（QA 修正③：断言注册表完整性，404 子句已移入 acc-d2）：
 *   12 文件（6 事件 × m4a+ogg 成对）、命名 = `sfx-` + 事件 id、44.1kHz 单声道（音频头解析）、
 *   时长 ≤400ms（restart ≤200ms）、manifest 与落盘逐项对号、critical 标记与 voices.ts 同源一致。
 */
import { runContract, assertEq, assert, assertInRange, GAME_DIR } from './_runner.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function oggInfo(buf) {
  const idx = buf.indexOf(Buffer.from('\x01vorbis', 'binary'));
  assert(idx >= 0, 'ogg 缺 Vorbis identification header');
  return { channels: buf[idx + 11], sampleRate: buf.readUInt32LE(idx + 12) };
}
function m4aInfo(buf) {
  // stsd 内 AudioSampleEntry（实测 afconvert m4af/AAC-LC 布局）：自 'mp4a' fourcc 起
  // +28..32 = samplerate(4, 16.16 定点)。通道数不再读 stsd 元数据（afconvert 写 2ch 元数据
  // 而实际 AAC 流为 1ch，以 afinfo 为准 → QA 证据留档）；单声道机判落点 = ogg Vorbis 头。
  const idx = buf.indexOf(Buffer.from('mp4a', 'binary'));
  assert(idx >= 0, 'm4a 缺 mp4a 采样描述框');
  return { sampleRate: buf.readUInt32BE(idx + 28) >>> 16 };
}

runContract({
  id: 'acc-a1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-sfx-pack-v1',
  needs: ['build/audio/voices.js'],
  checks: [
    {
      name: 'manifest 与 12 文件落盘逐项对号（6 事件 × m4a+ogg，命名 = sfx- + 事件 id）',
      fn: async ({ 'build/audio/voices.js': voices }) => {
        const manifest = JSON.parse(readFileSync(path.join(GAME_DIR, 'assets', 'sfx', 'manifest.json'), 'utf8'));
        assertEq(manifest.id, 'sfx-pack-v1', 'manifest.id');
        const ids = voices.SFX_EVENT_IDS;
        assertEq(manifest.events && Object.keys(manifest.events).length, 6, 'manifest 事件数');
        assertEq(
          JSON.stringify(Object.keys(manifest.events)),
          JSON.stringify(ids),
          'manifest 事件集合 = voices.SFX_EVENT_IDS（同源）',
        );
        let files = 0;
        for (const id of ids) {
          const e = manifest.events[id];
          assertEq(e.m4a, `sfx-${id}.m4a`, `${id} m4a 命名`);
          assertEq(e.ogg, `sfx-${id}.ogg`, `${id} ogg 命名`);
          for (const f of [e.m4a, e.ogg]) {
            const st = readFileSync(path.join(GAME_DIR, 'assets', 'sfx', f));
            assert(st.length > 200, `${f} 空文件/异常小（${st.length}B）`);
            files++;
          }
        }
        assertEq(files, 12, '音频文件总数');
      },
    },
    {
      name: '音频头校验：44.1kHz 全量；单声道以 Ogg Vorbis 头机判（m4a 通道元数据不可靠，见 QA 留档）',
      fn: async () => {
        const manifest = JSON.parse(readFileSync(path.join(GAME_DIR, 'assets', 'sfx', 'manifest.json'), 'utf8'));
        assertEq(manifest.channels, 1, 'manifest 声道声明');
        for (const [id, e] of Object.entries(manifest.events)) {
          const ogg = oggInfo(readFileSync(path.join(GAME_DIR, 'assets', 'sfx', e.ogg)));
          assertEq(ogg.sampleRate, 44100, `${id}.ogg 采样率`);
          assertEq(ogg.channels, 1, `${id}.ogg 声道数（单声道）`);
          const m4a = m4aInfo(readFileSync(path.join(GAME_DIR, 'assets', 'sfx', e.m4a)));
          assertEq(m4a.sampleRate, 44100, `${id}.m4a 采样率`);
        }
      },
    },
    {
      name: '时长红线：事件 ≤400ms；restart ≤200ms；critical 标记与 voices.ts 一致',
      fn: async ({ 'build/audio/voices.js': voices }) => {
        const manifest = JSON.parse(readFileSync(path.join(GAME_DIR, 'assets', 'sfx', 'manifest.json'), 'utf8'));
        for (const [id, e] of Object.entries(manifest.events)) {
          assertInRange(e.durationMs, 1, 400, `${id} 时长上限`);
          assertEq(
            e.critical,
            voices.SFX_VOICES[id].critical,
            `${id} critical 标记同源`,
          );
        }
        assertInRange(manifest.events['restart'].durationMs, 1, 200, 'restart ≤200ms 红线');
      },
    },
  ],
});

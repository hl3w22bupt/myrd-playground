/**
 * 线上冒烟（AppHost 部署自测）：公网入口真实浏览器可玩性验证（playwright 无头）。
 * 用法：node games/stack-tower/tests/live-smoke.mjs <https://.../apps/<slug>/gw>
 */
import { loadPlaywright } from './contract/_browser.mjs';

const BASE = process.argv[2];
if (!BASE) { console.error('usage: node st-live-smoke.mjs <gw-url>'); process.exit(1); }

const pw = await loadPlaywright();
if (!pw) { console.error('FAIL playwright 不可用'); process.exit(1); }
const browser = await pw.chromium.launch({ headless: true });
const errors = [];
let failed = false;
const fail = (m) => { failed = true; console.log(`  FAIL  ${m}`); };
const ok = (m) => console.log(`  ok    ${m}`);

try {
  const page = await browser.newPage({ viewport: { width: 560, height: 800 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

  await page.goto(`${BASE}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#stack-tower-canvas', { timeout: 15000 });
  const box = await page.locator('#stack-tower-canvas').boundingBox();
  if (!box || box.width < 100) fail('画布尺寸异常'); else ok(`画布就绪 ${Math.round(box.width)}×${Math.round(box.height)}`);

  const scoreText = () => page.locator('.st-hud-score').innerText();
  const s0 = await scoreText();
  ok(`初始 HUD: "${s0}"`);

  for (let i = 0; i < 3; i++) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(420);
  }
  const s1 = await scoreText();
  const score1 = Number(s1.replace(/\D+/g, '')) || 0;
  if (score1 <= 0) fail(`点击后分数未变化: "${s1}"`); else ok(`3 次点击落块生效，HUD "${s1}"`);

  await page.keyboard.press('r');
  await page.waitForTimeout(150);
  const s2 = await scoreText();
  if (!s2.includes('0')) fail(`重开未复位: "${s1}" → "${s2}"`); else ok(`重开复位: "${s2}"`);

  // 二进制资产通道：页面内 fetch 补丁已还原真实字节 → 直接 arrayBuffer 验魔数
  const probe = await page.evaluate(async (base) => {
    const dec = async (p) => {
      const r = await fetch(`${base}/api/public/assets/${p}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, bytes: buf.length, head: [buf[0], buf[1], buf[2], buf[3]] };
    };
    const png = await dec('assets/icons/icon-192-maskable.png');
    const m4a = await dec('assets/sfx/sfx-place.m4a');
    return { png, m4a };
  }, BASE);
  const pngMagic = probe.png.head.join(',') === '137,80,78,71';
  const m4aOk = probe.m4a.bytes > 1000;
  if (probe.png.status !== 200 || !pngMagic) fail(`PNG 还原异常: ${JSON.stringify(probe.png)}`); else ok(`PNG 字节通道 ✓（${probe.png.bytes}B，PNG 魔数正确）`);
  if (probe.m4a.status !== 200 || !m4aOk) fail(`M4A 还原异常: ${JSON.stringify(probe.m4a)}`); else ok(`M4A 字节通道 ✓（${probe.m4a.bytes}B）`);

  // 音频真实路径：补丁后的 fetch 产出原生字节 → AudioContext 解码（有声的直接证据）
  const audio = await page.evaluate(async (base) => {
    try {
      const r = await fetch(`${base}/api/public/assets/assets/sfx/sfx-place.m4a`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const buf = await ctx.decodeAudioData(bytes.buffer.slice(0));
      ctx.close();
      return { ok: true, duration: buf.duration, channels: buf.numberOfChannels, sampleRate: buf.sampleRate };
    } catch (e) { return { ok: false, error: String(e) }; }
  }, BASE);
  if (!audio.ok) fail(`音效解码失败: ${audio.error}`); else ok(`音效可解码 ✓（${audio.sampleRate}Hz / ${audio.channels}ch / ${audio.duration.toFixed(2)}s）`);

  if (errors.length) fail(`页面运行期错误: ${errors.join(' | ')}`); else ok('零页面错误（pageerror / console.error 均无）');
} catch (e) {
  fail(`脚本异常: ${e.message}`);
} finally {
  await browser.close();
}
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS (live)');
process.exit(failed ? 1 : 0);

import { chromium } from 'playwright';

const LIVE = process.env.QA_LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/game-13';
const SHOT_DIR = process.env.QA_SHOT_DIR || '/tmp/live-qa/shots';
const results = [];
const consoleErrors = [];
const pageErrors = [];
const check = (ok, name, detail = '') => {
  results.push({ ok, name, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));

await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 60000 });
check(true, '落地页可达', LIVE);

const title = await page.title();
check(title.includes('测试预算边界'), '落地页标题为本游戏', title);

// 等引擎装载：Godot 导出壳出现 <canvas>
await page.waitForSelector('canvas', { timeout: 60000 });
const canvasBox = await page.locator('canvas').boundingBox();
check(!!canvasBox && canvasBox.width > 300, '引擎 canvas 已挂载', JSON.stringify(canvasBox));

// 等引擎真正跑起来：boot 提示消失或超时兜底
await page.waitForFunction(() => {
  const msg = document.querySelector('#boot-msg, #status, #status-progress');
  return !msg || msg.offsetParent === null || getComputedStyle(msg).display === 'none';
}, null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(6000);

const shot0 = `${SHOT_DIR}/live-01-boot.png`;
await page.screenshot({ path: shot0 });
const before = await page.locator('canvas').screenshot();

// 布点确定性（种子 20261004）：第 1 枚结晶世界坐标 ≈ (116.4, 150.4)，画布 640x360 等比拉伸
const scale = canvasBox.width / 640;
const star = { x: canvasBox.x + 116.44 * scale, y: canvasBox.y + 150.42 * scale };
await page.mouse.click(star.x, star.y);
await page.waitForTimeout(700);
await page.mouse.click(star.x, star.y);
await page.waitForTimeout(2500);

const shot1 = `${SHOT_DIR}/live-02-after-click.png`;
await page.screenshot({ path: shot1 });
const after = await page.locator('canvas').screenshot();
const changed = !before.equals(after);
check(changed, '点击后画面发生变化（收集反馈/消散动画）', `${before.length}B -> ${after.length}B`);

check(pageErrors.length === 0, '无页面级异常（pageerror）', pageErrors.join(' | ').slice(0, 300));
const fatal = consoleErrors.filter((e) => !/favicon|Failed to load resource.*favicon/i.test(e));
check(fatal.length === 0, '无控制台报错', fatal.join(' | ').slice(0, 300));

console.log('\n截图：', shot0, shot1);
const failed = results.filter((r) => !r.ok);
console.log(`\nLIVE_SMOKE: ${failed.length === 0 ? 'PASS' : 'FAIL'}（${results.length - failed.length}/${results.length} 项通过）`);
await browser.close();
process.exit(failed.length === 0 ? 0 : 1);

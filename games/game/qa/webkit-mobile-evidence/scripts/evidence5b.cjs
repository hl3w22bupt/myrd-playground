/* v5 补充：3x 高清截图（deviceScaleFactor=3）。
 * 截图① 开局遮罩：独立 context，纯截图不触摸（规避「tap 前截图破坏触摸管线」的构建怪癖）。
 * 截图② 无效交换瞬间：另一 context，tap 前零截图，tapB 后 ~0.35s 截图（红闪+抖动中+HUD 提示同帧）。 */
const { webkit, devices } = require('playwright');
const OUT = '/tmp/candy-webkit/v5';
const LIVE_URL = process.env.LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/game/';
const CX = 70.4, CY = 238.6, STEP = 49.8;
const cellCss = (x, y) => ({ x: CX + STEP * x, y: CY + STEP * y });

(async () => {
  const browser = await webkit.launch({ executablePath: process.env.WEBKIT_EXEC });

  // ① 开局遮罩
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#boot', { timeout: 30000 });
    await page.waitForTimeout(2500); // 等遮罩文字渲染
    await page.screenshot({ path: OUT + '/screenshot3x_start-overlay-390x664.png' });
    await ctx.close();
    console.log('[3x] start overlay saved');
  }

  // ② 无效交换瞬间（tap 前零截图）
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      const b = document.getElementById('boot');
      return b && b.classList.contains('hidden');
    }, null, { timeout: 120000 });
    await page.waitForTimeout(800);
    await page.touchscreen.tap(195, 370); // START
    await page.waitForTimeout(1500);
    const A = cellCss(1, 3), B = cellCss(1, 4);
    await page.touchscreen.tap(A.x, A.y);
    await page.waitForTimeout(220);
    await page.touchscreen.tap(B.x, B.y);
    await page.waitForTimeout(350); // FX 中段（缩小+抖动）且 HUD 提示已出现
    await page.screenshot({ path: OUT + '/screenshot3x_invalid-red-flash-hud-msg.png' });
    await ctx.close();
    console.log('[3x] invalid swap fx saved');
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

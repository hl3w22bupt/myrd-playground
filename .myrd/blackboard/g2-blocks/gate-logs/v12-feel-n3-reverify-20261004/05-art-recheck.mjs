#!/usr/bin/env node
// 01-art-recheck.mjs — A 轮 N4 美术线复核机判（游戏美术 · 2026-10-03）
//
// 复核对象 = 主策划代执行的 A-01..A-08 素材包（9 件 + 4 实机帧）。
// 四门禁 + 三项复核修正（A-12 token 漂移 / A-13 未冻结数值文案 / A-14 内部元数据外泄）逐项机判。
// 零 npm 依赖：像素检查走共享件 tools/cdp.mjs（headless Chrome canvas）。
import { readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const EV = dirname(fileURLToPath(import.meta.url));           // …/gate-logs/a4-art-recheck-20261003
const WS = resolve(EV, '../../../../..'); // run 工作区根（EV 上溯 5 级）
const G2 = process.env.G2_REPO ? resolve(process.env.G2_REPO) : resolve(WS, '..', 'g2-blocks');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const results = [];
const check = (id, name, ok, detail) => { results.push({ id, name, ok, detail }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name} — ${detail}`); };
if (!existsSafe(G2)) { console.error(`RED: g2-blocks 仓库不存在: ${G2}`); process.exit(1); }
function existsSafe(p) { try { readFileSync(join(p, 'package.json')); return true; } catch { return false; } }

// 主题经 node 原生 TS 剥离直接 import（与 tools/gen-release-assets.mjs 同法）
const theme = await import(pathToFileURL(join(G2, 'src', 'render', 'theme.ts')).href);
const spec = JSON.parse(readFileSync(join(WS, '.myrd/spec/g2-blocks/design-spec.json'), 'utf8'));
const relManifest = JSON.parse(readFileSync(join(G2, 'assets/release/release-assets.json'), 'utf8'));
const shotManifest = JSON.parse(readFileSync(join(G2, 'assets/release/shot-manifest.json'), 'utf8'));
const asmManifest = JSON.parse(readFileSync(join(G2, 'docs/assembly-manifest.json'), 'utf8'));
const genSrc = readFileSync(join(G2, 'tools/gen-release-assets.mjs'), 'utf8');
const styleCard = JSON.parse(readFileSync(join(G2, 'assets/style-card.json'), 'utf8'));
const uiTokens = JSON.parse(readFileSync(join(G2, 'assets/e-renderer-ui-tokens.json'), 'utf8'));

// ---- 门一 色值溯源：生成器零裸 hex / 零 rgba 字面量；素材像素取自冻结色板 ----
{
  const hexLits = genSrc.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  // 只咬「数字字面量」形态的 rgba/rgb（withAlpha 模板 rgba(${…}) 属 token 合成通道，非字面量）
  const rgbaLits = genSrc.match(/\brgba?\(\s*\d/g) ?? [];
  check('门一.a', '生成器零裸 hex / 零 rgba 字面量', hexLits.length === 0 && rgbaLits.length === 0,
    `hex=${hexLits.length} rgba/rgb=${rgbaLits.length}（A-12 修正后）`);
  const tk = Object.keys(theme.PALETTE);
  const frozen = spec.spec.numeric.palette.colors.map((c) => `${c.id}=${c.hex.toUpperCase()}`);
  const matchOk = tk.every((k) => frozen.includes(`${k}=${theme.PALETTE[k].toUpperCase()}`));
  check('门一.b', 'theme.PALETTE 7 键 ≡ spec 冻结色板（numeric 唯一真源）', matchOk && tk.length === 7, frozen.join(' '));
  const sc = styleCard.material;
  const matOk = theme.MATERIAL.topHighlight.alpha === sc.topHighlight.alpha && theme.MATERIAL.innerStroke.alpha === sc.innerStroke.alpha
    && theme.SHAPE.topHighlightRatio === sc.topHighlight.alpha && theme.SHAPE.cornerRadiusRatio === styleCard.shape.cornerRadiusRatio;
  check('门一.c', 'style-card（美术规格真源）↔ theme 零漂移（A-12 判据）', matOk,
    `topHighlight α=${theme.MATERIAL.topHighlight.alpha} innerStroke α=${theme.MATERIAL.innerStroke.alpha} corner=${theme.SHAPE.cornerRadiusRatio}`);
}

// ---- 门二 尺寸合规：IHDR 机判 9 件 + 4 实机帧 ----
{
  const EXPECT = {
    'icons/icon-512.png': [512, 512], 'icons/icon-maskable-512.png': [512, 512], 'icons/icon-192.png': [192, 192],
    'favicon/favicon-32.png': [32, 32], 'favicon/favicon-16.png': [16, 16], 'favicon/apple-touch-icon-180.png': [180, 180],
    'share/og-1200x630.png': [1200, 630], 'share/wx-share-500x400.png': [500, 400], 'share/dy-share-720x1280.png': [720, 1280],
  };
  let ok = true; const detail = [];
  for (const [f, [w, h]] of Object.entries(EXPECT)) {
    const buf = readFileSync(join(G2, 'assets/release', f));
    const iw = buf.readUInt32BE(16), ih = buf.readUInt32BE(20);
    const m = relManifest.assets.find((a) => a.file === `assets/release/${f}`);
    const shaOk = m && m.sha256 === sha256(buf);
    if (iw !== w || ih !== h || !shaOk) { ok = false; detail.push(`${f} ${iw}x${ih}${shaOk ? '' : ' SHA≠manifest'}`); }
  }
  check('门二.a', '9 件 IHDR 尺寸 + sha256 ≡ release-assets.json', ok, ok ? '9/9（512/192/180/32/16/1200×630/500×400/720×1280）' : detail.join('; '));
  let sok = true; const sdet = [];
  for (const s of shotManifest.shots) {
    const buf = readFileSync(join(G2, 'assets/release/shots', s.name));
    const iw = buf.readUInt32BE(16), ih = buf.readUInt32BE(20);
    if (iw !== 780 || ih !== 1688 || s.sha256 !== sha256(buf)) { sok = false; sdet.push(`${s.name} ${iw}x${ih}`); }
  }
  check('门二.b', '4 实机帧 780×1688（390×844@2x）+ sha256 ≡ shot-manifest', sok && shotManifest.shots.length === 4,
    sok ? '4/4 @2x' : sdet.join('; '));
}

// ---- 门四 同批可证：截图与 build 同 sha256 指纹 ----
{
  const ok = shotManifest.buildSha256 === asmManifest.buildSha256;
  check('门四', 'shot-manifest.buildSha256 ≡ assembly-manifest.buildSha256', ok,
    `同批 ${String(shotManifest.buildSha256).slice(0, 16)}（assembly gitRef=${String(asmManifest.gitRef ?? asmManifest.headSha ?? '?').slice(0, 9)}）`);
}

// ---- A-09 认领判定：typeScale 数值 ≡ 描述件，且基准 = 整屏高（renderer 源码机判） ----
{
  const ts = uiTokens.typeScale, tt = theme.TYPE_SCALE;
  const eq = ts.scoreRatio === tt.scoreRatio && ts.labelRatio === tt.labelRatio && ts.bannerRatio === tt.bannerRatio;
  const rsrc = readFileSync(join(G2, 'src/render/renderer.ts'), 'utf8');
  const baseH = /layout\.h \* TYPE_SCALE\./.test(rsrc);
  const hudOk = styleCard.layout.hudAreaRatio === 0.12;
  const px = (r) => Math.round(844 * r * 10) / 10;
  check('A-09', `typeScale 代改认领（${ts.scoreRatio}/${ts.labelRatio}/${ts.bannerRatio}）`, eq && baseH && hudOk,
    `theme≡描述件 ✓ · 基准=layout.h ✓ · 390×844 实测 score=${px(ts.scoreRatio)}px label=${px(ts.labelRatio)}px banner=${px(ts.bannerRatio)}px（旧值 0.3→253px 巨字已除）`);
}

// ---- A-13/A-14 文案红线：渠道素材不承载未冻结数值与内部元数据（生成器源码机判 + 像素抽验于下段） ----
{
  const genCode = genSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // 剥注释：注释非渲染文案
  const badCopy = genCode.match(/×5|maxMultiplier|spec v\$\{spec\._platform/) ?? [];
  check('A-13/A-14.a', '生成器零「×5 / maxMultiplier / spec vN」文案', badCopy.length === 0,
    badCopy.length === 0 ? '连击上限= v1.2 draft 未冻结值（approved v1.1 numeric.combo 无此键），已改「连击加成 · 炉冷判定」' : badCopy.join(','));
  const v12 = JSON.parse(readFileSync(join(WS, '.myrd/spec/g2-blocks/design-spec-v1.2-draft.json'), 'utf8'));
  check('A-13.b', '判据留痕：approved 无 maxMultiplier · v1.2 draft 才有', spec.spec.numeric.combo.maxMultiplier === undefined && v12.spec.numeric.combo.maxMultiplier === 5,
    `approved.combo=${JSON.stringify(spec.spec.numeric.combo)} · v1.2 maxMultiplier=${v12.spec.numeric.combo.maxMultiplier}(draft)`);
}

// ---- 门三 maskable 安全区 + 色板派生像素抽验（headless Chrome canvas） ----
{
  const { findChromeOrDie, launchChromeWithPage, Cdp, teardown } = await import(pathToFileURL(join(G2, 'tools', 'cdp.mjs')).href);
  const die = (m) => { console.error(`RED ${m}`); process.exit(1); };
  const chromeBin = findChromeOrDie(die);
  const { proc, wsUrl, userDir } = await launchChromeWithPage(chromeBin, die);
  const cdp = new Cdp(wsUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await new Promise((r) => setTimeout(r, 300));

  const hex2rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const stops = theme.BACKDROP.stops.map((s) => ({ at: s.at, rgb: hex2rgb(s.hex) }));
  const imgData = await (async (file) => {
    const b64 = readFileSync(file).toString('base64');
    return cdp.eval(`new Promise((res, rej) => {
      const im = new Image(); im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
        res({ w: im.width, h: im.height, d: Array.from(cx.getImageData(0, 0, im.width, im.height).data) });
      }; im.onerror = () => rej(new Error('img fail')); im.src = 'data:image/png;base64,${b64}';
    })`);
  });
  const bgAt = (y, h) => {
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (y / h >= stops[i].at && y / h <= stops[i + 1].at) { a = stops[i]; b = stops[i + 1]; break; }
    const t = b.at === a.at ? 0 : (y / h - a.at) / (b.at - a.at);
    return a.rgb.map((v, i) => Math.round(v + (b.rgb[i] - v) * t));
  };

  // 门三：maskable 两件核心元素全部落在中心 80% 安全区（r = 0.4·min(w,h)）
  for (const f of ['icons/icon-maskable-512.png', 'favicon/apple-touch-icon-180.png']) {
    const { w, h, d } = await imgData(join(G2, 'assets/release', f));
    const cx = w / 2, cy = h / 2, rMax = Math.min(w, h) * 0.41; // 0.40 + 抗锯齿容差
    let outside = 0, content = 0;
    for (let y = 0; y < h; y++) {
      const bg = bgAt(y, h);
      for (let px = 0; px < w; px++) {
        const i = (y * w + px) * 4;
        const isContent = Math.abs(d[i] - bg[0]) > 26 || Math.abs(d[i + 1] - bg[1]) > 26 || Math.abs(d[i + 2] - bg[2]) > 26;
        if (!isContent) continue;
        content++;
        if (Math.hypot(px + 0.5 - cx, y + 0.5 - cy) > rMax) outside++;
      }
    }
    check('门三', `${f} 核心元素 ⊆ 中心 80% 安全区`, outside === 0, `内容像素 ${content} · 越界 ${outside}（r≤${Math.round(rMax)}px）`);
  }

  // 色板派生像素抽验：icon-512 四块面心（高光带下方）≈ 冻结 hex ±3
  {
    const { w, h, d } = await imgData(join(G2, 'assets/release/icons/icon-512.png'));
    const size = w * 0.62, gap = size * 0.10, off = size / 4 + gap / 4;
    const cells = [[-1, -1, 'block-01'], [1, -1, 'block-02'], [-1, 1, 'block-04'], [1, 1, 'block-03']];
    let ok = true; const det = [];
    for (const [sx, sy, id] of cells) {
      const px = Math.round(w / 2 + sx * off), py = Math.round(h / 2 + sy * off + size * 0.18);
      const i = (py * w + px) * 4;
      const want = hex2rgb(theme.PALETTE[id]);
      const dv = Math.max(Math.abs(d[i] - want[0]), Math.abs(d[i + 1] - want[1]), Math.abs(d[i + 2] - want[2]));
      if (dv > 3) { ok = false; det.push(`${id}@(${px},${py}) Δ=${dv}`); }
    }
    check('门一.d', 'icon-512 四块面心像素 ≡ 冻结色板（±3）', ok, ok ? '4/4 命中（block-01/02/03/04）' : det.join('; '));
  }
  await teardown(proc, userDir, { rmSync }).catch(() => {});
}

const fails = results.filter((r) => !r.ok);
console.log(`\nART-RECHECK: ${fails.length === 0 ? 'PASS' : 'FAIL'} ${results.length - fails.length}/${results.length}（美术四门禁 + A-09 认领 + A-13/A-14 文案红线）`);
process.exit(fails.length === 0 ? 0 : 1);

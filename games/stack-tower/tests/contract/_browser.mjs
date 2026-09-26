/**
 * 契约测试共享：playwright 装载器 + serve.mjs 拉起（m1/m3/d2 浏览器级契约用）。
 * playwright 解析顺序：本包 → PLAYWRIGHT_MODULE_DIR（显式指定）→ npm 全局根自动发现 → null。
 * 浏览器不可用 → 调用方输出 RESULT: not-runnable（显式，不静默计绿）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export { GAME_DIR };

/** 从指定 node_modules 目录解析 playwright；失败返回 null（不抛错）。 */
function requireFrom(dir) {
  try {
    return createRequire(path.join(dir, 'noop.js'))('playwright');
  } catch {
    return null;
  }
}

export async function loadPlaywright() {
  const local = requireFrom(GAME_DIR);
  if (local) return local;
  const explicit = process.env.PLAYWRIGHT_MODULE_DIR;
  if (explicit) {
    const pw = requireFrom(explicit);
    if (pw) return pw;
  }
  // 兜底：npm 全局根自动发现（非交互、仅失败路径多花一次 npm root -g）。
  // npm 缺失 / 查询失败 / 全局根也没有 playwright → 返回 null → 调用方报 not-runnable。
  const probe = spawnSync('npm', ['root', '-g', '--silent'], { encoding: 'utf8', timeout: 10_000 });
  const globalRoot = probe.status === 0 ? (probe.stdout || '').trim() : '';
  if (!globalRoot) return null;
  return requireFrom(globalRoot);
}

/** 拉起 serve.mjs（返回 { base, stop }）；端口 = 4673 + pid%500 防撞 */
export async function startServer() {
  const PORT = Number(process.env.SMOKE_PORT ?? 4673 + (process.pid % 500));
  const BASE = `http://127.0.0.1:${PORT}`;
  const server = spawn(process.execPath, [path.join(GAME_DIR, 'serve.mjs')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return { BASE, stop: () => server.kill('SIGTERM') };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

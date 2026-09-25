/**
 * 契约测试共享：playwright 装载器 + serve.mjs 拉起（m1/m3/d2 浏览器级契约用）。
 * playwright 解析顺序：本包 → PLAYWRIGHT_MODULE_DIR（全局 node_modules）→ null。
 * 浏览器不可用 → 调用方输出 RESULT: not-runnable（显式，不静默计绿）。
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export { GAME_DIR };

export async function loadPlaywright() {
  try {
    return createRequire(path.join(GAME_DIR, 'package.json'))('playwright');
  } catch {
    const dir = process.env.PLAYWRIGHT_MODULE_DIR;
    if (!dir) return null;
    try {
      return createRequire(path.join(dir, 'noop.js'))('playwright');
    } catch {
      return null;
    }
  }
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

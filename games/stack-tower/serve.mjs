#!/usr/bin/env node
/**
 * 零依赖静态服务（冒烟门禁用）— 复现：
 *   node games/stack-tower/serve.mjs            # 默认 127.0.0.1:4173
 *   PORT=8080 node games/stack-tower/serve.mjs
 * 只读服务本目录（index.html + build/），不做任何路径穿越放行。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const abs = normalize(join(ROOT, rel));
    if (!abs.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const body = await readFile(abs);
    res.writeHead(200, { 'content-type': MIME[extname(abs)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[serve] Stack Tower → http://${HOST}:${PORT}/ （Ctrl+C 停止）`);
});

#!/usr/bin/env node
// fake-s3.mjs — 本地验证用的伪对象存储（SigV4 签名一概不校验，只按路径回对象）。
// 用途：让壳 server 的 asset-store 在本机走完「拉清单 → 拉资产」全链路，
//       验证 / 伺服 transport-ship 单文件游戏 —— 不依赖平台对象存储。
// 端点约定与 platform s3-backend 同构：GET /<bucket>/<key>。
//   /fake/manifest.json          → 资产清单
//   /fake/raw/index.html         → raw 形态（平台对 .html 的口径）
//   /fake/gz/index.html          → gzip+b64 形态（兼容分支用）
// 切换形态：环境变量 FAKE_S3_MODE = raw | gz | missing。
import http from "node:http";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORT = Number(process.env.FAKE_S3_PORT || 4602);
const MODE = process.env.FAKE_S3_MODE || "raw";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, "../../games/transport-ship-3d/export/web/index.html"));

function manifest() {
  if (MODE === "missing") return { assets: {} };
  const entry =
    MODE === "gz"
      ? { key: "gz/index.html", bytes: 0, gzip: true, contentType: "text/html" }
      : { key: "raw/index.html", bytes: html.length, gzip: false, contentType: "text/html" };
  return { assets: { "index.html": entry } };
}

const objects = {
  "raw/index.html": { body: html, contentType: "text/html" },
  "gz/index.html": { body: gzipSync(html), contentType: "text/html" },
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const key = decodeURIComponent(url.pathname).replace(/^\/[^/]+\//, "");
    if (key === "manifest.json") {
      const body = JSON.stringify(manifest());
      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
      console.log(`[fake-s3] GET manifest（${Object.keys(manifest().assets).length} 条）`);
      return;
    }
    const obj = objects[key];
    if (!obj) {
      res.writeHead(404);
      res.end("no such key");
      console.log(`[fake-s3] GET ${key} → 404`);
      return;
    }
    res.writeHead(200, { "content-type": obj.contentType });
    res.end(obj.body);
    console.log(`[fake-s3] GET ${key} → 200（${obj.body.length} bytes）`);
  })
  .listen(PORT, () => console.log(`[fake-s3] listening on :${PORT}（mode=${MODE}）`));

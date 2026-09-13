import { Hono } from "hono";
import { ctx, vars } from "#apphost";

const app = new Hono();

// 平台契约：健康检查（编排健康探针依据，部署后 30s 内必须 200）
app.get("/health", (c) => c.json({ ok: true, env: ctx.environment }));

// 落地页（/ 是唯一豁免 /api 前缀护栏的业务路径）。
// 页面内嵌「移动端音频手势解锁器」参考实现：有音效的应用壳必须保留这一段 ——
// iOS/Android WebKit 下 AudioContext 创建即 suspended、打断后 interrupted，
// 引擎只在自己的输入回调里 resume；缺这一层 = 移动端无声而桌面正常（详见
// games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md 取证）。
app.get("/", (c) =>
  c.html(
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>myrd-app</title><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f9fafb;color:#111827;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center}h1{font-size:1.6rem;margin:0 0 .5rem}code{background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:.9em}p{color:#6b7280;margin:.25rem 0}</style>
</head><body><div class="box"><h1>🚀 myrd-app 已上线</h1>
<p>这是 MyRD apphost 托管的动态应用（Node20 + Hono）。</p>
<p>试试：<code>GET /api/public/hello</code> · <code>GET /api/whoami</code>（需登录）</p>
</div>
<script>
(function () {
  'use strict';
  // ① 在引擎加载前包一层 AudioContext 构造器捕获实例
  var audioCtx = null;
  var audioLog = [];
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext) {
    var Wrapped = function (options) {
      var ctx = new NativeAudioContext(options);
      audioCtx = ctx;
      try { ctx.addEventListener('statechange', function () { audioLog.push({ t: Date.now(), state: ctx.state }); }); } catch (e) {}
      return ctx;
    };
    Wrapped.prototype = NativeAudioContext.prototype;
    window.AudioContext = Wrapped;
  }
  // ② 手势内同步 resume（覆盖 suspended 与 interrupted；capture+passive 不消费事件）
  function unlockAudio() {
    if (audioCtx && audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) {} }
  }
  ['touchstart', 'touchend', 'pointerdown', 'keydown', 'click'].forEach(function (type) {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });
  // ③ 真机取证出口
  window.__audioDebug = function () { return { state: audioCtx ? audioCtx.state : 'no-ctx', log: audioLog }; };
})();
</script>
</body></html>`,
  ),
);

// 公开接口：/api/public/* 无需登录（auth.user 可空）
app.get("/api/public/hello", (c) =>
  c.json({ hello: "world", logLevel: vars.LOG_LEVEL ?? null, appId: ctx.appId }),
);

// 受保护接口：/api/* 由平台网关强制登录 —— 未登录请求在到达本代码之前已被 401
app.get("/api/whoami", (c) => c.json({ user: c.req.header("x-myrd-user-id") ?? null }));

export default app;

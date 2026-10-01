/**
 * 《探针：验证 oak key 有效性（取证用，不计入三样例）》游戏落地页（伺服于 /）。
 *
 * 取证探针壳页契约（本页实现的硬性条目）：
 * 1. 调参桥（SKILL §3C / 部署节点 §3C 调参工作台硬契约）：引擎加载**之前**把 URL
 *    `?tuning=<urlencoded JSON>` 解析进 `window.__GAME_TUNING__`，游戏侧
 *    `GameState._apply_web_tuning()` 读入（只认 TUNING_META 声明的键、按 min/max 钳制）。
 * 2. 移动端音频手势解锁器：iOS/Android WebKit 下 AudioContext 创建即 suspended、
 *    打断后 interrupted（引擎状态机不识别），引擎只在自身输入回调里 resume ——
 *    壳页必须在引擎加载前安装：包 AudioContext 构造器捕获实例 + document 级手势监听
 *    内同步 resume（capture+passive 不消费事件）+ `window.__audioDebug()` 真机取证出口。
 *    根因取证：games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md（F1 手势解锁 / F2 worklet 防御）。
 * 3. M1 文本网关：二进制资产 base64 化经文本通道回传 —— 页面从 api/public/assets/*
 *    拉 base64 文本，还原 wasm/pck 真实字节后 monkeypatch window.fetch 拦截引擎请求，
 *    用内存字节构造 Response 返回（不用 instantiateStreaming，它要求 application/wasm）。
 * 4. 相对路径：页面里拉资源一律不带前导斜杠，经公网入口 /apps/oak-key 访问时才能
 *    解析到网关子路径；绝对路径会 404/被登录墙拦下，`?p=` 是网关保留 query 不可用。
 */
export const GAME_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">
<title>探针：验证 oak key 有效性（取证用，不计入三样例）</title>
<style>
html, body, #canvas { margin: 0; padding: 0; border: 0; }
body { color: #d8e6d0; background: #0c1410; overflow: hidden; touch-action: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
#canvas { display: block; width: 100vw; height: 100vh; }
#canvas:focus { outline: none; }
#boot { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  background: radial-gradient(circle at 50% 30%, #1a2b1f 0%, #0c1410 60%, #070d0a 100%); z-index: 10; transition: opacity .4s; }
#boot.hidden { opacity: 0; pointer-events: none; }
#boot h1 { margin: 0; font-size: 1.5rem; letter-spacing: .08em; color: #b8f0c2; text-align: center;
  text-shadow: 0 0 16px rgba(80, 220, 140, .35); }
#boot .sub { color: #6f8f78; font-size: .8rem; margin-top: -8px; text-align: center; line-height: 1.5; }
#bar-wrap { width: min(420px, 70vw); height: 12px; border-radius: 999px; background: #12211a; overflow: hidden; border: 1px solid #2c4a38; }
#bar { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #46d47e, #b8f0c2, #e8d47a); transition: width .2s; }
#boot-msg { color: #7fa38a; font-size: .8rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
#hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 5;
  color: #9dc4a8; background: rgba(10, 20, 14, .78); border: 1px solid #2c4a38; border-radius: 999px;
  padding: 6px 16px; font-size: 12px; letter-spacing: .05em; pointer-events: none; }
#boot kbd { background: #16281d; border: 1px solid #3d6b4d; border-bottom-width: 2px; border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: .92em; color: #b8f0c2; }
#keys { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; color: #6f8f78; font-size: .82rem; }
</style>
</head>
<body>
<canvas id="canvas">你的浏览器不支持 canvas。</canvas>
<div id="boot">
  <h1>探针：验证 oak key 有效性</h1>
  <div class="sub">取证探针 · forensic probe · 不计入三样例<br>拾取 key 片段 → 本地校验 → 反馈 oak_key_probe=valid|invalid</div>
  <div id="bar-wrap"><div id="bar"></div></div>
  <div id="boot-msg">正在装配探针…</div>
  <div id="keys"><span><kbd>WASD/←↑↓→</kbd> 移动</span><span><kbd>空格</kbd> 探测校验</span><span><kbd>R</kbd> 重开</span></div>
</div>
<div id="hint" style="display:none">拾满 3 片后按空格探测 · R 重开 · 触屏用摇杆 + 按钮</div>
<noscript>你的浏览器不支持 JavaScript。</noscript>
<!-- 引擎引导脚本由启动脚本按 BASE_PATH 动态注入（静态 src 在无尾斜杠入口下会 404） -->
<script>
(function () {
  // ---- 调参桥（必须在引擎加载前解析；SKILL §3C 壳页硬契约原文实现）----
  var raw = new URLSearchParams(location.search).get('tuning');
  if (raw) {
    try {
      var t = JSON.parse(raw);
      if (t && typeof t === 'object' && !Array.isArray(t)) window.__GAME_TUNING__ = t;
    } catch (e) { /* 非法 JSON：按无调参处理，不阻塞启动 */ }
  }

  // ---- 移动端音频手势解锁器（必须在引擎加载前安装，见文件头注释）----
  var audioCtx = null;
  var audioLog = [];
  var audioAddModules = 0;
  // ① 包一层 AudioContext 构造器捕获引擎实例：引擎用 new (AudioContext||webkitAudioContext)
  //    创建上下文，补丁透明；捕获后才能在壳页层做手势解锁与真机取证。
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext) {
    var WrappedAudioContext = function (options) {
      var ctx = new NativeAudioContext(options);
      audioCtx = ctx;
      try {
        ctx.addEventListener('statechange', function () {
          audioLog.push({ t: Date.now(), state: ctx.state });
        });
      } catch (e) { /* 老内核无 statechange 事件：只损失观测，不影响解锁 */ }
      return ctx;
    };
    WrappedAudioContext.prototype = NativeAudioContext.prototype;
    window.AudioContext = WrappedAudioContext;
  }
  // ② 手势内同步 resume：只在非 running 时调（覆盖 suspended 与 interrupted），幂等可重复。
  function unlockAudio() {
    if (!audioCtx || audioCtx.state === 'running') return;
    try {
      var pending = audioCtx.resume();
      if (pending && typeof pending.catch === 'function') pending.catch(function () {});
    } catch (e) { /* resume 抛异常按无操作处理，绝不影响游戏输入 */ }
  }
  ['touchstart', 'touchend', 'pointerdown', 'keydown', 'click'].forEach(function (type) {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) unlockAudio();
  }, { passive: true });
  // ③ 真机取证出口：手机上打开控制台不便，全部观测收敛到一个函数。
  window.__audioDebug = function () {
    return { state: audioCtx ? audioCtx.state : 'no-ctx', addModules: audioAddModules, log: audioLog };
  };

  // 资产基路径：公网入口 /apps/oak-key（无尾斜杠）下，裸相对路径会解析到 /apps/*（网关 404）。
  // 以页面路径推导：/apps/oak-key → /apps/oak-key/ → /apps/oak-key/api/public/assets/*。
  var BASE_PATH = (function () {
    var p = location.pathname.replace(/index\\.html$/, '');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  })();
  var bar = document.getElementById('bar');
  var msg = document.getElementById('boot-msg');
  function setBar(p) { if (bar) bar.style.width = Math.max(0, Math.min(100, p * 100)) + '%'; }
  function fail(err) {
    console.error(err);
    msg.textContent = '加载失败：' + (err && err.message ? err.message : err) + '（M1 网关仅支持文本通道，若资源缺失请联系工坊）';
  }

  function fetchAsset(name) {
    return fetch(BASE_PATH + 'api/public/assets/' + name).then(function (r) {
      if (!r.ok) throw new Error(name + ' HTTP ' + r.status);
      return r.text();
    });
  }
  function b64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function gunzip(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('浏览器缺少 DecompressionStream（需要 Chrome 80+/Safari 16.4+）'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  // 音频 worklet 由浏览器内部加载（不经 window.fetch），单独补丁改写到相对资产端点。
  // F2 防御（MOBILE_AUDIO_ROOT_CAUSE.md）：worklet 是音频单一故障点 —— 起播被 await 门控、
  // addModule 的 promise 无 .catch，失败即全部事件音静默且几乎无报错。
  // 故：真实 URL 优先，失败降级原路径重试一次，仍失败显式 console.error 并落取证日志。
  if (window.AudioWorkletNode && window.AudioWorklet && AudioWorklet.prototype.addModule) {
    var origAddModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = function (url, options) {
      var self = this;
      var file = '';
      try { file = String(url).split('/').pop().split('?')[0]; } catch (e) { /* 保原路径 */ }
      if (/\\.worklet\\.js$/.test(file)) {
        audioAddModules += 1;
        var realUrl = BASE_PATH + 'api/public/assets/' + file;
        return origAddModule.call(self, realUrl, options).catch(function (err) {
          console.error('[oak-key-shell] audio worklet 资产通道加载失败，降级原路径重试', file, err);
          audioLog.push({ t: Date.now(), state: 'worklet-fallback:' + file });
          return origAddModule.call(self, url, options).catch(function (err2) {
            console.error('[oak-key-shell] audio worklet 兜底加载也失败（移动端将无声）', file, err2);
            audioLog.push({ t: Date.now(), state: 'worklet-dead:' + file });
            throw err2;
          });
        });
      }
      return origAddModule.call(self, url, options);
    };
  }

  var wasmBytes = null, pckBytes = null;
  // 动态加载引擎引导（静态 src 在无尾斜杠入口下会 404）： onload 后 Engine 全局才可用，
  // 后续启动逻辑全部串在 loadEngine 之后，杜绝 Engine 未定义竞态。
  function loadEngine() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = BASE_PATH + 'api/public/assets/index.js';
      s.onload = function () { resolve(null); };
      s.onerror = function () { reject(new Error('引擎引导脚本加载失败: ' + s.src)); };
      document.head.appendChild(s);
    });
  }
  loadEngine().then(function () { return Promise.all([
    fetchAsset('index.wasm.gz.b64').then(function (b64) { return gunzip(b64ToBytes(b64)); })
      .then(function (b) { wasmBytes = b; setBar(0.85); msg.textContent = '探针就绪，装载场景…'; }),
    fetchAsset('index.pck.gz.b64').then(function (b64) { return gunzip(b64ToBytes(b64)); })
      .then(function (b) { pckBytes = b; setBar(0.95); })
  ]); }).then(function () {
    if (!WebAssembly.validate(wasmBytes)) throw new Error('wasm 校验失败（传输可能被破坏）');
    // 拦截引擎对 wasm/pck 的 fetch，返回内存中的真实字节（非 instantiateStreaming 路径）
    var realFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var file = url.split('/').pop().split('?')[0];
      if (file === 'index.wasm') return Promise.resolve(new Response(wasmBytes));
      if (file === 'index.pck') return Promise.resolve(new Response(pckBytes));
      return realFetch(input, init);
    };
    setBar(1);
    var engine = new Engine({
      args: [], canvasResizePolicy: 2, executable: 'index', experimentalVK: false,
      fileSizes: { 'index.pck': pckBytes.length, 'index.wasm': wasmBytes.length },
      focusCanvas: true, gdextensionLibs: []
    });
    var missing = Engine.getMissingFeatures({ threads: false });
    if (missing.length !== 0) { fail(new Error('浏览器缺少运行所需特性: ' + missing.join(', '))); return; }
    engine.startGame({
      'onProgress': function (current, total) {
        if (current > 0 && total > 0) { setBar(current / total); msg.textContent = '启动探针引擎…'; }
      }
    }).then(function () {
      var boot = document.getElementById('boot');
      var hint = document.getElementById('hint');
      if (boot) boot.classList.add('hidden');
      if (hint) hint.style.display = 'block';
    }, fail);
  }).catch(fail);
})();
</script>
</body>
</html>
`;

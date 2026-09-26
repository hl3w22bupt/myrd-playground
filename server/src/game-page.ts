/**
 * 《光路谜阵》游戏落地页（伺服于 /）。
 *
 * 与 Godot 默认壳的差异：所有二进制资产必须经 M1 文本网关中转 ——
 * 页面先从 api/public/assets/* 拉 base64 文本，还原出 wasm/pck 真实字节，
 * 再 monkeypatch window.fetch 拦截引擎对 index.wasm / index.pck 的请求，
 * 用内存字节构造 Response 返回（引擎内部的 fetch 调用无感知）。
 * audio worklet 走 AudioWorklet.addModule（浏览器内部加载，不经 window.fetch），
 * 单独补丁把相对文件名改写到 api/public/assets/ 下。
 *
 * 注意：页面里拉资源的路径一律不带前导斜杠（相对路径），
 * 经公网入口 /apps/game-4 访问时才能解析到网关子路径；
 * 绝对路径 / ?p= 手拼都会 404 / 被登录墙拦下（M1 网关契约）。
 *
 * 调参桥（§3C 调参工作台硬契约，必须在引擎加载前安装）：
 * URL ?tuning=<urlencoded json> → window.__GAME_TUNING__；
 * URL ?tuning=1（或非 JSON 值）→ window.__GAME_TUNING_PANEL__='requested'（只开调参面板，不注入数值）；
 * 游戏侧 GameState._apply_tuning() 只认 TUNING_META 声明的键并按 min/max 钳制，
 * TuningPanel 面板就绪后把 __GAME_TUNING_PANEL__ 改为 'shown'（公网机判取证锚点）。
 *
 * 移动端音频手势解锁器（脚本最前段，必须先于引擎加载安装）：
 * iOS/Android WebKit 的 AudioContext 创建即 suspended、打断后 interrupted（引擎不识别），
 * 引擎只在自身输入回调里 resume —— 缺壳页兜底 = 移动端无声而桌面正常。
 * 实现：包 AudioContext 构造器捕获实例 + document 级手势监听内同步 resume
 * （capture+passive 不消费事件）+ window.__audioDebug() 真机取证出口。
 */
export const GAME_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">
<title>光路谜阵</title>
<style>
html, body, #canvas { margin: 0; padding: 0; border: 0; }
body { color: #fff; background: #0b0e1a; overflow: hidden; touch-action: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
#canvas { display: block; width: 100vw; height: 100vh; }
#canvas:focus { outline: none; }
#boot { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(circle at 50% 35%, #1c2a52 0%, #101731 55%, #0a0d1c 100%); z-index: 10; transition: opacity .4s; }
#boot.hidden { opacity: 0; pointer-events: none; }
#boot h1 { margin: 0; font-size: 2rem; letter-spacing: .18em; color: #ffd966;
  text-shadow: 0 2px 0 #8a6a1c, 0 0 22px rgba(255, 217, 102, .45); }
#boot .sub { color: #8fa3cf; font-size: .85rem; margin-top: -10px; }
#bar-wrap { width: min(420px, 70vw); height: 14px; border-radius: 999px; background: #131b38; overflow: hidden; border: 1px solid #2c3d6e; }
#bar { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #ffd966, #7ae0c3, #6fb1ff); transition: width .2s; }
#boot-msg { color: #93a4cc; font-size: .8rem; }
#hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 5;
  color: #c9d6f2; background: rgba(13, 18, 38, .78); border: 1px solid #2c3d6e; border-radius: 999px;
  padding: 6px 16px; font-size: 12px; letter-spacing: .05em; pointer-events: none; }
#boot kbd { background: #1b2a55; border: 1px solid #3d5390; border-bottom-width: 2px; border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: .92em; color: #ffd966; }
#keys { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; color: #8fa3cf; font-size: .82rem; max-width: 86vw; }
</style>
</head>
<body>
<canvas id="canvas">你的浏览器不支持 canvas。</canvas>
<div id="boot">
  <h1>光路谜阵</h1>
  <div class="sub">Light Path Labyrinth · MyRD 小游戏工坊</div>
  <div id="bar-wrap"><div id="bar"></div></div>
  <div id="boot-msg">正在点亮光路…</div>
  <div id="keys"><span><kbd>WASD/←↑↓→</kbd> 移动光标</span><span><kbd>点击/空格</kbd> 旋转管道</span><span><kbd>Z</kbd> 撤销</span><span><kbd>R</kbd> 重开</span><span><kbd>Q/E</kbd> 选关</span><span><kbd>Enter</kbd> 下一关</span></div>
</div>
<div id="hint" style="display:none">点击/WASD 移动 · 空格旋转 · Z 撤销 · R 重开 · Q/E 选关 · Enter 下一关</div>
<noscript>你的浏览器不支持 JavaScript。</noscript>
<!-- 引擎引导脚本由启动脚本按 BASE_PATH 动态注入（静态 src 在无尾斜杠入口下会 404） -->
<script>
(function () {
  'use strict';
  // ---- 调参桥（§3C 契约）：必须最先执行，引擎加载前把 ?tuning= 解析进全局 ----
  // 游戏侧 GameState._apply_tuning() 只认 TUNING_META 声明的键并按 min/max 钳制；
  // 非对象 / 数组 / 非法 JSON 一律忽略，绝不让坏参数阻断启动。
  // ?tuning=1（或任何非 JSON 对象的值）= 只开调参面板：置 __GAME_TUNING_PANEL__ 标记，
  // 游戏侧 TuningPanel 检测到 URL 带 ?tuning= 即浮出面板，并在就绪后把标记改为 'shown'。
  var tuningRaw = null;
  try { tuningRaw = new URLSearchParams(location.search).get('tuning'); } catch (e) { /* 老内核无 URLSearchParams：调参不可用，游戏照常 */ }
  if (tuningRaw) {
    var tuningIsObject = false;
    try {
      var tuningParsed = JSON.parse(tuningRaw);
      if (tuningParsed && typeof tuningParsed === 'object' && !Array.isArray(tuningParsed)) {
        window.__GAME_TUNING__ = tuningParsed;
        tuningIsObject = true;
      }
    } catch (e) { /* 非法 JSON：按开面板处理 */ }
    if (!tuningIsObject) { try { window.__GAME_TUNING_PANEL__ = 'requested'; } catch (e) { /* 忽略 */ } }
  }

  // ---- 移动端音频手势解锁器（必须在引擎加载前安装）----
  // iOS/Android WebKit 下 AudioContext 创建即 suspended，锁屏/来电/切后台会打成
  // interrupted（引擎状态机不识别），引擎只在自身输入回调里 resume ——
  // 壳页没有这一层兜底 = 移动端全部音效静默且控制台零报错（桌面正常 ≠ 移动正常）。
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
  //    必须在手势调用栈内同步执行 WebKit 才认；resume 的 Promise 落空不进控制台（无噪声）。
  function unlockAudio() {
    if (!audioCtx || audioCtx.state === 'running') return;
    try {
      var pending = audioCtx.resume();
      if (pending && typeof pending.catch === 'function') pending.catch(function () {});
    } catch (e) { /* resume 抛异常按无操作处理，绝不影响游戏输入 */ }
  }
  ['touchstart', 'touchend', 'pointerdown', 'keydown', 'click'].forEach(function (type) {
    // capture + passive：先于引擎输入管线触发，且不消费事件（游戏触摸交互零感知）。
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });
  // 打断再解锁：Webkit 在锁屏/来电后即使回前台也可能停在 interrupted，多给一次恢复机会
  //（非手势路径可能被拒，被拒即无操作；真正兜底仍是用户下一次点按）。
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) unlockAudio();
  }, { passive: true });
  // ③ 真机取证出口：手机上打开控制台不便，全部观测收敛到一个函数。
  window.__audioDebug = function () {
    return { state: audioCtx ? audioCtx.state : 'no-ctx', addModules: audioAddModules, log: audioLog };
  };

  // 资产基路径：公网入口 /apps/game-4（无尾斜杠）下，裸相对路径会解析到 /apps/*（网关 404）。
  // 以页面路径推导：/apps/game-4 → /apps/game-4/ → /apps/game-4/api/public/assets/*。
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
  // worklet 是音频单一故障点：addModule 的 promise 无 .catch 时失败即全部事件音静默。
  // 故：真实 URL 优先，失败降级原路径重试一次，仍失败显式 console.error 并记入取证日志。
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
          console.error('[guanglu-shell] audio worklet 资产通道加载失败，降级原路径重试', file, err);
          audioLog.push({ t: Date.now(), state: 'worklet-fallback:' + file });
          return origAddModule.call(self, url, options).catch(function (err2) {
            console.error('[guanglu-shell] audio worklet 兜底加载也失败（移动端将无声）', file, err2);
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
      .then(function (b) { wasmBytes = b; setBar(0.85); msg.textContent = '引擎就绪，布置光学元件…'; }),
    fetchAsset('index.pck.gz.b64').then(function (b64) { return gunzip(b64ToBytes(b64)); })
      .then(function (b) { pckBytes = b; setBar(0.95); })
  ]); }).then(function () {
    if (!WebAssembly.validate(wasmBytes)) throw new Error('wasm 校验失败（传输可能被破坏）');
    // 拦截引擎对 wasm/pck 的 fetch，返回内存中的真实字节（不走 instantiateStreaming，
    // 避免其要求的 application/wasm Content-Type 在文本网关下必然失败）。
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
        if (current > 0 && total > 0) { setBar(current / total); msg.textContent = '启动游戏引擎…'; }
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

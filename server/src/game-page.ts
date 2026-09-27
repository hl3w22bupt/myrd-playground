/**
 * 《复刻天天酷跑》(game-6) 游戏落地页（伺服于 /）。
 *
 * 与 Godot 默认壳的差异：所有二进制资产必须经 M1 文本网关中转 ——
 * 页面先从 api/public/assets/* 拉 base64 文本，还原出 wasm/pck 真实字节，
 * 再 monkeypatch window.fetch 拦截引擎对 index.wasm / index.pck 的请求，
 * 用内存字节构造 Response 返回（引擎内部的 fetch 调用无感知）。
 * audio worklet 走 AudioWorklet.addModule（浏览器内部加载，不经 window.fetch），
 * 单独补丁把相对文件名改写到 api/public/assets/ 下。
 *
 * 注意：页面里拉资源的路径一律不带前导斜杠（相对路径），
 * 经公网入口 /apps/game-6 访问时才能解析到网关子路径。
 *
 * 移动端音频手势解锁器（脚本最前段，必须先于引擎加载安装）：
 * iOS/Android WebKit 的 AudioContext 创建即 suspended、打断后 interrupted（引擎不识别），
 * 引擎只在自身输入回调里 resume —— 缺壳页兜底 = 移动端无声而桌面正常。
 * 实现：包 AudioContext 构造器捕获实例 + document 级手势监听内同步 resume
 * （capture+passive 不消费事件）+ window.__audioDebug() 真机取证出口。
 * 根因取证与修复方案：games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md（F1 手势解锁 / F2 worklet 防御）。
 *
 * 调参桥（工坊 §3C 硬契约，同样必须先于引擎加载）：
 * URL 参数 ?tuning={"key":value,...} → JSON.parse 校验为普通对象 → window.__GAME_TUNING__。
 * 游戏侧 GameState._apply_web_shell_tuning() 启动时经 JavaScriptBridge 读取，
 * 只应用 TUNING_META 声明的键并按 min/max 钳制 —— 试玩调好的参数可用 URL 复现。
 */
export const GAME_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">
<title>复刻天天酷跑</title>
<style>
html, body, #canvas { margin: 0; padding: 0; border: 0; }
body { color: #fff; background: #0e2a4a; overflow: hidden; touch-action: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
#canvas { display: block; width: 100vw; height: 100vh; }
#canvas:focus { outline: none; }
#boot { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(circle at 50% 30%, #3f8fd6 0%, #1f5b9e 50%, #123a63 100%); z-index: 10; transition: opacity .4s; }
#boot.hidden { opacity: 0; pointer-events: none; }
#boot h1 { margin: 0; font-size: 2rem; letter-spacing: .14em; color: #ffe9a8;
  text-shadow: 0 3px 0 #d97a1e, 0 0 20px rgba(255,190,80,.5); }
#boot .sub { color: #cfe6ff; font-size: .85rem; margin-top: -10px; }
#bar-wrap { width: min(420px, 70vw); height: 14px; border-radius: 999px; background: #173b63; overflow: hidden; border: 1px solid #2f6ca8; }
#bar { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #ffd166, #ff8c42, #4ecdc4); transition: width .2s; }
#boot-msg { color: #a8c8e8; font-size: .8rem; }
#hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 5;
  color: #d8ecff; background: rgba(10,32,58,.72); border: 1px solid #2f6ca8; border-radius: 999px;
  padding: 6px 16px; font-size: 12px; letter-spacing: .05em; pointer-events: none; }
#boot kbd { background: #1f4a7a; border: 1px solid #4d8ac4; border-bottom-width: 2px; border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: .92em; color: #ffe9a8; }
#keys { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; color: #b9d6f2; font-size: .82rem; }
</style>
</head>
<body>
<canvas id="canvas">你的浏览器不支持 canvas。</canvas>
<div id="boot">
  <h1>复刻天天酷跑</h1>
  <div class="sub">Tian Tian Ku Pao · MyRD 小游戏工坊 · game-6</div>
  <div id="bar-wrap"><div id="bar"></div></div>
  <div id="boot-msg">正在准备跑道…</div>
  <div id="keys"><span><kbd>↑ / 空格</kbd> 跳跃 / 二段跳</span><span><kbd>↓</kbd> 滑铲</span><span><kbd>R</kbd> 重新开始</span><span>触屏：点按/上滑=跳跃 · 下滑=滑铲</span></div>
</div>
<div id="hint" style="display:none">↑/空格 跳跃(可二段) · ↓ 滑铲 · R 重开 · 触屏点按/上滑跳、下滑铲</div>
<noscript>你的浏览器不支持 JavaScript。</noscript>
<!-- 引擎引导脚本由启动脚本按 BASE_PATH 动态注入（静态 src 在无尾斜杠入口下会 404） -->
<script>
(function () {
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

  // ---- 调参桥（§3C，先于引擎加载）：URL ?tuning=<JSON对象> → window.__GAME_TUNING__ ----
  // 游戏侧 GameState 启动时读取并经 apply_tuning 应用（只认 TUNING_META 键、按 min/max 钳制）。
  try {
    var tuningRaw = new URLSearchParams(location.search).get('tuning');
    if (tuningRaw) {
      var parsed = JSON.parse(tuningRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        window.__GAME_TUNING__ = parsed;
      }
    }
  } catch (e) { /* 非法 tuning 参数按未传处理，默认 spec 数值兜底 */ }

  // 资产基路径：公网入口 /apps/game-6（无尾斜杠）下，裸相对路径会解析到 /apps/*（网关 404）。
  // 以页面路径推导：/apps/game-6 → /apps/game-6/ → /apps/game-6/api/public/assets/*。
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
  // addModule 的 promise 无 .catch，失败即全部事件音静默且几乎无报错。故：真实 URL 优先，
  // 失败降级原路径重试一次，仍失败显式 console.error。
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
          console.error('[game6-shell] audio worklet 资产通道加载失败，降级原路径重试', file, err);
          audioLog.push({ t: Date.now(), state: 'worklet-fallback:' + file });
          return origAddModule.call(self, url, options).catch(function (err2) {
            console.error('[game6-shell] audio worklet 兜底加载也失败（移动端将无声）', file, err2);
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
      .then(function (b) { wasmBytes = b; setBar(0.85); msg.textContent = '引擎就绪，热身起跑…'; }),
    fetchAsset('index.pck.gz.b64').then(function (b64) { return gunzip(b64ToBytes(b64)); })
      .then(function (b) { pckBytes = b; setBar(0.95); })
  ]); }).then(function () {
    if (!WebAssembly.validate(wasmBytes)) throw new Error('wasm 校验失败（传输可能被破坏）');
    // 拦截引擎对 wasm/pck 的 fetch，返回内存中的真实字节
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

/**
 * 《线上抓娃娃机》(game-11) 自定义游戏落地页（伺服于 /）。
 *
 * 与 Godot 默认壳的差异：所有二进制资产必须经 M1 文本网关中转 ——
 * 页面先从 api/public/assets/* 拉 base64 文本，还原出 wasm/pck 真实字节，
 * 再 monkeypatch window.fetch 拦截引擎对 index.wasm / index.pck 的请求，
 * 用内存字节构造 Response 返回（引擎内部的 fetch 调用无感知）。
 * audio worklet 走 AudioWorklet.addModule（浏览器内部加载，不经 window.fetch），
 * 单独补丁把相对文件名改写到 api/public/assets/ 下。
 *
 * 注意：页面里拉资源的路径一律不带前导斜杠（相对路径），
 * 经公网入口 /apps/game-11 访问时才能解析到网关子路径。
 *
 * 移动端音频手势解锁器（脚本最前段，必须先于引擎加载安装）：
 * iOS/Android WebKit 的 AudioContext 创建即 suspended、打断后 interrupted（引擎不识别），
 * 引擎只在自身输入回调里 resume —— 缺壳页兜底 = 移动端无声而桌面正常。
 * 实现：包 AudioContext 构造器捕获实例 + document 级手势监听内同步 resume
 * （capture+passive 不消费事件）+ window.__audioDebug() 真机取证出口。
 * 根因取证与修复方案：games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md（F1 手势解锁 / F2 worklet 防御）。
 *
 * 调参桥（§3C 调参工作台硬契约）：引擎加载前把 URL ?tuning=<urlencoded JSON>
 * 解析进 window.__GAME_TUNING__；游戏侧 GameState._apply_web_tuning() 启动时读入，
 * 只认 TUNING_META 声明的键并按 min/max 钳制。缺这一层 = 试玩调好的参数无法用 URL 复现。
 */
export const GAME_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">
<title>线上抓娃娃机</title>
<style>
html, body, #canvas { margin: 0; padding: 0; border: 0; }
body { color: #fff; background: #101426; overflow: hidden; touch-action: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
#canvas { display: block; width: 100vw; height: 100vh; }
#canvas:focus { outline: none; }
#boot { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(circle at 50% 30%, #28356b 0%, #1a2145 55%, #0d1024 100%); z-index: 10; transition: opacity .4s; }
#boot.hidden { opacity: 0; pointer-events: none; }
#boot h1 { margin: 0; font-size: 2rem; letter-spacing: .14em; color: #ffe9a8;
  text-shadow: 0 2px 0 #b4541e, 0 0 20px rgba(255,180,80,.5); }
#boot .sub { color: #9fb0e0; font-size: .85rem; margin-top: -10px; }
#bar-wrap { width: min(420px, 70vw); height: 14px; border-radius: 999px; background: #1c2547; overflow: hidden; border: 1px solid #3d4f8f; }
#bar { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #ffb347, #ff6f91, #7ae0c3); transition: width .2s; }
#boot-msg { color: #8fa0d0; font-size: .8rem; }
#hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 5;
  color: #d7e0ff; background: rgba(16,22,48,.75); border: 1px solid #31407c; border-radius: 999px;
  padding: 6px 16px; font-size: 12px; letter-spacing: .05em; pointer-events: none; }
#boot kbd { background: #26325e; border: 1px solid #4a5da8; border-bottom-width: 2px; border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: .92em; color: #ffe9a8; }
#keys { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; color: #9fb0e0; font-size: .82rem; max-width: 90vw; }
</style>
</head>
<body>
<!-- canvas 由启动脚本在引擎就绪时创建（id=canvas）：启动本身耗时数秒（wasm 编译/着色器编译），
     提前挂载会让自动化验收在引擎仍处启动 stall 时采样（画面冻结/触摸无响应假阴性）。
     引擎库在 start() 时取文档第一个 <canvas>，动态创建等价于静态声明。 -->
<div id="boot">
  <h1>线上抓娃娃机</h1>
  <div class="sub">3D 抓娃娃 · 多种夹爪 × 多种娃娃 · MyRD 小游戏工坊</div>
  <div id="bar-wrap"><div id="bar"></div></div>
  <div id="boot-msg">正在准备机台…</div>
  <div id="keys"><span><kbd>←↑↓→ / 摇杆</kbd> 移动爪子</span><span><kbd>空格</kbd> 下爪</span><span><kbd>Tab</kbd> 切换爪型</span><span><kbd>拖动画面</kbd> 环绕视角</span></div>
</div>
<div id="hint" style="display:none">方向键/摇杆移动 · 空格下爪 · Tab 切爪型 · 拖动转视角</div>
<noscript>你的浏览器不支持 JavaScript。</noscript>
<!-- 引擎引导脚本由启动脚本按 BASE_PATH 动态注入（静态 src 在无尾斜杠入口下会 404） -->
<script>
(function () {
  // ---- 调参桥（硬契约：必须在引擎加载之前解析进全局）----
  // ?tuning=<urlencoded JSON> → window.__GAME_TUNING__；游戏侧 GameState 启动时读它覆盖调参区数值
  //（只认 TUNING_META 声明的键、按 min/max 钳制）。解析失败静默跳过，不影响正常启动。
  var rawTuning = null;
  try { rawTuning = new URLSearchParams(location.search).get('tuning'); } catch (e) { /* 老内核无 URLSearchParams */ }
  if (rawTuning) {
    try {
      var t = JSON.parse(rawTuning);
      if (t && typeof t === 'object' && !Array.isArray(t)) window.__GAME_TUNING__ = t;
    } catch (e) { /* 非法 JSON：忽略，用游戏内默认值 */ }
  }

  // ---- 像素密度钳制（必须在引擎加载前生效）----
  // 引擎画布后备存储 = CSS 尺寸 × devicePixelRatio：DPR=3 时 390×844 视口会得到
  // 1170×2532 ≈ 295 万像素的帧缓冲，WebGL 软渲染（swiftshader）与低端移动 GPU 每帧
  // 光栅化负担约为 DPR=1 的 9 倍 —— 实测 3fps（门禁阈值 8）。钳到 1 后 390×844 ≈ 33 万像素，
  // 帧率恢复到软渲染可用区间；真机中低端设备同样受益（功耗/发热下降）。
  // 实现注意：devicePixelRatio 是 getter，须用 defineProperty 覆盖；引擎在画布尺寸计算
  // （GodotDisplayScreen.getPixelRatio）与每次 resize 时读取，统一拿到钳制值。
  try {
    var CAPPED_DPR = 1;
    var nativeDpr = Number(window.devicePixelRatio) || 1;
    var cappedDpr = Math.min(nativeDpr, CAPPED_DPR);
    Object.defineProperty(window, 'devicePixelRatio', {
      get: function () { return cappedDpr; },
      configurable: true,
    });
  } catch (e) { /* 极老内核 defineProperty 失败：保持原生 DPR，只损失帧率 */ }

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
  // ③ 真机取证出口（移动端门禁音频契约机判此函数存在）
  window.__audioDebug = function () {
    return { state: audioCtx ? audioCtx.state : 'no-ctx', addModules: audioAddModules, log: audioLog };
  };
  // 资产基路径：公网入口 /apps/game-11（无尾斜杠）下，裸相对路径会解析到 /apps/*（网关 404）。
  // 以页面路径推导：/apps/game-11 → /apps/game-11/ → /apps/game-11/api/public/assets/*。
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
  // 故：真实 URL 优先，失败降级原路径重试一次，仍失败显式 console.error。
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
          console.error('[claw-shell] audio worklet 资产通道加载失败，降级原路径重试', file, err);
          audioLog.push({ t: Date.now(), state: 'worklet-fallback:' + file });
          return origAddModule.call(self, url, options).catch(function (err2) {
            console.error('[claw-shell] audio worklet 兜底加载也失败（移动端将无声）', file, err2);
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
  setBar(0.15);
  loadEngine().then(function () { setBar(0.4); msg.textContent = '下载游戏资源…'; return Promise.all([
    fetchAsset('index.wasm.gz.b64').then(function (b64) { return gunzip(b64ToBytes(b64)); })
      .then(function (b) { wasmBytes = b; setBar(0.85); msg.textContent = '引擎就绪，装载机台…'; }),
    fetchAsset('index.pck.gz.b64').then(function (b64) { return gunzip(b64ToBytes(b64)); })
      .then(function (b) { pckBytes = b; setBar(0.95); })
  ]); }).then(function () {
    if (!WebAssembly.validate(wasmBytes)) throw new Error('wasm 校验失败（传输可能被破坏）');
    // 引擎就绪才挂载画布：引擎库 start() 时取文档第一个 <canvas>，找不到会抛
    // 'No canvas found in page' —— 在 startGame 前创建等价于静态声明（见 body 注释）。
    var canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    document.body.insertBefore(canvas, document.getElementById('boot'));
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

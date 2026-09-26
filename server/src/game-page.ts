/**
 * 《星尘收集者》自定义游戏落地页（伺服于 /）。
 *
 * 与 Godot 默认壳的差异：所有二进制资产必须经 M1 文本网关中转 ——
 * 页面先从 api/public/assets/* 拉 base64 文本，还原出 wasm/pck 真实字节，
 * 再 monkeypatch window.fetch 拦截引擎对 index.wasm / index.pck 的请求，
 * 用内存字节构造 Response 返回（引擎内部的 fetch 调用无感知）。
 * audio worklet 走 AudioWorklet.addModule（浏览器内部加载，不经 window.fetch），
 * 单独补丁把相对文件名改写到 api/public/assets/ 下。
 *
 * 注意：页面里拉资源的路径一律不带前导斜杠（相对路径），
 * 经公网入口 /apps/game-2 访问时才能解析到网关子路径。
 *
 * 调参桥（§3C 调参工作台硬契约，必须在引擎加载前安装）：
 * 把 URL 参数 `?tuning=<json>` 解析进 window.__GAME_TUNING__，
 * 游戏侧 TuningPanel.parse_tuning_query / apply_parsed_tuning 消费 URL 里的
 * key=value 候选数值（只认 TUNABLE_KEYS 声明的键、按 KEY_RANGES 钳制）
 * —— 缺这一层 = 试玩调好的参数无法用 URL 复现，调参回写流程断裂。
 *
 * 移动端音频手势解锁器（脚本最前段，必须先于引擎加载安装）：
 * iOS/Android WebKit 的 AudioContext 创建即 suspended、打断后 interrupted（引擎不识别），
 * 引擎只在自身输入回调里 resume —— 缺壳页兜底 = 移动端无声而桌面正常。
 * 实现：包 AudioContext 构造器捕获实例 + document 级手势监听内同步 resume
 * （capture+passive 不消费事件）+ window.__audioDebug() 真机取证出口。
 * 根因取证与修复方案：games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md（F1 手势解锁 / F2 worklet 防御）。
 */
export const GAME_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">
<title>星尘收集者</title>
<style>
html, body, #canvas { margin: 0; padding: 0; border: 0; }
body { color: #e8f4ff; background: #050a1c; overflow: hidden; touch-action: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
#canvas { display: block; width: 100vw; height: 100vh; }
#canvas:focus { outline: none; }
#boot { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(circle at 50% 30%, #12306b 0%, #0a1a3f 55%, #050a1c 100%); z-index: 10; transition: opacity .4s; }
#boot.hidden { opacity: 0; pointer-events: none; }
#boot h1 { margin: 0; font-size: 2rem; letter-spacing: .14em; color: #aee6ff;
  text-shadow: 0 2px 0 #1c5f9e, 0 0 18px rgba(120,200,255,.55); }
#boot .sub { color: #8fa8cf; font-size: .85rem; margin-top: -10px; }
#bar-wrap { width: min(420px, 70vw); height: 14px; border-radius: 999px; background: #0d2148; overflow: hidden; border: 1px solid #2b5f9e; }
#bar { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #7ae0ff, #a78bfa, #ffd166); transition: width .2s; }
#boot-msg { color: #7f95bd; font-size: .8rem; }
#hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 5;
  color: #b9d4f2; background: rgba(10,22,48,.72); border: 1px solid #24487f; border-radius: 999px;
  padding: 6px 16px; font-size: 12px; letter-spacing: .05em; pointer-events: none; }
#boot kbd { background: #12295a; border: 1px solid #2f6bb0; border-bottom-width: 2px; border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: .92em; color: #aee6ff; }
#keys { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; color: #8fa8cf; font-size: .82rem; }
</style>
</head>
<body>
<canvas id="canvas">你的浏览器不支持 canvas。</canvas>
<div id="boot">
  <h1>星尘收集者</h1>
  <div class="sub">Star Dust Collector · MyRD 小游戏工坊</div>
  <div id="bar-wrap"><div id="bar"></div></div>
  <div id="boot-msg">正在点亮星图…</div>
  <div id="keys"><span><kbd>WASD</kbd>/<kbd>←↑↓→</kbd> 驾驶飞船</span><span><kbd>空格</kbd>/<kbd>回车</kbd> 确认 / 重开</span><span>触屏：虚拟摇杆</span></div>
</div>
<div id="hint" style="display:none">收集星尘 +1 分 · 撞陨石 -1 护盾 · 护盾耗尽本局结束</div>
<noscript>你的浏览器不支持 JavaScript。</noscript>
<!-- 引擎引导脚本由启动脚本动态注入（静态 src 在无尾斜杠入口下会 404） -->
<script>
(function () {
  // ---- 调参桥（§3C 硬契约：必须先于引擎加载，游戏侧 GameConfig 启动时消费）----
  var tuningApplied = false;
  var tuningRaw = new URLSearchParams(location.search).get('tuning');
  if (tuningRaw) {
    try {
      var t = JSON.parse(tuningRaw);
      if (t && typeof t === 'object' && !Array.isArray(t)) { window.__GAME_TUNING__ = t; tuningApplied = true; }
    } catch (e) { /* 非法 JSON：静默忽略，游戏用内置/配置数值 */ }
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
  // 打断再解锁：WebKit 在锁屏/来电后即使回前台也可能停在 interrupted，多给一次恢复机会
  //（非手势路径可能被拒，被拒即无操作；真正兜底仍是用户下一次点按）。
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) unlockAudio();
  }, { passive: true });
  // ③ 真机取证出口：手机上打开控制台不便，全部观测收敛到一个函数。
  window.__audioDebug = function () {
    return { state: audioCtx ? audioCtx.state : 'no-ctx', addModules: audioAddModules, log: audioLog };
  };

  // 资产基路径：公网入口 /apps/game-2（无尾斜杠）下，裸相对路径会解析到 /apps/*（网关 404）。
  // 以页面路径推导：/apps/game-2 → /apps/game-2/ → /apps/game-2/api/public/assets/*。
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
  // F2 防御（MOBILE_AUDIO_ROOT_CAUSE.md）：worklet 是音频单一故障点 —— addModule 的
  // promise 无 .catch，失败即全部事件音静默且几乎无报错。故：真实 URL 优先，
  // 失败降级原路径重试一次，仍失败显式 console.error。
  if (window.AudioWorkletNode && window.AudioWorklet && AudioWorklet.prototype.addModule) {
    var origAddModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = function (url, options) {
      var self = this;
      var file = '';
      try { file = String(url).split('/').pop().split('?')[0]; } catch (e) { /* 保原路径 */ }
      if (/\\.worklet\\.js$/.test(file)) {
        audioAddModules += 1;
        audioLog.push({ t: Date.now(), state: 'worklet:' + file });
        var realUrl = BASE_PATH + 'api/public/assets/' + file;
        return origAddModule.call(self, realUrl, options).catch(function (err) {
          console.error('[stardust-shell] audio worklet 资产通道加载失败，降级原路径重试', file, err);
          audioLog.push({ t: Date.now(), state: 'worklet-fallback:' + file });
          return origAddModule.call(self, url, options).catch(function (err2) {
            console.error('[stardust-shell] audio worklet 兜底加载也失败（移动端将无声）', file, err2);
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
      .then(function (b) { wasmBytes = b; setBar(0.85); msg.textContent = '引擎就绪，穿越陨石带…'; }),
    fetchAsset('index.pck.gz.b64').then(function (b64) { return gunzip(b64ToBytes(b64)); })
      .then(function (b) { pckBytes = b; setBar(0.95); })
  ]); }).then(function () {
    if (!WebAssembly.validate(wasmBytes)) throw new Error('wasm 校验失败（传输可能被破坏）');
    // 拦截引擎对 wasm/pck 的 fetch，返回内存中的真实字节（WebAssembly.instantiate 走字节缓冲，
    // 不用 instantiateStreaming —— 它要求 application/wasm，M1 文本网关给不了）。
    var realFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var file = url.split('/').pop().split('?')[0];
      if (file === 'index.wasm') return Promise.resolve(new Response(wasmBytes));
      if (file === 'index.pck') return Promise.resolve(new Response(pckBytes));
      return realFetch(input, init);
    };
    setBar(1);
    if (tuningApplied) console.info('[stardust-shell] 调参桥已注入 window.__GAME_TUNING__（' + Object.keys(window.__GAME_TUNING__).length + ' 项）');
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

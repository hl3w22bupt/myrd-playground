/**
 * 自定义游戏落地页（伺服于 /）——《我被ai女友包围了》剧情生存挑战。
 *
 * 与 Godot 默认壳的差异：所有二进制资产必须经 M1 文本网关中转 ——
 * 页面先从 api/public/assets/* 拉 base64 文本，还原出 wasm/pck 真实字节，
 * 再 monkeypatch window.fetch 拦截引擎对 index.wasm / index.pck 的请求，
 * 用内存字节构造 Response 返回（引擎内部的 fetch 调用无感知）。
 * audio worklet 走 AudioWorklet.addModule（浏览器内部加载，不经 window.fetch），
 * 单独补丁把相对文件名改写到 api/public/assets/ 下。
 *
 * 注意：页面里拉资源的路径一律不带前导斜杠（相对路径），
 * 经公网入口 /apps/ai 访问时才能解析到网关子路径。
 */
export const GAME_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">
<title>我被ai女友包围了</title>
<style>
html, body, #canvas { margin: 0; padding: 0; border: 0; }
body { color: #fff; background: #0b0e1a; overflow: hidden; touch-action: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
#canvas { display: block; width: 100vw; height: 100vh; }
#canvas:focus { outline: none; }
#boot { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: radial-gradient(circle at 50% 30%, #1d2b5c 0%, #141a38 55%, #0b0e1a 100%); z-index: 10; transition: opacity .4s; }
#boot.hidden { opacity: 0; pointer-events: none; }
#boot h1 { margin: 0; font-size: 1.9rem; letter-spacing: .1em; color: #d7e2ff;
  text-shadow: 0 2px 0 #2c3f8f, 0 0 18px rgba(120,150,255,.5); }
#boot .sub { color: #a6b4d8; font-size: .85rem; margin-top: -10px; }
#bar-wrap { width: min(420px, 70vw); height: 14px; border-radius: 999px; background: #1a2247; overflow: hidden; border: 1px solid #2f3f86; }
#bar { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #7a9bff, #b07aff, #6ee7d0); transition: width .2s; }
#boot-msg { color: #8c9cc0; font-size: .8rem; }
#hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 5;
  color: #b8c4ea; background: rgba(12,18,44,.72); border: 1px solid #26336f; border-radius: 999px;
  padding: 6px 16px; font-size: 12px; letter-spacing: .05em; pointer-events: none; }
#boot kbd { background: #1c2650; border: 1px solid #3c4f9c; border-bottom-width: 2px; border-radius: 5px; padding: 1px 7px; font-family: inherit; font-size: .92em; color: #d7e2ff; }
#keys { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; color: #a6b4d8; font-size: .82rem; }
</style>
</head>
<body>
<canvas id="canvas">你的浏览器不支持 canvas。</canvas>
<div id="boot">
  <h1>我被ai女友包围了</h1>
  <div class="sub">剧情生存挑战 · 2036 · MyRD 小游戏工坊</div>
  <div id="bar-wrap"><div id="bar"></div></div>
  <div id="boot-msg">正在唤醒 AI 女友们…</div>
  <div id="keys"><span><kbd>WASD / ←↑↓→</kbd> 移动</span><span><kbd>空格 / 回车</kbd> 对话推进 / 确认</span><span><kbd>1-4</kbd> 剧情选项</span></div>
</div>
<div id="hint" style="display:none">WASD/方向键 移动 · 空格/回车 对话推进 · 1-4 剧情选项 · 好感/威胁/生存决定结局</div>
<noscript>你的浏览器不支持 JavaScript。</noscript>
<!-- 引擎引导脚本由启动脚本按 BASE_PATH 动态注入（静态 src 在无尾斜杠入口下会 404） -->
<script>
(function () {
  // 资产基路径：公网入口 /apps/ai（无尾斜杠）下，裸相对路径会解析到 /apps/*（网关 404）。
  // 以页面路径推导：/apps/ai → /apps/ai/ → /apps/ai/api/public/assets/*。
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
  if (window.AudioWorkletNode && window.AudioWorklet && AudioWorklet.prototype.addModule) {
    var origAddModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = function (url, options) {
      try {
        var file = String(url).split('/').pop().split('?')[0];
        if (/\\.worklet\\.js$/.test(file)) {
          return origAddModule.call(this, BASE_PATH + 'api/public/assets/' + file, options);
        }
      } catch (e) { /* 保持原路径 */ }
      return origAddModule.call(this, url, options);
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
      .then(function (b) { wasmBytes = b; setBar(0.85); msg.textContent = '引擎就绪，装载剧情…'; }),
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
      // 壳层 DOM 遮挡契约（知识库 649e691d §三）：#hint 是布局的参与者，不是旁观者。
      // 触屏设备没有键盘，按键提示无意义；移动端窄视口下常显会换行到 3 行、
      // 压住对话选项文字（QA 复核实测重叠 3200px²）——触屏直接不显示；
      // 桌面（指针精细、无触摸会话）保留提示，宽视口一行放下、不与选项区重叠。
      // 判定三信号并集：maxTouchPoints>1（多数手机）∪ ontouchstart（触屏会话已建立；
      // Playwright iPhone 仿真与部分单点触控设备该指标 maxTouchPoints=1，实测探针）
      // ∪ pointer:coarse（触屏为主的标准媒体查询）。桌面 Chrome（pointer:fine、
      // 无 ontouchstart）三者皆假 → 提示保留，桌面零回归。
      var isTouch = (navigator.maxTouchPoints || 0) > 1
        || 'ontouchstart' in window
        || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (hint) hint.style.display = isTouch ? 'none' : 'block';
    }, fail);
  }).catch(fail);
})();
</script>
</body>
</html>
`;

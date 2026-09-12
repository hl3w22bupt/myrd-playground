/**
 * 《Soccer》游戏壳页面 —— AppHost 落地页（GET /）。
 *
 * 浏览器侧引导流程（M1 网关只透传文本响应，二进制资产以 base64 文本回传）：
 *   1. 手势解锁器先行（v2.1 F1）：包一层 AudioContext 构造器捕获引擎实例，
 *      document 级手势事件（touchstart/touchend/pointerdown/keydown/click，
 *      capture+passive）内同步 ctx.resume()，覆盖 suspended 与 WebKit interrupted；
 *   2. 探测资产通道（api/public/info）；资产 URL 按页面 pathname 推导子路径前缀
 *      （/apps/soccer 页面上 'api/…' 相对路径会解析到 /apps/api/… 而 404，
 *       根绝对 '/api/…' 会脱离网关子路径；必须用 '/apps/soccer/api/public/…' 形态）；
 *   3. 拉取 index.wasm / index.pck（gzip+b64）→ base64 → DecompressionStream 解压；
 *   4. 拉取音频 worklet（raw 文本）备 Blob 兜底；addModule 补丁改走资产通道
 *      真实 URL（v2.1 F2，旧 iOS/WebView 上 Blob URL 是已知风险形态），失败降级 Blob；
 *   5. 补丁 window.fetch（内存伺服 wasm/pck 的合成 Response，MIME 正确）；
 *   6. 注入引擎脚本 index.js（Blob URL <script>），mainPack 直传 pck 字节启动引擎。
 *
 * 注意：Godot 引擎的 Emscripten 配置硬编码了 instantiateWasm/locateFile，
 * 因此必须用 fetch 补丁提供带正确 MIME 的合成 Response（instantiateStreaming 对
 * 合成 Response 正常工作），而不是指望 locateFile 重定向。
 *
 * 移动端无声根因取证与修复清单：games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md。
 */

/** 壳页面 HTML（注意：内容里不得出现反引号与 ${}，避免破坏 TS 模板字符串） */
export function renderShellPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Soccer · 11 人制足球</title>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0b3d1e; overflow: hidden; }
  #wrap { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
  #canvas { flex: 1 1 auto; width: 100%; min-height: 0; display: block; outline: none; touch-action: none; }
  #help {
    flex: 0 0 auto; padding: 6px 12px; text-align: center;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #d9ecd9; background: rgba(0, 0, 0, 0.55);
  }
  #help b { color: #ffe17d; font-weight: 600; }
  #loader {
    position: absolute; inset: 0; z-index: 10;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(160deg, #0b3d1e 0%, #116232 60%, #0a2f18 100%);
  }
  #loader.hide { display: none; }
  #loader .box { width: min(420px, 82vw); text-align: center; color: #eaf6ea;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  #loader .title { font-size: 28px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
  #loader .sub { font-size: 13px; color: #b7d8b7; margin-bottom: 26px; }
  #load-status { font-size: 14px; margin-bottom: 10px; min-height: 20px; }
  .bar { height: 8px; border-radius: 6px; background: rgba(255,255,255,0.16); overflow: hidden; }
  #load-bar { height: 100%; width: 0; border-radius: 6px; background: linear-gradient(90deg, #7be07b, #2fae5f); transition: width .18s ease; }
  #load-err { margin-top: 14px; font-size: 13px; color: #ffb0a0; white-space: pre-wrap; }
</style>
</head>
<body>
<div id="wrap">
  <canvas id="canvas" tabindex="0"></canvas>
  <div id="help">
    <b>WASD / 方向键</b> 移动 · <b>J</b> 传球 · <b>K</b> 射门 · <b>Q / Tab</b> 切换球员 ·
    <b>R</b> 重开 · <b>C</b> 难度 · <b>L</b> 时长 · <b>回车/空格</b> 确认
  </div>
  <div id="loader">
    <div class="box">
      <div class="title">Soccer</div>
      <div class="sub">11 人制足球 · Godot 4 Web</div>
      <div id="load-status">正在准备…</div>
      <div class="bar"><div id="load-bar"></div></div>
      <div id="load-err"></div>
    </div>
  </div>
</div>
<script>
(function () {
  'use strict';

  var elStatus = document.getElementById('load-status');
  var elBar = document.getElementById('load-bar');
  var elErr = document.getElementById('load-err');
  var elLoader = document.getElementById('loader');
  var canvas = document.getElementById('canvas');

  function setStatus(msg) { elStatus.textContent = msg; }
  function setFraction(p) { elBar.style.width = Math.max(0, Math.min(100, p)) + '%'; }
  function fail(msg) {
    elErr.textContent = msg;
    setStatus('加载失败');
    console.error('[soccer-shell]', msg);
  }

  // —— v2.1 F1：音频手势解锁器（移动端 WebKit 自动播放策略 · 主修复）——
  // iOS/Android WebKit 下 AudioContext 创建即 suspended，后台/来电/锁屏/静音键还会把
  // 状态打成 interrupted（引擎状态机不识别该态，见 qa/MOBILE_AUDIO_ROOT_CAUSE.md 疑点
  // 2/6）；引擎只在输入回调里 resume，且 GDScript 的「解锁」只是标志位。因此这里在引擎
  // 加载前包一层 AudioContext 构造器捕获实例，并在 document 级手势事件里同步 resume
  // （必须落在手势调用栈内 WebKit 才认）。
  var audioCtx = null;
  var audioEverUnlocked = false;
  var addModuleLog = [];
  window.__soccerAudioLog = [];
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext) {
    var WrappedAudioContext = function (options) {
      var ctx = new NativeAudioContext(options);
      audioCtx = ctx;
      try {
        ctx.addEventListener('statechange', function () {
          window.__soccerAudioLog.push({ t: Date.now(), state: ctx.state });
          if (ctx.state === 'running') {
            hideAudioHint();
          } else if (audioEverUnlocked) {
            showAudioHint();
          }
        });
      } catch (e) { /* 老内核不支持 statechange 监听时忽略 */ }
      return ctx;
    };
    WrappedAudioContext.prototype = NativeAudioContext.prototype;
    window.AudioContext = WrappedAudioContext;
  }

  // 幂等手势解锁：suspended / interrupted 两种非 running 态都 resume。
  function unlockAudio() {
    if (!audioCtx) { return; }
    if (audioCtx.state !== 'running') {
      try { audioCtx.resume(); } catch (e) { /* resume 被拒不阻塞游戏流程 */ }
    }
    audioEverUnlocked = true;
    hideAudioHint();
  }
  window.__soccerUnlock = unlockAudio;

  // 低成本 DOM 提示：被打断（interrupted / 后台回来仍非 running）时引导用户再点一下；
  // 下一次点按即被上面的手势监听解锁，提示随之隐藏。
  var elAudioHint = null;
  function showAudioHint() {
    if (!elAudioHint) {
      elAudioHint = document.createElement('div');
      elAudioHint.id = 'audio-hint';
      elAudioHint.textContent = '点一下屏幕恢复声音';
      elAudioHint.style.cssText = 'position:absolute;left:50%;bottom:44px;transform:translateX(-50%);'
        + 'z-index:20;padding:6px 14px;border-radius:16px;background:rgba(0,0,0,0.6);color:#ffe17d;'
        + 'font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;'
        + 'pointer-events:none;';
      document.getElementById('wrap').appendChild(elAudioHint);
    }
    elAudioHint.style.display = 'block';
  }
  function hideAudioHint() {
    if (elAudioHint) { elAudioHint.style.display = 'none'; }
  }

  // 手势监听面（capture + passive：只解锁不消费，不影响游戏自身的输入管线）。
  ['touchstart', 'touchend', 'pointerdown', 'keydown', 'click'].forEach(function (type) {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });

  // 打断恢复：回到前台若仍非 running，挂出「点一下屏幕恢复声音」提示。
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && audioEverUnlocked
        && audioCtx && audioCtx.state !== 'running') {
      showAudioHint();
    }
  });

  // 可观测性出口：引擎把音频故障全部吞掉（promise 无 catch、状态机丢 interrupted），
  // 真机取证靠这两个窗口（状态时序 + worklet 加载记录）。
  window.__soccerAudioDebug = function () {
    return {
      state: audioCtx ? audioCtx.state : 'no-ctx',
      addModules: addModuleLog,
      log: window.__soccerAudioLog,
    };
  };

  // —— 资产通道：按页面路径推导网关子路径前缀 ——
  // 公网入口是 /apps/soccer（网关会把带尾斜杠的 /apps/soccer/ 308 回无斜杠形态），
  // 因此不能直接用 'api/…' 相对路径（会解析到 /apps/api/… 而 404），
  // 也不能用根绝对路径 '/api/…'（会脱离网关子路径被登录墙拦下）。
  // 正确形态：保留当前子路径前缀 '/apps/soccer' + '/api/public/assets/…'（网关实测 200）；
  // 本地直达 '/' 时前缀为空串，得到 '/api/public/assets/…'，同样成立。
  var PATH_PREFIX = window.location.pathname;
  while (PATH_PREFIX.length > 1 && PATH_PREFIX.charAt(PATH_PREFIX.length - 1) === '/') {
    PATH_PREFIX = PATH_PREFIX.slice(0, -1);
  }
  if (PATH_PREFIX === '/') { PATH_PREFIX = ''; } // 本地直达根路径：前缀置空，避免拼出 '//api/…'
  var ASSET_BASE = PATH_PREFIX + '/api/public/assets/';
  var INFO_URL = PATH_PREFIX + '/api/public/info';

  function fetchText(url, label, onFraction) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        throw new Error(label + ' HTTP ' + res.status + '（资产通道未就绪或部署缺少 assets_dir）');
      }
      var total = Number(res.headers.get('Content-Length') || 0);
      if (!res.body || !total || !onFraction) { return res.text(); }
      var reader = res.body.getReader();
      var chunks = [];
      var received = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            var all = new Uint8Array(received);
            var off = 0;
            for (var i = 0; i < chunks.length; i++) { all.set(chunks[i], off); off += chunks[i].length; }
            return new TextDecoder('utf-8').decode(all);
          }
          chunks.push(r.value);
          received += r.value.length;
          onFraction((received / total) * 100);
          return pump();
        });
      }
      return pump();
    });
  }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return bytes;
  }

  function gunzip(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  function loadGzipAsset(name, label) {
    return fetchText(ASSET_BASE + name, label, function (p) { setFraction(p * 0.9); })
      .then(function (b64) { return b64ToBytes(b64); })
      .then(function (bytes) { return gunzip(bytes); });
  }

  function loadTextAsset(name, label) {
    return fetchText(ASSET_BASE + name, label, null);
  }

  // —— 内存伺服表：basename → { bytes, mime }；worklet：basename → Blob URL ——
  var memoryFiles = {};
  var workletUrls = {};

  function installFetchPatch() {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = '';
      try {
        url = typeof input === 'string' ? input : (input && input.url) || String(input);
      } catch (e) { url = ''; }
      var clean = url.split('?')[0].split('#')[0];
      var name = clean.slice(clean.lastIndexOf('/') + 1);
      var hit = memoryFiles[name];
      if (hit) {
        return Promise.resolve(new Response(new Blob([hit.bytes], { type: hit.mime }),
          { status: 200, headers: { 'Content-Type': hit.mime } }));
      }
      return origFetch(input, init);
    };
  }

  // v2.1 F2：worklet 加载弃用 Blob URL（旧 iOS/WebView 已知风险形态），已知 worklet
  // 改走资产通道真实 URL（同源直达 + CORS *，实测 text/javascript）；失败降级回
  // Blob 重试一次。Godot 对该 promise 无 .catch（position worklet 还门控全部 WAV
  // Sample 起播，见取证报告疑点 7），不在这里补日志/降级就是「静默死」。
  function installWorkletPatch() {
    if (!window.AudioWorklet || !window.AudioWorklet.prototype) { return; }
    var origAdd = window.AudioWorklet.prototype.addModule;
    if (typeof origAdd !== 'function') { return; }
    window.AudioWorklet.prototype.addModule = function (url) {
      var self = this;
      var name = String(url).split('/').pop().split('?')[0];
      var entry = { name: name, mode: 'passthrough', ok: false };
      addModuleLog.push(entry);
      var pending;
      if (workletUrls[name]) {
        entry.mode = 'url';
        pending = origAdd.call(self, ASSET_BASE + name).catch(function (err) {
          entry.mode = 'blob-fallback';
          console.warn('[soccer-shell] worklet 真实 URL 加载失败，降级 Blob 重试：', name, err);
          return origAdd.call(self, workletUrls[name]);
        });
      } else {
        pending = origAdd.apply(self, arguments);
      }
      return pending.then(function (result) {
        entry.ok = true;
        return result;
      }, function (err) {
        console.error('[soccer-shell] audio worklet 加载失败（事件音将静默，详见 __soccerAudioDebug）', name, err);
        throw err;
      });
    };
  }

  function probeAssetChannel() {
    return fetch(INFO_URL).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    }).then(function (info) {
      if (!info || info.assetStore !== true) {
        throw new Error('资产通道未配置（APPHOST_ASSET_* env 缺失）：本次部署未声明 assets_dir 或对象存储不可用。');
      }
    });
  }

  function loadEngineScript() {
    return loadTextAsset('index.js', '引擎脚本').then(function (text) {
      return new Promise(function (resolve, reject) {
        var blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
        var s = document.createElement('script');
        s.src = blobUrl;
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error('引擎脚本 index.js 加载失败')); };
        document.head.appendChild(s);
      });
    });
  }

  probeAssetChannel().then(function () {
    setStatus('正在下载引擎（约 10 MB，首次稍慢）…');
    setFraction(2);
    return loadGzipAsset('index.wasm', '引擎 wasm').then(function (wasmBytes) {
      memoryFiles['index.wasm'] = { bytes: wasmBytes, mime: 'application/wasm' };
      setFraction(92);

      setStatus('正在下载比赛数据…');
      return loadGzipAsset('index.pck', '比赛数据 pck').then(function (pckBytes) {
        memoryFiles['index.pck'] = { bytes: pckBytes, mime: 'application/octet-stream' };
        setFraction(95);

        setStatus('正在准备音频模块…');
        return Promise.all([
          loadTextAsset('index.audio.worklet.js', '音频模块').then(function (t) {
            workletUrls['index.audio.worklet.js'] =
              URL.createObjectURL(new Blob([t], { type: 'text/javascript' }));
          }),
          loadTextAsset('index.audio.position.worklet.js', '音频定位模块').then(function (t) {
            workletUrls['index.audio.position.worklet.js'] =
              URL.createObjectURL(new Blob([t], { type: 'text/javascript' }));
          }),
        ]);
      });
    }).then(function () {
      setFraction(97);
      installFetchPatch();
      installWorkletPatch();

      setStatus('正在初始化引擎…');
      return loadEngineScript().then(function () {
        setStatus('正在开球…');
        var godotConfig = {
          args: [],
          canvasResizePolicy: 2,
          emscriptenPoolSize: 8,
          ensureCrossOriginIsolationHeaders: false,
          executable: 'index',
          experimentalVK: false,
          focusCanvas: true,
          gdextensionLibs: [],
          godotPoolSize: 4,
        };
        var engine = new Engine(godotConfig);
        // mainPack 必须传字符串路径：引擎内部 copyToFS(path, buffer) + callMain(['--main-pack', path])
        // 都按字符串处理；pck 字节由上方 fetch 补丁从内存伺服（memoryFiles['index.pck']）。
        return engine.startGame({ mainPack: 'index.pck' });
      });
    }).then(function () {
      setFraction(100);
      elLoader.classList.add('hide');
      try { canvas.focus(); } catch (e) { /* 浏览器策略不允许时忽略 */ }
    });
  }).catch(function (err) {
    fail((err && err.message) ? err.message : '未知错误：游戏未能启动。');
  });
}());
</script>
</body>
</html>
`;
}

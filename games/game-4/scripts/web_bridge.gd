class_name WebBridge
extends RefCounted
## Web 桥助手：URL 参数解析、设备/音频信息采集、导出文本（iOS 系统分享 → 剪贴板 → 下载降级）。
##
## 全部经 JavaScriptBridge 与浏览器交互（仅 Web 平台可用）；非 Web 平台（含无头门禁）
## 一律返回「不可用」哨兵，绝不影响桌面/无头运行路径。
##
## 导出协议（qa=1 报告与四问量表共用）：
##   1) navigator.share({title, text}) —— iOS/Android 系统分享面板（iOS 15+ Safari 支持纯文本）；
##   2) navigator.clipboard.writeText    —— 剪贴板（需安全上下文；iOS 13.4+）；
##   3) textarea + execCommand('copy')   —— 老内核剪贴板兜底；
##   4) Blob + a[download]              —— 桌面下载兜底。
## 结果异步落 window.__GUANGLU_SHARE__，export_status() 轮询读取（JavaScriptBridge.eval 是同步调用，
## Promise 结果必须由壳页全局变量带回，不能当场拿）。
##
## 文本传参一律 base64：JSON 字符串直接内插进 JS 源码有 U+2028/引号转义坑，base64 无此问题。

const SHARE_GLOBAL: String = "window.__GUANGLU_SHARE__"


## 是否运行在 Web 导出环境（JavaScriptBridge 仅此环境可用）。
static func is_web() -> bool:
	return OS.has_feature("web")


## 解析 location.search 为 Dictionary（如 ?qa=1&tuning=1 → {"qa":"1","tuning":"1"}）。
## 非 Web / 解析失败返回空 Dictionary（调用方按「参数未传」处理，不报错）。
static func read_url_flags() -> Dictionary:
	if not is_web():
		return {}
	var raw: Variant = JavaScriptBridge.eval(
		"(function(){var o={};try{new URLSearchParams(location.search).forEach(function(v,k){o[k]=v;});}catch(e){}return JSON.stringify(o);})()",
		true)
	return _parse_json_dict(raw)


## 浏览器/设备信息（UA、DPR、屏幕、触摸点数、语言、并发核数等）——真机报告用。
static func device_info() -> Dictionary:
	if not is_web():
		return {"available": false}
	var raw: Variant = JavaScriptBridge.eval(
		"JSON.stringify({available:true,ua:navigator.userAgent,dpr:window.devicePixelRatio||1," +
		"screen:[screen.width,screen.height],viewport:[window.innerWidth,window.innerHeight]," +
		"touchPoints:navigator.maxTouchPoints||0,language:navigator.language||''," +
		"platform:navigator.platform||'',online:navigator.onLine,cores:navigator.hardwareConcurrency||0," +
		"tz:new Date().getTimezoneOffset(),ts:Date.now()})", true)
	return _parse_json_dict(raw)


## 壳页音频取证出口：window.__audioDebug() → {state, addModules, log}（壳页未注入时给 no-shell 哨兵）。
static func audio_debug() -> Dictionary:
	if not is_web():
		return {"available": false}
	var raw: Variant = JavaScriptBridge.eval(
		"JSON.stringify(window.__audioDebug ? window.__audioDebug() : {state:'no-shell',addModules:0,log:[]})",
		true)
	return _parse_json_dict(raw)


## 发起导出：返回即时选定的通道名（share / clipboard / legacy-copy / download / unavailable），
## 最终成败由 export_status() 轮询。内部把文本 base64 编码后注入，避免 JS 源码转义问题。
static func export_text(title: String, text: String) -> String:
	if not is_web():
		return "unavailable"
	var payload_b64: String = Marshalls.utf8_to_base64(text)
	var title_b64: String = Marshalls.utf8_to_base64(title)
	var js := """
(function(){
  var G = window;
  try {
    function b64ToText(b64){
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
    var text = b64ToText('%PAYLOAD%');
    var title = b64ToText('%TITLE%');
    G.__GUANGLU_SHARE__ = {channel:'', state:'started', error:''};
    function done(ch){ G.__GUANGLU_SHARE__.channel=ch; G.__GUANGLU_SHARE__.state='done'; }
    function fail(ch, err){ G.__GUANGLU_SHARE__.channel=ch; G.__GUANGLU_SHARE__.state='error'; G.__GUANGLU_SHARE__.error=String(err); }
    function legacyCopy(){
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        var ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) { done('legacy-copy'); return 'legacy-copy'; }
        return downloadFallback();
      } catch(e) { return downloadFallback(); }
    }
    function downloadFallback(){
      try {
        var blob = new Blob([text], {type:'application/json'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'guanglu-report.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        done('download'); return 'download';
      } catch(e) { fail('download', e); return 'download'; }
    }
    function clipboardPath(){
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function(){ done('clipboard'); },
            function(err){ fail('clipboard', err); legacyCopy(); });
          G.__GUANGLU_SHARE__.channel = 'clipboard';
          return 'clipboard';
        }
        return legacyCopy();
      } catch(e) { return legacyCopy(); }
    }
    if (navigator.share) {
      G.__GUANGLU_SHARE__.channel = 'share';
      navigator.share({title:title, text:text}).then(function(){ done('share'); }, function(err){
        if (err && err.name === 'AbortError') { done('share-aborted'); return; }
        clipboardPath();
      });
      return 'share';
    }
    return clipboardPath();
  } catch(e) {
    try { window.__GUANGLU_SHARE__ = {channel:'', state:'error', error:String(e)}; } catch(e2) {}
    return 'exception';
  }
})()
	""".replace("%PAYLOAD%", payload_b64).replace("%TITLE%", title_b64)
	var raw: Variant = JavaScriptBridge.eval(js, true)
	return str(raw) if raw != null else "unavailable"


## 轮询导出结果 → {channel, state: started|done|error, error}；未发起时 state=none。
static func export_status() -> Dictionary:
	if not is_web():
		return {"state": "none"}
	var raw: Variant = JavaScriptBridge.eval(
		"JSON.stringify(%s || {state:'none'})" % SHARE_GLOBAL, true)
	var status := _parse_json_dict(raw)
	return status if not status.is_empty() else {"state": "none"}


## 把 JSON 报告投到浏览器控制台（桌面联调取证口；生产路径不依赖它）。
static func log_to_console(tag: String, text: String) -> void:
	if not is_web():
		return
	var b64: String = Marshalls.utf8_to_base64(text)
	JavaScriptBridge.eval(
		"(function(){try{console.log('%s', new TextDecoder('utf-8').decode(Uint8Array.from(atob('%s'), function(c){return c.charCodeAt(0);})));}catch(e){}})()" % [tag, b64],
		true)


static func _parse_json_dict(raw: Variant) -> Dictionary:
	if typeof(raw) != TYPE_STRING or (raw as String).is_empty():
		return {}
	var parsed: Variant = JSON.parse_string(raw as String)
	return parsed as Dictionary if typeof(parsed) == TYPE_DICTIONARY else {}

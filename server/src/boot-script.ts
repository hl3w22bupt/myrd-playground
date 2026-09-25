/**
 * boot-script —— 注入落地页的浏览器端引导（stack-tower 壳专用）。
 *
 * M1 网关只透传文本（image/*、audio/*、octet-stream 一律 502），因此：
 *  1. 壳把二进制资产以 base64 文本回传（text/plain），本脚本在浏览器端还原真实字节；
 *  2. 补丁 window.fetch（游戏音频走 fetch → decodeAudioData）与 HTMLImageElement.src
 *     （贴图走 Image 加载，无法用 fetch 补丁覆盖）→ 统一转真实字节 / blob URL；
 *  3. <base href="api/public/assets/"> 让产物里的相对路径全部落到公开资产路由；
 *  4. 裸根入口（/apps/<slug>）自愈跳到正牌入口 /gw，保证相对路径解析正确。
 * 任一还原失败都回落原始路径（游戏资产层三态降级兜底，绝不抛错阻断循环）。
 */

/** 二进制扩展名：壳侧以 base64 文本回传，浏览器端还原 */
const BINARY_EXT_RE = /\.(png|m4a|ogg|wav|mp3|jpg|jpeg|webp)$/i;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

export const BOOT_SCRIPT = `
(function () {
  'use strict';
  var BIN = ${JSON.stringify(BINARY_EXT_RE.source)};
  var MIME = ${JSON.stringify(MIME_BY_EXT)};
  // 裸根入口自愈：相对路径只有在 /apps/<slug>/gw 目录形态下才能解析到公开资产路由
  if (!/\\/gw\\/?$/.test(location.pathname)) {
    location.replace(location.pathname.replace(/\\/+$/, '') + '/gw' + location.search);
    return;
  }
  function absOf(u) {
    try { return new URL(String(u), location.href); } catch (e) { return null; }
  }
  function mimeOf(pathname) {
    var m = pathname.match(/(\\.[a-z0-9]+)$/i);
    return (m && MIME[m[1].toLowerCase()]) || 'application/octet-stream';
  }
  function b64ToBytes(b64) {
    var clean = b64.replace(/\\s+/g, '');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function (input, init) {
      var abs = absOf(typeof input === 'string' || input instanceof URL ? input : (input && input.url) || '');
      if (!abs || !new RegExp(BIN, 'i').test(abs.pathname)) return origFetch(input, init);
      return origFetch(abs.href, init).then(function (res) {
        if (!res.ok) return res;
        return res.text().then(function (b64) {
          try {
            return new Response(b64ToBytes(b64), { status: res.status, headers: { 'Content-Type': mimeOf(abs.pathname) } });
          } catch (e) { return res; }
        });
      });
    };
  }
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (desc && desc.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        set: function (v) {
          var self = this;
          var abs = absOf(v);
          if (!abs || !new RegExp(BIN, 'i').test(abs.pathname)) { desc.set.call(self, v); return; }
          var settle = function (url) { try { desc.set.call(self, url); } catch (e) { desc.set.call(self, v); } };
          if (origFetch) {
            origFetch(abs.href).then(function (r) {
              if (!r.ok) throw new Error(String(r.status));
              return r.blob();
            }).then(function (blob) { settle(URL.createObjectURL(blob)); })
              .catch(function () { settle(v); });
          } else { settle(v); }
        },
        get: desc.get,
      });
    }
  } catch (e) { /* 不阻断 */ }
})();
`;

// privacy.ts — 微信小游戏隐私弹窗运行时（WX 提审轮驳回修复 · spec wx-submission-kit wk-acc-3）
//
// 谓词逐条落点（spec 原文定死）：
//   P1 触发时机：首启完成首帧渲染进入可交互状态后弹出 → requestShow()（首帧钩子）+
//      applyProbe()（wx.getPrivacySetting 回调）双条件齐才 visible；
//   P2 非阻断：拒绝不阻塞任何玩法入口 → 触摸走 wx.onTouch* 并行监听，卡片外 handleTap 返回
//      false（不消费，玩法入口照常收事件）；弹窗无任何 gate/await 面；
//   P3 状态落盘：同意/拒绝经 T1 storage 门面键制注册 → registerKey('privacy-consent') 后
//      经 facade get/set 读写（未注册键写入门面拒绝，与 ac-16 同纪律）；
//   P4 不作「开始玩」前置：弹窗出现不延迟/不拦截 main 装载（boot-wx 接线顺序保证）。
// 视觉规格单源：docs/platform/wx/privacy-popup-visual.md（三态 + 几何 + 色值；零新色，
//   仅 palette 冻结色 #C89C19 余烬金 + 深底中性面；零贴图，Canvas 程序化直绘）。
// 纪律：
//   ① 本件零内核 import；零随机数/系统时钟直调字面（含注释）；
//   ② 宿主/门面/几何全 DI，Node 侧测试用 fake，不依赖真实容器；
//   ③ 能力缺失一律降级不抛错（探针失败 = 不弹，保守不骚扰）；
//   ④ 二次启动已落盘 granted/denied → 不再弹；× 关闭 = 本局不落盘（保留后续再询问，
//      视觉稿态 1「关闭」口径）。
                                                   
import { PRIVACY_UI } from '../../render/theme.mjs';

/** hex(#RRGGBB) → rgba() 字符串（alpha 为表现参数；裸三元组零字面量，色值单源 theme） */
function hexToRgba(hex        , alpha        )         {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const PRIVACY_CONSENT_KEY = 'privacy-consent';
                                                  

/** T1 门面键制注册（storage.ts 纪律①：键由归属模块注册；幂等） */
export function registerPrivacyConsentKey(facade               )       {
  facade.registerKey(PRIVACY_CONSENT_KEY);
}

export function readPrivacyConsent(facade               )                        {
  const v = facade.get(PRIVACY_CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

export function writePrivacyConsent(facade               , value                )       {
  facade.set(PRIVACY_CONSENT_KEY, value);
}

// —— 视觉稿几何常量（privacy-popup-visual.md §二；参考画布 500×390 逻辑像素）——
export const PRIVACY_LAYOUT = {
  refWidth: 500,
  refHeight: 390,
  cardW: 440,
  cardH: 312,
  radius: 12,
  btnH: 44,
  btnGap: 12,
  closeR: 24,
  colors: {
    // 色值单源 = theme.PRIVACY_UI（e-renderer-ui-tokens.json privacy 段 · 视觉稿定稿收编）；
    // 遮罩 alpha 0.72 为表现参数（ac-11 扫描口径：alpha 不入色相语义面）。
    // 键缺失 = 生成链断裂，由 theme 单源门禁暴露，此处不做静默 fallback。
    get mask()         { return hexToRgba(PRIVACY_UI.mask, 0.72); },
    get cardBg()         { return PRIVACY_UI.cardBg; },
    get border()         { return PRIVACY_UI.border; },
    get title()         { return PRIVACY_UI.title; },
    get body()         { return PRIVACY_UI.body; },
    get btnOutline()         { return PRIVACY_UI.btnOutline; },
    get btnSolid()         { return PRIVACY_UI.btnSolid; },
    get btnSolidText()         { return PRIVACY_UI.btnSolidText; },
  },
  title: '隐私保护指引',
  body: '本游戏收集项：仅本地存储的静音与匿名标识，无网络上报。',
  more: '查看全文 ›',
  decline: '拒绝',
  agree: '同意',
};

                                                                                

                                 
                            
                                      
                      
                                                                      
                                               
                                                           
                                           
                                          
                                                                              
                                              
                                                   
                             
                                                                                                                     
                        
                  
 

/** 宿主注入面（DI）：仅隐私指引拉起能力；能力缺失静默降级（视觉稿 §二「查看全文」口径） */
                                
                                                               
                                                 
 

                                        
                                                   
                        
                                           
                              
 

/** 参考空间几何推导（弹窗居中；hitAreas 与 paint 同源，保证命中/绘制自洽） */
function layoutIn(width        , height        ) {
  const L = PRIVACY_LAYOUT;
  const scale = Math.min(1, width / L.refWidth, height / L.refHeight);
  const cw = L.cardW * scale;
  const ch = L.cardH * scale;
  const left = (width - cw) / 2;
  const top = (height - ch) / 2;
  const btnY = top + ch - 20 * scale - (L.btnH * scale) / 2;
  const btnW = (cw - 40 * scale - L.btnGap * scale) / 2;
  const decline                 = {
    cx: left + 20 * scale + btnW / 2,
    cy: btnY,
    w: btnW,
    h: L.btnH * scale,
  };
  const agree                 = {
    cx: left + cw - 20 * scale - btnW / 2,
    cy: btnY,
    w: btnW,
    h: L.btnH * scale,
  };
  const close                 = { cx: left + cw - 18 * scale, cy: top + 18 * scale, w: L.closeR * scale, h: L.closeR * scale };
  // 「查看全文」入口（视觉稿 §二 正文末）：命中区与 paint 同源（正文第二行位置，宽 110 逻辑像素）
  const more                 = { cx: left + 20 * scale + 55 * scale, cy: top + 108 * scale, w: 110 * scale, h: 28 * scale };
  return { scale, left, top, cw, ch, decline, agree, close, more };
}

const hit = (a                , x        , y        )          =>
  Math.abs(x - a.cx) <= a.w / 2 + 8 && Math.abs(y - a.cy) <= a.h / 2 + 8;

export function createWxPrivacyPopup(opts                       )                 {
  const facade = opts.facade;
  const host = opts.host ?? null;
  registerPrivacyConsentKey(facade);

  let visible = false;
  let frameReady = false;
  let probeDone = false;
  let probeNeedAuth = false;
  let vpW = PRIVACY_LAYOUT.refWidth;
  let vpH = PRIVACY_LAYOUT.refHeight;

  const maybeUpdate = ()       => {
    if (visible || !frameReady || !probeDone || !probeNeedAuth) return;
    if (readPrivacyConsent(facade) !== null) return; // 二次启动已落盘 → 不再弹
    visible = true;
  };

  const hitAreasCache = { decline: { cx: 0, cy: 0, w: 0, h: 0 }, agree: { cx: 0, cy: 0, w: 0, h: 0 }, close: { cx: 0, cy: 0, w: 0, h: 0 }, more: { cx: 0, cy: 0, w: 0, h: 0 } };
  const refreshHitAreas = ()       => {
    const g = layoutIn(vpW, vpH);
    hitAreasCache.decline = g.decline;
    hitAreasCache.agree = g.agree;
    hitAreasCache.close = g.close;
    hitAreasCache.more = g.more;
  };
  refreshHitAreas();

  return {
    get visible()          { return visible; },
    get hitAreas() { return hitAreasCache; },

    requestShow()       {
      frameReady = true;
      maybeUpdate();
    },

    applyProbe(needAuthorization         )       {
      probeDone = true;
      probeNeedAuth = needAuthorization === true;
      maybeUpdate();
    },

    handleTap(x        , y        )          {
      if (!visible) return false;
      const g = layoutIn(vpW, vpH);
      if (hit(g.agree, x, y)) {
        writePrivacyConsent(facade, 'granted');
        visible = false;
        return true;
      }
      if (hit(g.decline, x, y)) {
        writePrivacyConsent(facade, 'denied');
        visible = false;
        return true;
      }
      if (hit(g.close, x, y)) {
        visible = false; // ×：本局关闭不落盘（保留后续再询问）
        return true;
      }
      if (hit(g.more, x, y)) {
        // 「查看全文」：拉起平台《用户隐私保护指引》（官方 3.4.1 告知闭环）；能力缺失/抛错静默降级不阻塞
        try { host?.openPrivacyContract?.({}); } catch { /* 宿主能力缺失静默 */ }
        return true;
      }
      return false; // 卡片外/遮罩：不消费 → 玩法入口照常收事件（P2 非阻断）
    },

    setViewport(width        , height        )       {
      if (Number.isFinite(width) && width > 0) vpW = width;
      if (Number.isFinite(height) && height > 0) vpH = height;
      refreshHitAreas();
    },

    dismiss()       {
      visible = false;
    },

    paint(ctx, width, height)       {
      if (typeof width === 'number' && typeof height === 'number' && Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        vpW = width;
        vpH = height;
        refreshHitAreas();
      }
      if (!visible) return; // hidden 态零绘制调用（契约面）
      paintPopup(ctx, vpW, vpH);
    },
  };
}

// —— 绘制（Canvas 程序化直绘；视觉稿 §二 逐要素同源）——

function pathRoundedRect(ctx                          , x        , y        , w        , h        , r        )       {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function paintPopup(ctx                          , width        , height        )       {
  const L = PRIVACY_LAYOUT;
  const g = layoutIn(width, height);
  const c = L.colors;
  const s = g.scale;

  // 遮罩（点击遮罩不关闭——由 handleTap 不消费遮罩区保证；非阻断语义见 P2）
  ctx.fillStyle = c.mask;
  ctx.fillRect(0, 0, width, height);

  // 卡片
  pathRoundedRect(ctx, g.left, g.top, g.cw, g.ch, L.radius * s);
  ctx.fillStyle = c.cardBg;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1 * s);
  ctx.strokeStyle = c.border;
  ctx.stroke();

  // 标题（18px 加粗 顶部居中 距卡顶 20px）
  ctx.fillStyle = c.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(18 * s)}px sans-serif`;
  ctx.fillText(L.title, width / 2, g.top + 20 * s + 9 * s);

  // 正文（14px/22px 左对齐 内边距 20px）+ 查看全文入口
  ctx.textAlign = 'left';
  ctx.fillStyle = c.body;
  ctx.font = `${Math.round(14 * s)}px sans-serif`;
  const bodyX = g.left + 20 * s;
  const bodyY = g.top + 64 * s;
  wrapText(ctx, L.body, bodyX, bodyY, g.cw - 40 * s, 22 * s);
  ctx.fillText(L.more, bodyX, bodyY + 44 * s);

  // 按钮（左「拒绝」描边 · 右「同意」实心；高 44 圆角 8 间距 12）
  pathRoundedRect(ctx, g.decline.cx - g.decline.w / 2, g.decline.cy - g.decline.h / 2, g.decline.w, g.decline.h, 8 * s);
  ctx.strokeStyle = c.btnOutline;
  ctx.lineWidth = Math.max(1, 1 * s);
  ctx.stroke();
  ctx.fillStyle = c.body;
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(16 * s)}px sans-serif`;
  ctx.fillText(L.decline, g.decline.cx, g.decline.cy);

  pathRoundedRect(ctx, g.agree.cx - g.agree.w / 2, g.agree.cy - g.agree.h / 2, g.agree.w, g.agree.h, 8 * s);
  ctx.fillStyle = c.btnSolid;
  ctx.fill();
  ctx.fillStyle = c.btnSolidText;
  ctx.fillText(L.agree, g.agree.cx, g.agree.cy);

  // 右上角 ×（24px 命中区）
  ctx.fillStyle = c.btnOutline;
  ctx.font = `${Math.round(20 * s)}px sans-serif`;
  ctx.fillText('×', g.close.cx, g.close.cy);
}

function wrapText(ctx                          , text        , x        , y        , maxWidth        , lineHeight        )       {
  let line = '';
  let cursorY = y;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth) {
      ctx.fillText(line, x, cursorY);
      line = ch;
      cursorY += lineHeight;
    } else {
      line += ch;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}


//# sourceURL=platform/wx/privacy.ts
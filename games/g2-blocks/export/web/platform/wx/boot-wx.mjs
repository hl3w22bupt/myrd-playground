// boot-wx.ts — 微信小游戏装配入口（WX 提审轮 N2-P2）
//
// 顺序敏感：先装垫片（adapter），再动态 import main.ts（main 顶层即取 document.getElementById('stage')）。
// 纪律：
//   ① 本件零内核 import；核心逻辑零改动（main.ts 原样装载）；
//   ② 生命周期接线仅表现层：onShow 首触解锁音频（容器规范），onHide 无操作（rAF 由容器自动挂起）；
//   ③ 分享环接线仅被动通道（右上角菜单/转发同卡同参，ws-acc-4）：纯跳转零数值回调，失败静默不阻塞装载；
//   ④ 无 wx 容器 = 立即显式失败（本入口只在 wx 容器内被 game.js 调用；不静默装绿）；
//   ⑤ 贴图路径纪律（ac-13）：包内分享卡路径字面量单源在 tools/build-wx.mjs，经其生成的 game.js
//      模板注入（shareImageUrl）——本件与 share.ts 零图片扩展名字面量；注入缺失时被动通道不注册
//      （右上角转发回退宿主默认截图，降级不破坏运行；wx-s9 + devtools runbook 卡片核对兜底）。
import { getWx } from './wx-env.mjs';
import { installWxAdapter } from './adapter.mjs';
import { createWxRuntime } from './runtime.mjs';
import { wireSharePassive } from './share.mjs';
import { createStorageFacade } from '../storage.mjs';
import { createWxPrivacyPopup, registerPrivacyConsentKey } from './privacy.mjs';

/** 组包器注入面（game.js 模板单调用点）：仅渠道素材路径，零玩法/数值语义 */
                                
                                                                     
                         
 

export function bootWx(opts                = {})       {
  const wx = getWx();
  if (!wx) {
    // 显式失败：boot-wx 只应被 wx 容器入口调用；走到这里说明容器判定失败
    throw new Error('[g2-blocks] wx 容器判定失败：boot-wx 仅用于微信小游戏容器（Node 侧测试请走 tests/wx/）');
  }

  const adapted = installWxAdapter(wx);

  const runtime = createWxRuntime({ wx });
  runtime.attachLifecycle({
    onShow: () => { try { runtime.audio.unlock(); } catch { /* 首触解锁失败不阻塞 */ } },
    onHide: () => { /* rAF 由容器自动挂起；零内核触碰 */ },
  });

  // 分享环接线（spec wx-share-loop ws-acc-1/4 · 素材接线）：包内 5:4 卡经被动通道生效；
  // 载荷 sid 走 runtime 注入时钟（零 PII）；注册失败静默（share.ts 内降级），不阻塞 main 装载。
  if (opts.shareImageUrl) wireSharePassive(wx, runtime.clock, opts.shareImageUrl);

  // 隐私弹窗接线（spec wx-submission-kit wk-acc-3 · 视觉稿 privacy-popup-visual.md）：
  //   P3 状态经 T1 门面键制落 privacy-consent；P1 首帧可交互 + getPrivacySetting 探针双条件才弹；
  //   P2 非阻断：触摸并行监听（卡片外 handleTap=false 透传玩法入口）；P4 弹窗不前置「开始玩」
  //   （本段零 await/零阻塞，main.ts 照常立即装载）。
  const privacyFacade = createStorageFacade({ storage: runtime.storageLike });
  registerPrivacyConsentKey(privacyFacade); // P3：T1 门面键制注册（归属模块显式注册，幂等）
  const privacyPopup = createWxPrivacyPopup({ facade: privacyFacade, host: wx }); // host = wx.openPrivacyContract（查看全文；能力缺失静默降级）
  privacyPopup.setViewport(adapted.windowWidth, adapted.windowHeight);
  try {
    if (typeof wx.getPrivacySetting === 'function') {
      wx.getPrivacySetting({ success: (r) => { try { privacyPopup.applyProbe(r?.needAuthorization === true); } catch { /* 回调异常不阻塞 */ } } });
    } else {
      privacyPopup.applyProbe(false); // 宿主无探针能力 = 不弹（保守不骚扰，视觉稿降级口径）
    }
  } catch {
    privacyPopup.applyProbe(false);
  }
  // 触摸并行监听：命中弹窗按钮 → 消费（同意/拒绝/×）；卡片外 → 不消费（玩法入口照常收事件）
  try {
    wx.onTouchEnd((e) => {
      const t = e.touches && e.touches[0];
      if (t) privacyPopup.handleTap(t.clientX, t.clientY);
    });
  } catch { /* 宿主能力缺失静默（弹窗退化为可关闭浮层展示） */ }
  // 首帧钩子 + 每帧叠绘：游戏全部渲染发生在 rAF 回调内 → 包装 rAF，在游戏帧绘制完成后
  // 叠绘弹窗（首帧完成后 requestShow）。表现层包装，零内核/main 改动；绘制异常不破坏游戏帧。
  {
    const g = globalThis                                                                  ;
    const rawRaf = g.requestAnimationFrame.bind(g);
    let firstFrameSeen = false;
    const ctx2d = adapted.canvas.getContext('2d');
    g.requestAnimationFrame = (cb) => rawRaf((t) => {
      cb(t);
      if (!firstFrameSeen) { firstFrameSeen = true; privacyPopup.requestShow(); }
      if (ctx2d) { try { privacyPopup.paint(ctx2d, adapted.windowWidth, adapted.windowHeight); } catch { /* 绘制降级 */ } }
    });
  }

  void import('../../main.ts');
}


//# sourceURL=platform/wx/boot-wx.ts
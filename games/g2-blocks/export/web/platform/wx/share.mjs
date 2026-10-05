// share.ts — 微信会话分享闭环（WX 提审轮 N2-P2 · 纯平台件）
//
// 纪律（spec wx-share-loop 条目）：
//   ① 主判据：shareNow 调 wx.shareAppMessage，配图绑 5:4（500×400）分享卡（复用既有 A-06 件）；
//   ② 分享入口纯跳转：零数值回调、零内核 import（静态 import 面 = 类型面 only）；
//   ③ 载荷 query 携带 sid=（短随机 token，零 PII）；sid 由调用方生成传入，本件不生成不解析身份；
//   ④ 不可用（无容器）/失败（通道抛错）两路静默降级返回 {ok:false,reason}，入口保留；
//   ⑤ 被动通道 onShareAppMessage + showShareMenu 同卡同参。
                                          
                                         

                                 
                
                                                     
                   
                                                      
              
 

                                
              
                                              
 

                          
                                             
                            
                                 
                         
 

export function createWxShare(opts                                                )          {
  const { wx, payload } = opts;
  const query = `sid=${payload.sid}`;

  return {
    shareNow()                {
      if (!wx) return { ok: false, reason: 'no-wx-container' };
      try {
        wx.shareAppMessage({ title: payload.title, imageUrl: payload.imageUrl, query });
        return { ok: true };
      } catch {
        return { ok: false, reason: 'share-failed' };
      }
    },
    installPassive()       {
      if (!wx) return;
      try {
        wx.onShareAppMessage(() => ({ title: payload.title, imageUrl: payload.imageUrl, query }));
        wx.showShareMenu({ withShareTicket: false });
      } catch {
        /* 宿主能力缺失静默：入口保留（shareNow 仍可用） */
      }
    },
  };
}

// ---- 生产接线默认值（N3 补做轮 2026-10-05 · 美术线素材接线，呈现层；模块行为零改动） ----
// 贴图路径纪律（ac-13 零贴图门禁）：包内卡路径字面量**单源在 tools/build-wx.mjs**（组包面资产归组包器），
// 经组包器生成的 game.js 模板注入 boot-wx → 本件只接收 imageUrl 参数，src/ 零图片扩展名字面量。

/** 会话卡片标题（沿 approved 策划案 world/tone 可证事实文案，零夸大零诱导） */
export const SHARE_TITLE = '熔炉方块 · 8×8 交换三消';

/** 默认载荷工厂：sid = 容器时钟 token（`g2-` + base36 毫秒，零 PII、非密码学、不进内核；注入时钟可复现） */
export function createDefaultSharePayload(clock       , imageUrl        )                 {
  return { title: SHARE_TITLE, imageUrl, sid: `g2-${(clock.nowMs() >>> 0).toString(36)}` };
}

/** boot 链一键接线：被动通道注册（右上角菜单/转发同卡同参，ws-acc-4）；失败静默降级在 createWxShare 内 */
export function wireSharePassive(wx               , clock       , imageUrl        )          {
  const share = createWxShare({ wx, payload: createDefaultSharePayload(clock, imageUrl) });
  share.installPassive();
  return share;
}


//# sourceURL=platform/wx/share.ts
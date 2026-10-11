// share.ts — 抖音分享闭环（DY 平台段轮 N2 · 纯平台件）
//
// 纪律（spec dy-share-kit 条目 + 映射表 dy-diff-03/04/09）：
//   ① 主判据：shareNow 调 tt.shareAppMessage，配图绑 720×1280 竖版分享卡（复用既有 A-07 件；
//      卡规格唯一真源 = 链 v6 numeric.platform.dy.shareCard，本件零硬编码尺寸）；
//   ② 分享入口纯跳转：零数值回调、零内核 import（静态 import 面 = 类型面 only）；
//   ③ 载荷 query 携带 sid=（短随机 token，零 PII）；sid 由调用方生成传入，本件不生成不解析身份；
//   ④ 不可用（无容器）/失败（通道抛错）两路静默降级返回 {ok:false,reason}，入口保留；
//   ⑤ 被动通道 onShareAppMessage + showShareMenu 同卡同参。
                                          
                                         

                                 
                
                                                          
                   
                                                      
              
 

                                
              
                                              
 

                          
                                             
                            
                                 
                         
 

export function createDyShare(opts                                                )          {
  const { tt, payload } = opts;
  const query = `sid=${payload.sid}`;

  return {
    shareNow()                {
      if (!tt) return { ok: false, reason: 'no-dy-container' };
      try {
        tt.shareAppMessage({ title: payload.title, imageUrl: payload.imageUrl, query });
        return { ok: true };
      } catch {
        return { ok: false, reason: 'share-failed' };
      }
    },
    installPassive()       {
      if (!tt) return;
      try {
        tt.onShareAppMessage(() => ({ title: payload.title, imageUrl: payload.imageUrl, query }));
        tt.showShareMenu({ withShareTicket: false });
      } catch {
        /* 宿主能力缺失静默：入口保留（shareNow 仍可用） */
      }
    },
  };
}

// ---- 生产接线默认值（呈现层；模块行为零改动） ----
// 贴图路径纪律（ac-13 零贴图门禁）：包内卡路径字面量**单源在 tools/build-dy.mjs**（组包面资产归组包器），
// 经组包器生成的 game.js 模板注入 boot-dy → 本件只接收 imageUrl 参数，src/ 零图片扩展名尺寸字面量。

/** 会话卡片标题（沿 approved 策划案 world/tone 可证事实文案，零夸大零诱导） */
export const SHARE_TITLE = '熔炉方块 · 8×8 交换三消';

/** 默认载荷工厂：sid = 容器时钟 token（`g2-` + base36 毫秒，零 PII、非密码学、不进内核；注入时钟可复现） */
export function createDefaultSharePayload(clock       , imageUrl        )                 {
  return { title: SHARE_TITLE, imageUrl, sid: `g2-${(clock.nowMs() >>> 0).toString(36)}` };
}

/** boot 链一键接线：被动通道注册（右上角菜单/转发同卡同参，ds-acc-4）；失败静默降级在 createDyShare 内 */
export function wireSharePassive(tt               , clock       , imageUrl        )          {
  const share = createDyShare({ tt, payload: createDefaultSharePayload(clock, imageUrl) });
  share.installPassive();
  return share;
}


//# sourceURL=platform/dy/share.ts
// scene: battlefield — 20×12 单场景布防面（e-grid/e-core/e-turret/e-enemy 的场景装配）
// spec: world.sceneSpec（单场景固定路线 · 逻辑面 640×384 · 等比适配缩放交渲染层）

import { FIELD_W, FIELD_H } from "../render/theme.mjs";
                                                  

export const SCENE_ID = "battlefield-01";
export { FIELD_W, FIELD_H };

/** 等比适配：canvas 像素尺寸 → letterbox 视图（保持 640×384 比例，居中） */
export function fitView(canvasW        , canvasH        )       {
  const scale = Math.min(canvasW / FIELD_W, canvasH / FIELD_H);
  return {
    scale,
    offX: (canvasW - FIELD_W * scale) / 2,
    offY: (canvasH - FIELD_H * scale) / 2,
    w: canvasW,
    h: canvasH,
  };
}

/** 屏幕坐标 → 逻辑坐标（输入承接换算；letterbox 外夹回场内边界） */
export function toLogical(px        , py        , view      )                           {
  const x = Math.min(Math.max((px - view.offX) / view.scale, 0), FIELD_W - 0.01);
  const y = Math.min(Math.max((py - view.offY) / view.scale, 0), FIELD_H - 0.01);
  return { x, y };
}

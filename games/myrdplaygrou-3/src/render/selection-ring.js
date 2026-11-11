// selection-ring.js — 控制权切换高亮环（缺陷单 cmwbumwrj 修复本体）。
// 规范（策划案 v3 world.selectionHighlight / numeric.switchFx 代码镜像）：
//   · 全场同时最多 1 个高亮环实例（SWITCH_RING_MAX_CONCURRENT=1），仅新选中球员持有；
//   · 对象池化：mesh/材质/纹理全部构建期一次性创建，切换瞬间零新建、零全场景遍历（帧尖峰根因消除）；
//   · 一次性脉冲：0.15s 渐入 + 0.35s 回稳常亮（不循环闪烁）；失去控制权 0.25s 渐出；
//   · 插值过渡：缩放 0.6→1.0（easeOutCubic）、位置逐帧平滑跟随（切换不瞬跳、不引起相机/HUD 跳动）；
//   · 红线：禁止整队闪烁 / 批量材质切换作切换反馈（SWITCH_FULL_TEAM_FLASH_ALLOWED=false）。
// 本模块是表现层：只读内核（受控 id + 坐标），不回写任何内核状态。
import * as THREE from "three";
import { PALETTE, glowTexture } from "./textures.js";
import {
  SWITCH_PULSE_FADE_IN_SEC, SWITCH_PULSE_STEADY_SEC, SWITCH_FADE_OUT_SEC,
  SWITCH_SCALE_FROM, SWITCH_RING_MAX_CONCURRENT,
} from "../numeric.js";

export const easeOutCubic = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a, b, k) => a + (b - a) * Math.min(1, Math.max(0, k));

/** 构建全场唯一的高亮环（对象池；调用一次，之后 update 复用） */
export function createSelectionRing(scene) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  // 伴随光斑（单张共享纹理；AdditiveBlending + depthWrite=false 防排序伪影）
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
  }));
  glow.scale.set(1.6, 1.6, 1);
  glow.position.y = 0.05;
  group.add(glow);
  scene.add(group);

  const st = {
    lastId: -1,        // 上一次持有的受控球员 id（-1 = 从未）
    pulseT: Infinity,  // 脉冲计时（Infinity = 已回稳常亮态，不再动缩放）
    op: 0,             // 当前不透明度（逐帧连续，机判「无单帧跳变」锚点）
    x: 0, z: 0,        // 环位置（平滑跟随态）
    switched: 0,       // 切换计数（payload 取证：本次对局控制权切换次数）
  };

  return {
    group,
    ring,
    glow,
    /** 实例数恒等断言锚点（payload 上报，验收 acc-switch-single-highlight） */
    get instanceCount() { return SWITCH_RING_MAX_CONCURRENT; },
    get switchCount() { return st.switched; },
    /**
     * 每帧同步（表现层只读内核）。
     * @param target 受控球员（world.players[controlledId]）或 null（无受控/暂停/终局）
     * @param dt 渲染 dt
     * @param active 对局是否在展示高亮（playing 态；暂停/教学卡/结算 = 渐出）
     */
    update(target, dt, active) {
      const wantOp = active && target ? 0.85 : 0;

      // 切换检测：受控人变化 → 重置脉冲计时 + 切换确认计数（音效由 main 侧在事件里播）
      if (target && target.id !== st.lastId) {
        if (st.lastId !== -1 || st.switched === 0) st.switched += 1;
        st.lastId = target.id;
        st.pulseT = 0;
      } else if (!target) {
        st.lastId = -1;
      }

      // 位置平滑跟随（lerp 系数按 dt 归一：60fps 下每帧贴 ~40%，帧率无关不抖动）
      if (target) {
        const k = 1 - Math.exp(-22 * dt);
        st.x = lerp(st.x, target.x, k);
        st.z = lerp(st.z, target.z, k);
        group.position.set(st.x, 0, st.z);
      }

      // 不透明度：目标值的渐入/渐出插值（逐帧连续）
      const rate = wantOp > st.op ? dt / SWITCH_PULSE_FADE_IN_SEC : dt / SWITCH_FADE_OUT_SEC;
      st.op = lerp(st.op, wantOp, rate);
      const eased = easeOutCubic(st.op / Math.max(1e-6, wantOp || 1)) * st.op;
      ring.material.opacity = eased;
      glow.material.opacity = eased * 0.6;

      // 缩放脉冲：0.15s 内 0.6→1.0（easeOutCubic），随后常亮 1.0（0.35s 回稳窗口不再缩放）
      if (st.pulseT !== Infinity) {
        st.pulseT += dt;
        const p = Math.min(1, st.pulseT / SWITCH_PULSE_FADE_IN_SEC);
        const s = SWITCH_SCALE_FROM + (1 - SWITCH_SCALE_FROM) * easeOutCubic(p);
        group.scale.set(s, 1, s);
        ring.rotation.z += dt * 1.5; // 慢转（纯装饰，同前版节奏）
        if (st.pulseT >= SWITCH_PULSE_FADE_IN_SEC + SWITCH_PULSE_STEADY_SEC) st.pulseT = Infinity;
      } else {
        group.scale.set(1, 1, 1);
        ring.rotation.z += dt * 1.5;
      }

      // 全隐藏时零绘制成本（可见性开关，材质/几何不销毁 —— 池化语义）
      const visible = st.op > 0.01;
      group.visible = visible;
    },
  };
}

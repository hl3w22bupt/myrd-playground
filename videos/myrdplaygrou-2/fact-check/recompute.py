#!/usr/bin/env python3
"""以柔克刚 · 事实核验机械复算脚本

对事实清单中每一个「可复算」数字，按显式公式独立重算，
并与清单声明值逐项比对（容差=显示位数）。
任何一项 assert 失败即整体退出非零。

公式口径：
  v = sqrt(2*g*h)            自由落体末速（忽略空气阻力）
  p = m*v                    动量
  E = 0.5*m*v*v              动能
  F_avg = p / dt             冲量定理平均力
  比例结论只做比值复算，不引入未声明参数
"""
import json
import math
import sys

GN = 9.80665  # ISO 80000-3:2019 标准重力加速度 m/s^2
LB_TO_KG = 0.45359237  # 精确换算（1 lb = 0.45359237 kg，定义值）

results = []


def check(claim_id, declared, computed, tol, note, formula):
    """登记一项复算比对；declared 为清单声明值，computed 为独立重算值。"""
    ok = abs(declared - computed) <= tol
    results.append({
        "claim": claim_id,
        "formula": formula,
        "declared": round(declared, 6),
        "computed": round(computed, 6),
        "tolerance": tol,
        "pass": ok,
        "note": note,
    })
    return ok


def v_freefall(h):
    return math.sqrt(2 * GN * h)


all_ok = True

# ---- 1. 自由落体末速（g=9.80665，忽略空气阻力）----
for h in (0.5, 1.0, 2.0):
    all_ok &= check(
        f"v_freefall_h{h}",
        {0.5: 3.13, 1.0: 4.43, 2.0: 6.26}[h],
        v_freefall(h),
        0.005,
        f"h={h} m 落体末速，清单按两位小数声明",
        "v=sqrt(2*g*h), g=9.80665",
    )

# ---- 2. 乒乓球 2.7 g（ITTF Law 2.3.2）从 0.5 m 落下 ----
m_pp = 0.0027
v = v_freefall(0.5)
all_ok &= check("p_pingpong_0p5m", 0.0085, m_pp * v, 0.00005,
                "乒乓球动量 kg·m/s，两位有效位", "p=m*v")
all_ok &= check("E_pingpong_0p5m", 0.0132, 0.5 * m_pp * v * v, 0.00005,
                "乒乓球动能 J，三位有效位", "E=0.5*m*v^2")

# ---- 3. 网球 57.7 g（ITF 范围 56.0–59.4 g 中值）从 1 m 落下 ----
m_tennis = 0.0577
v = v_freefall(1.0)
all_ok &= check("E_tennis_1m", 0.566, 0.5 * m_tennis * v * v, 0.0005,
                "网球动能 J（用范围中值 57.7 g）", "E=0.5*m*v^2")
all_ok &= check("p_tennis_1m", 0.2556, m_tennis * v, 0.0005,
                "网球动量 kg·m/s", "p=m*v")

# ---- 4. 保龄球 16 lb（USBC 上限，精确换算 7.2575 kg）从 1 m 落下 ----
m_bowl = 16 * LB_TO_KG
v = v_freefall(1.0)
all_ok &= check("m_bowling_kg", 7.2575, m_bowl, 0.00005,
                "16 lb→kg 精确换算", "kg = lb*0.45359237")
all_ok &= check("p_bowling_1m", 32.14, m_bowl * v, 0.005,
                "保龄球动量 kg·m/s（首版预填 32.15 被复算否决，已修正）", "p=m*v")
all_ok &= check("E_bowling_1m", 71.17, 0.5 * m_bowl * v * v, 0.005,
                "保龄球动能 J（首版预填 71.19 被复算否决，已修正）", "E=0.5*m*v^2")

# ---- 5. 玻璃瓶 350 g（500ml 长颈瓶典型区间 290–400 g 取中段）从 1 m 落下 ----
m_bottle = 0.35
v = v_freefall(1.0)
all_ok &= check("p_bottle_1m", 1.550, m_bottle * v, 0.0005,
                "玻璃瓶动量 kg·m/s", "p=m*v")
all_ok &= check("E_bottle_1m", 3.432, 0.5 * m_bottle * v * v, 0.0005,
                "玻璃瓶动能 J", "E=0.5*m*v^2")

# ---- 6. 冲量定理：同动量不同接触时间的平均力（比例结论）----
p_bottle = m_bottle * v_freefall(1.0)
f_hard = p_bottle / 0.005   # 5 ms：硬接触演示参数
f_soft = p_bottle / 0.050   # 50 ms：缓冲接触演示参数
all_ok &= check("F_hard_5ms", 310.0, f_hard, 0.5,
                "平均力 N（接触时间 5ms 为演示参数，非实测）", "F_avg=p/dt")
all_ok &= check("F_soft_50ms", 31.0, f_soft, 0.05,
                "平均力 N（接触时间 50ms 为演示参数）", "F_avg=p/dt")
all_ok &= check("ratio_force_reduction", 10.0, f_hard / f_soft, 0.001,
                "缓冲把接触时间拉长 10 倍→平均力降为 1/10（比例结论可机械证明）",
                "F1/F2=(p/t1)/(p/t2)=t2/t1")

# ---- 7. 瓶撞硬面平均力 vs 鸡蛋壳破裂阈值 30–50 N（同口径比较）----
all_ok &= check("F_hard_vs_egg_max", 6.2, f_hard / 50.0, 0.05,
                "310 N 为鸡蛋壳上限 50 N 的 6.2 倍（仅按准静态阈值口径比较）", "F/E_max")

# ---- 8. 山西大学 2022 实测：峰值压强降幅复算 ----
all_ok &= check("pressure_reduction_pct", 79.2, (1 - 2.1 / 10.1) * 100, 0.05,
                "10.1 MPa→2.1 MPa 降幅 79.2%（文献称 79%，声明一致）", "(1-P2/P1)*100")

# ---- 9. 保龄球 / 乒乓球质量比 ----
all_ok &= check("mass_ratio_bowl_pp", 2688.0, m_bowl / m_pp, 2.0,
                "16 lb 保龄球是 2.7 g 乒乓球的约 2688 倍", "m1/m2")

# ---- 10. ITTF 回弹比（305 mm 落钢块，回弹 240–260 mm）----
all_ok &= check("ittf_rebound_ratio_min", 78.7, 240 / 305 * 100, 0.05,
                "回弹比下限 %", "h2/h1*100")
all_ok &= check("ittf_rebound_ratio_max", 85.2, 260 / 305 * 100, 0.05,
                "回弹比上限 %", "h2/h1*100")

passed = sum(1 for r in results if r["pass"])
failed = [r for r in results if not r["pass"]]
report = {
    "script": "recompute.py",
    "constants": {"g_std_m_s2": GN, "lb_to_kg": LB_TO_KG},
    "total": len(results),
    "passed": passed,
    "failed": len(failed),
    "checks": results,
}
with open("recompute-report.json", "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(json.dumps({"total": len(results), "passed": passed, "failed": len(failed)},
                 ensure_ascii=False))
for r in failed:
    print("FAIL:", json.dumps(r, ensure_ascii=False))
sys.exit(0 if all_ok else 1)

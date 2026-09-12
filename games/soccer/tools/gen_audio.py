#!/usr/bin/env python3
"""《Soccer》音效素材生成器 —— 纯标准库合成 16-bit 单声道 WAV。

产出的 9 个音效覆盖 v2 迭代需求的全部比赛事件音：
  kick / pass / steal —— 踢球、传球、抢断
  whistle_kickoff / whistle_halftime / whistle_fulltime —— 开球 / 中场 / 终场哨
  goal —— 进球音（与 crowd_cheer 分层叠加）
  crowd_cheer / crowd_ambient —— 人群欢呼 / 环境氛围

体积预算：全部素材 < 1MB（需求上限 5MB，见知识文档《Godot Web 导出与 AppHost 部署实战经验》）。
用法：python3 games/soccer/tools/gen_audio.py   （在仓库根目录运行）
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 22050
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "audio"
PEAK = 0.62  # 全局峰值余量，防止削波


def _write_wav(name: str, samples: list[float]) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}.wav"
    clipped = [max(-1.0, min(1.0, s * PEAK)) for s in samples]
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(b"".join(
            struct.pack("<h", int(s * 32767.0)) for s in clipped
        ))
    return path.stat().st_size


def _seconds(n: int) -> float:
    return n / SAMPLE_RATE


def _env_ad(t: float, dur: float, attack: float, release: float) -> float:
    """attack-release 包络（线性）。"""
    if t < attack:
        return t / max(attack, 1e-6)
    if t > dur - release:
        return max(0.0, (dur - t) / max(release, 1e-6))
    return 1.0


def _lowpass(samples: list[float], kernel: int) -> list[float]:
    """盒式低通（滑动平均），kernel=1 时原样返回。"""
    if kernel <= 1:
        return samples
    half = kernel // 2
    out: list[float] = []
    running = sum(samples[: min(kernel, len(samples))])
    for i in range(len(samples)):
        out.append(running / min(kernel, len(samples)))
        drop = max(0, i - half)
        add = min(len(samples), i + half + 1)
        if drop < len(samples) and add <= len(samples):
            running += samples[add - 1] - samples[drop]
    return out


def tone_blast(dur: float, freq: float, vibrato_hz: float, vibrato_depth: float,
               attack: float = 0.012, release: float = 0.05) -> list[float]:
    """裁判哨：高频双音拍频 + 颤音，音色单薄但辨识度高。"""
    n = int(dur * SAMPLE_RATE)
    out: list[float] = []
    phase2 = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        env = _env_ad(t, dur, attack, release)
        vib = 1.0 + vibrato_depth * math.sin(2 * math.pi * vibrato_hz * t)
        out.append(env * (
            0.55 * math.sin(2 * math.pi * freq * vib * t)
            + 0.35 * math.sin(2 * math.pi * freq * 1.012 * vib * t + 0.7)
            + 0.10 * math.sin(2 * math.pi * freq * 2.02 * t)
        ))
    return out


def whistle(blasts: list[float], gap: float = 0.10) -> list[float]:
    """多声哨：blasts 里每项是一声的时长。"""
    out: list[float] = []
    for i, dur in enumerate(blasts):
        if i > 0:
            out.extend([0.0] * int(gap * SAMPLE_RATE))
        out.extend(tone_blast(dur, 2793.0, 34.0, 0.012,
                              attack=0.010,
                              release=min(0.06, dur * 0.25)))
    return out


def kick() -> list[float]:
    """踢球：低频 thump + 起音噪声脆响。"""
    dur = 0.11
    n = int(dur * SAMPLE_RATE)
    rng = random.Random(20260912)
    out: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        thump = math.sin(2 * math.pi * (105.0 - 55.0 * t / dur) * t) * math.exp(-t * 38.0)
        click = (rng.random() * 2.0 - 1.0) * math.exp(-t * 260.0) * 0.7
        out.append(thump * 0.9 + click)
    return _lowpass(out, 3)


def kick_soft() -> list[float]:
    """传球：比射门更短更柔的推球声。"""
    dur = 0.08
    n = int(dur * SAMPLE_RATE)
    rng = random.Random(20260913)
    out: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        body = math.sin(2 * math.pi * 150.0 * t) * math.exp(-t * 55.0)
        brush = (rng.random() * 2.0 - 1.0) * math.exp(-t * 300.0) * 0.35
        out.append(body * 0.75 + brush)
    return _lowpass(out, 4)


def steal() -> list[float]:
    """抢断：下滑扫频 + 沙沙摩擦。"""
    dur = 0.16
    n = int(dur * SAMPLE_RATE)
    rng = random.Random(20260914)
    out: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        f = 820.0 - 520.0 * (t / dur)
        sweep = math.sin(2 * math.pi * f * t) * math.exp(-t * 16.0) * 0.5
        hiss = (rng.random() * 2.0 - 1.0) * _env_ad(t, dur, 0.02, 0.09) * 0.35
        out.append(sweep + hiss)
    return _lowpass(out, 2)


def goal() -> list[float]:
    """进球：上行琶音号角（C5-E5-G5-C6），明亮上扬。"""
    notes = [523.25, 659.25, 783.99, 1046.5]
    seg = 0.20
    tail = 0.45
    total_n = int((seg * 0.62 * (len(notes) - 1) + seg + tail) * SAMPLE_RATE)
    out = [0.0] * total_n
    for idx, freq in enumerate(notes):
        start_i = int(idx * seg * 0.62 * SAMPLE_RATE)
        dur = seg + (tail if idx == len(notes) - 1 else 0.0)
        n = int(dur * SAMPLE_RATE)
        for i in range(n):
            t = i / SAMPLE_RATE
            env = _env_ad(t, dur, 0.015, dur * 0.45)
            out[start_i + i] += env * (
                0.5 * math.sin(2 * math.pi * freq * t)
                + 0.22 * math.sin(2 * math.pi * freq * 2.0 * t)
                + 0.08 * math.sin(2 * math.pi * freq * 3.0 * t)
            )
    return out


def _crowd(dur: float, base_gain: float, swell: bool, seed: int) -> list[float]:
    """人群声：多带噪声 + 慢速幅度起伏，swell=True 时中段隆起（欢呼）。"""
    n = int(dur * SAMPLE_RATE)
    rng = random.Random(seed)
    raw = [rng.random() * 2.0 - 1.0 for _ in range(n)]
    smoothed = _lowpass(raw, 9)          # 低通 → 远处人群的闷响
    hiss = _lowpass(raw, 2)              # 中频 → 口哨/人声纹理
    out: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        lfo = 0.7 + 0.3 * math.sin(2 * math.pi * 1.7 * t + 1.1) \
            * math.sin(2 * math.pi * 0.9 * t)
        shape = _env_ad(t, dur, 0.25, 0.45)
        if swell:
            shape *= 0.35 + 0.9 * math.sin(math.pi * min(1.0, t / dur)) ** 2
        out.append(shape * lfo * (smoothed[i] * 1.15 + hiss[i] * 0.30) * base_gain)
    return out


def main() -> None:
    total = 0
    assets: dict[str, list[float]] = {
        "kick": kick(),
        "pass": kick_soft(),
        "steal": steal(),
        "whistle_kickoff": whistle([0.42]),
        "whistle_halftime": whistle([0.30, 0.42]),
        "whistle_fulltime": whistle([0.28, 0.28, 0.62], gap=0.09),
        "goal": goal(),
        "crowd_cheer": _crowd(2.4, 0.9, swell=True, seed=77001),
        "crowd_ambient": _crowd(3.6, 0.38, swell=False, seed=77002),
    }
    for name, samples in assets.items():
        size = _write_wav(name, samples)
        total += size
        print(f"gen_audio: {name}.wav  {size} bytes  ({_seconds(len(samples)):.2f}s)")
    print(f"gen_audio: 合计 {total} bytes（预算 5MB，占用 {total / 5242880:.1%}）")


if __name__ == "__main__":
    main()

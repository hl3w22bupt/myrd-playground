#!/usr/bin/env python3
"""线上复核：3D 切苹果 pck 解码 —— 玩法标识检出 + 与部署 commit 导出一致性。

解码链（复用 game-9/candy 终验口径）：
  1. GDPC v3 头解析：magic@0、format_version@4、file_base@0x18、目录偏移@0x20
  2. 尾部目录逐条目提取（offset + file_base 校正）
  3. zstd 压缩条目解压（Godot 4 GDSC v101 = 'GDSC' 头 12 字节 + zstd 帧）
  4. 全条目字节流检索玩法标识（字符串常量；标识符已哈希化）
"""
import json
import struct
import subprocess
import sys
import tempfile

PCK_PATH = sys.argv[1]
OUT_JSON = sys.argv[2]
EXPECT_SHA = sys.argv[3] if len(sys.argv) > 3 else None

MARKERS = {
    " Combo x3 弹窗常量": "Combo x",
    "切中炸弹提示": "切中炸弹",
    "剩余时长 HUD": "剩余",
    "重开入口": "再来一局",
    "破纪录提示": "新纪录",
    "漏接统计": "漏接",
    "计分 HUD": "分数",
    "调参键 apple_points": "apple_points",
    "调参键 combo_bonus_pair": "combo_bonus_pair",
    "调参键 bomb_ratio": "bomb_ratio",
    "调参键 round_seconds": "round_seconds",
    "音频 score.wav": "score.wav",
    "音频 bomb/fail.wav": "fail.wav",
    "引导文案": "滑动切开苹果",
}


def main():
    data = open(PCK_PATH, "rb").read()
    assert data[:4] == b"GDPC", "not a GDPC pck"
    fmt = struct.unpack_from("<I", data, 4)[0]
    file_base = struct.unpack_from("<Q", data, 0x18)[0]
    # pck v2（Godot 4.3）：目录紧随头部（header 96 字节 = 0x60），offset 相对 file_base
    dir_off = 0x60 if fmt < 3 else struct.unpack_from("<Q", data, 0x20)[0]
    entries = []
    p = dir_off
    n_files = struct.unpack_from("<I", data, p)[0]
    p += 4
    for _ in range(n_files):
        slen = struct.unpack_from("<I", data, p)[0]
        p += 4
        path = data[p : p + slen].rstrip(b"\x00").decode("utf-8", "replace")
        p += slen
        fo, size = struct.unpack_from("<QQ", data, p)
        p += 16
        p += 16  # md5
        flags = struct.unpack_from("<I", data, p)[0]
        p += 4
        entries.append((path, fo + file_base, size, flags))

    # 逐条目解出（GDSC/zstd 条目先解压）
    blob = bytearray()
    names = []
    for path, off, size, flags in entries:
        if off < 0 or off + size > len(data):
            continue
        raw = data[off : off + size]
        if raw[:4] == b"GDSC":
            raw = raw[12:]
        content = raw
        if raw[:4] == b"\x28\xb5\x2f\xfd":
            r = subprocess.run(["zstd", "-d", "-q", "-c", "-"], input=raw, capture_output=True)
            if r.returncode == 0 and r.stdout:
                content = r.stdout
        names.append(path)
        blob += content + b"\n"

    text = blob.decode("utf-8", "ignore")
    results = {k: (v in text) for k, v in MARKERS.items()}
    found = sorted(set(m for m in MARKERS.values() if m in text))

    import hashlib

    sha = hashlib.sha256(data).hexdigest()
    out = {
        "pck": PCK_PATH,
        "format_version": fmt,
        "entry_count": n_files,
        "sha256": sha,
        "matches_expect_sha": (sha == EXPECT_SHA) if EXPECT_SHA else None,
        "marker_hits": results,
        "all_hit": all(results.values()),
        "entries_sample": names[:60],
    }
    json.dump(out, open(OUT_JSON, "w"), ensure_ascii=False, indent=2)
    print(f"entries={n_files} sha256={sha[:16]}… match_expect={out['matches_expect_sha']}")
    for k, v in results.items():
        print(f"  {'HIT ' if v else 'MISS'} {k}")
    print("PCK_DECODE:", "PASS" if all(results.values()) else "PARTIAL")


if __name__ == "__main__":
    main()

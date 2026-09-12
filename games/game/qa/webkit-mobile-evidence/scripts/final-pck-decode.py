#!/usr/bin/env python3
"""终验③：线上 pck 解码取证——无效交换反馈标识 + 与分支 HEAD 导出 sha256 一致性。

解码链（Godot 4.6 pck v3 + GDSC v101 全程还原，全部步骤本脚本内可复现）：
  1. GET  {LIVE}/api/public/assets/index.pck.gz.b64   （AppHost 壳页 fetchAsset 同款端点）
  2. base64 → gunzip → 线上原始 pck 字节 → sha256
  3. GDPC v3 头解析：magic@0、format_version@4、godot 版本@8、file_base@0x18、目录偏移@0x20
  4. 尾部目录逐条目提取（offset + file_base 校正）
  5. .gdc = 'GDSC' + version(u32) + size(u32) + zstd 帧 → 跳 12 字节 unzstd → 令牌流
  6. 令牌流内检索明文字符串常量（标识符被 Godot 4.6 哈希化，唯常量字符串可 grep）

判定：
  A. 解码后检出 'play_invalid_swap_fx'（冒烟场景断言常量 Board.play_invalid_swap_fx）
  B. 线上 pck sha256 == 本地分支 HEAD games/game/export/web/index.pck sha256
输出：final-pck-decode.json（exit 0 仅当 A+B 全真）
"""
import base64
import gzip
import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile
import urllib.request

LIVE = os.environ.get("LIVE_URL", "https://leomac-studio.tail49399e.ts.net/apps/game").rstrip("/")
REPO = os.environ.get(
    "REPO_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..")),
)
LOCAL_PCK = os.path.join(REPO, "games", "game", "export", "web", "index.pck")
OUT_JSON = os.path.join(os.path.dirname(__file__), "..", "final-pck-decode.json")
MARKERS = [
    "play_invalid_swap_fx",            # 无效交换反馈入口（board.gd / 冒烟断言）
    "Board.play_invalid_swap_fx",      # smoke.gd 断言常量（明文常量形态）
    "_flash_invalid_swap_message",     # main.gd HUD 提示入口
    "Invalid swap - needs a match of 3",  # HUD 大字提示文案
]


def http_get(url: str, retries: int = 2) -> bytes:
    """curl 子进程通道（实测对该端点最稳；偶发 401 为瞬时抖动，指数退避重试）。"""
    last = None
    for attempt in range(retries + 1):
        p = subprocess.run(["curl", "-sSL", "--max-time", "120", "-o", "-", "-w", "%{http_code}", url],
                           capture_output=True)
        body, code = p.stdout[:-3], p.stdout[-3:].decode()
        if code == "200":
            return body
        last = f"HTTP {code}"
        print(f"[pck] GET {url} -> {last}（第 {attempt + 1} 次），退避重试")
        import time
        time.sleep(2 ** attempt)
    raise RuntimeError(f"GET failed: {last}")


def parse_pck_v3(data: bytes):
    assert data[:4] == b"GDPC", "not a GDPC pck"
    fmt = struct.unpack_from("<I", data, 4)[0]
    ver = struct.unpack_from("<3I", data, 8)
    file_base = struct.unpack_from("<Q", data, 0x18)[0]
    diroff = struct.unpack_from("<Q", data, 0x20)[0]
    (cnt,) = struct.unpack_from("<I", data, diroff)
    off = diroff + 4
    entries = []
    for _ in range(cnt):
        (plen,) = struct.unpack_from("<I", data, off)
        off += 4
        path = data[off : off + plen].rstrip(b"\x00").decode()
        off += plen
        fo, sz = struct.unpack_from("<QQ", data, off)
        off += 16
        md5 = data[off : off + 16].hex()
        off += 16
        (flags,) = struct.unpack_from("<I", data, off)
        off += 4
        entries.append({"path": path, "offset": fo + file_base, "size": sz, "flags": flags, "md5": md5})
    return {"format_version": fmt, "godot": list(ver), "entries": entries}


def gdsc_decompress(blob: bytes, zstd_bin: str) -> bytes:
    """.gdc：'GDSC' + version u32 + uncompressed_size u32 + zstd 帧。"""
    if blob[:4] != b"GDSC":
        return blob
    p = subprocess.run([zstd_bin, "-d", "-q", "-c", "-"], input=blob[12:], capture_output=True)
    if p.returncode != 0:
        raise RuntimeError("zstd decompress failed: " + p.stderr.decode())
    return p.stdout


def main() -> int:
    R = {"liveUrl": LIVE, "markers": {}, "verdict": {}}
    zstd_bin = None
    for cand in ("zstd", "/opt/homebrew/bin/zstd", "/usr/bin/zstd"):
        try:
            subprocess.run([cand, "--version"], capture_output=True, check=True)
            zstd_bin = cand
            break
        except Exception:
            continue
    assert zstd_bin, "zstd CLI not found"

    # 1-2. 下载 + 解码 + sha256
    b64 = http_get(f"{LIVE}/api/public/assets/index.pck.gz.b64").decode().strip()
    pck = gzip.decompress(base64.b64decode(b64))
    R["live_pck"] = {
        "endpoint": f"{LIVE}/api/public/assets/index.pck.gz.b64",
        "gz_b64_bytes": len(b64),
        "pck_bytes": len(pck),
        "magic": pck[:4].decode(),
        "sha256": hashlib.sha256(pck).hexdigest(),
    }
    print(f"[pck] live sha256 = {R['live_pck']['sha256']} ({len(pck)} bytes)")

    # 3-5. 解析 + 提取 + GDSC 解压
    meta = parse_pck_v3(pck)
    R["pck_header"] = {"format_version": meta["format_version"], "godot": meta["godot"], "entries": len(meta["entries"])}
    blobs = {}
    for ent in meta["entries"]:
        raw = pck[ent["offset"] : ent["offset"] + ent["size"]]
        if raw[:4] == b"\x28\xb5\x2f\xfd":
            raw = subprocess.run([zstd_bin, "-d", "-q", "-c", "-"], input=raw, capture_output=True).stdout
        elif raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        blobs[ent["path"]] = gdsc_decompress(raw, zstd_bin) if ent["path"].endswith(".gdc") else raw
    print(f"[pck] parsed {len(blobs)} entries (godot {meta['godot']})")

    # 6. 标记检索（解码后逐条目）
    for m in MARKERS:
        hits = sorted(p for p, b in blobs.items() if m.encode() in b)
        R["markers"][m] = hits
        print(f"[pck] marker {m!r}: {len(hits)} hits {hits}")

    # B. 与本地分支 HEAD 导出比对
    local = open(LOCAL_PCK, "rb").read()
    R["local_pck"] = {"path": os.path.relpath(LOCAL_PCK, REPO), "bytes": len(local),
                      "sha256": hashlib.sha256(local)}
    R["local_pck"]["sha256"] = hashlib.sha256(local).hexdigest()
    print(f"[pck] local sha256 = {R['local_pck']['sha256']} ({len(local)} bytes)")
    R["verdict"]["marker_found"] = bool(R["markers"]["play_invalid_swap_fx"])
    R["verdict"]["sha256_identical"] = R["live_pck"]["sha256"] == R["local_pck"]["sha256"]
    R["verdict"]["pass"] = R["verdict"]["marker_found"] and R["verdict"]["sha256_identical"]
    with open(OUT_JSON, "w") as f:
        json.dump(R, f, indent=2, ensure_ascii=False)
    print(f"[pck] RESULT pass={R['verdict']['pass']}")
    return 0 if R["verdict"]["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())

"""転生アスリートのアプリアイコン (PNG) を生成する。追加ライブラリ不要。

使い方: python3 tools/make_icons.py   （tensei-athlete フォルダで実行）
夜のスタジアムの紺色に、赤と青のリボンがついた金メダルを描く。
"""
import os
import struct
import zlib

NAVY = (10, 22, 48)
NAVY2 = (31, 80, 170)
GOLD = (255, 207, 58)
GOLD_D = (230, 150, 30)
RED = (255, 61, 110)
BLUE = (63, 160, 255)
SIZES = [180, 192, 512]
SS = 4


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def color_at(px, py, size):
    u, v = px / size, py / size
    cx, cy, r = 0.5, 0.60, 0.20
    d2 = (u - cx) ** 2 + (v - cy) ** 2
    # メダル（外側の金、内側の濃い金の輪、中心の金）
    if d2 <= r ** 2:
        d = d2 ** 0.5
        if 0.72 * r <= d <= 0.80 * r:
            return GOLD_D
        return mix(GOLD, (255, 240, 170), max(0.0, 0.5 - (v - (cy - r)) / (2 * r)))
    # リボン：上から V 字に 2本
    for x0, col in ((0.38, RED), (0.62, BLUE)):
        x_at = x0 + (cx - x0) * ((v - 0.18) / (cy - r - 0.18 + 1e-9))
        if 0.18 <= v <= cy - r + 0.05 and abs(u - x_at) <= 0.055:
            return col
    # 背景：下から光が当たる紺色
    t = min(1.0, ((u - 0.5) ** 2 + (v - 1.15) ** 2) ** 0.5 / 0.95)
    return mix(NAVY2, NAVY, t)


def make_png(size):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0]
            for i in range(SS):
                for j in range(SS):
                    c = color_at(x + (i + 0.5) / SS, y + (j + 0.5) / SS, size)
                    for k in range(3):
                        acc[k] += c[k]
            row += bytes(round(a / (SS * SS)) for a in acc)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for s in SIZES:
        with open(os.path.join(out, f"icon-{s}.png"), "wb") as f:
            f.write(make_png(s))
        print("wrote", f"icons/icon-{s}.png")

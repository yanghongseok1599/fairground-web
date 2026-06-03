#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path("/Users/seok/.codex/generated_images/019e52a7-774b-7543-be46-d89bb14180b7")
OUT_DIR = ROOT / "public/images/team-cards"

CARDS = {
    "team-card-bronze.png": "ig_09e5868f4079d691016a11410f38f88191a9f370d84f0b7187.png",
    "team-card-silver.png": "ig_09e5868f4079d691016a1141643140819198a39491f99a3ce5.png",
    "team-card-gold.png": "ig_09e5868f4079d691016a1141b8b978819199a35d0d143eb631.png",
}

TARGET_SIZE = (1080, 1240)
BG_TOLERANCE = 34
EDGE_SOFT_DISTANCE = 86


def channel_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))


def sample_edge_key(img: Image.Image) -> tuple[int, int, int]:
    px = img.load()
    w, h = img.size
    band = max(4, min(w, h) // 180)
    samples: list[tuple[int, int, int]] = []

    for x in range(w):
        for y in range(band):
            samples.append(px[x, y][:3])
            samples.append(px[x, h - 1 - y][:3])
    for y in range(h):
        for x in range(band):
            samples.append(px[x, y][:3])
            samples.append(px[w - 1 - x, y][:3])

    return (
        int(median(v[0] for v in samples)),
        int(median(v[1] for v in samples)),
        int(median(v[2] for v in samples)),
    )


def remove_connected_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    key = sample_edge_key(img)

    background = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def idx(x: int, y: int) -> int:
        return y * w + x

    def is_bg_candidate(x: int, y: int) -> bool:
        return channel_distance(px[x, y][:3], key) <= BG_TOLERANCE

    for x in range(w):
        for y in (0, h - 1):
            i = idx(x, y)
            if not background[i] and is_bg_candidate(x, y):
                background[i] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = idx(x, y)
            if not background[i] and is_bg_candidate(x, y):
                background[i] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            i = idx(nx, ny)
            if background[i] or not is_bg_candidate(nx, ny):
                continue
            background[i] = 1
            queue.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if background[idx(x, y)]:
                px[x, y] = (0, 0, 0, 0)

    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                continue
            touches_bg = False
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if nx < 0 or ny < 0 or nx >= w or ny >= h or background[idx(nx, ny)]:
                    touches_bg = True
                    break
            if not touches_bg:
                continue
            distance = channel_distance(px[x, y][:3], key)
            if distance >= EDGE_SOFT_DISTANCE:
                continue
            alpha = int(255 * max(0, min(1, (distance - BG_TOLERANCE) / (EDGE_SOFT_DISTANCE - BG_TOLERANCE))))
            if alpha < px[x, y][3]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, max(0, alpha))

    return img


def pack_to_target(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    target_w, target_h = TARGET_SIZE
    canvas = Image.new("RGBA", TARGET_SIZE, (0, 0, 0, 0))
    scale = min(target_w / img.width, target_h / img.height)
    size = (round(img.width * scale), round(img.height * scale))
    resized = img.resize(size, Image.Resampling.LANCZOS)
    x = (target_w - size[0]) // 2
    y = (target_h - size[1]) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for out_name, source_name in CARDS.items():
        source = SOURCE_DIR / source_name
        out = OUT_DIR / out_name
        processed = pack_to_target(remove_connected_background(Image.open(source)))
        processed.save(out)
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

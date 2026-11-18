#!/usr/bin/env python3
"""Tách glyph từ media/assets/world/vfx/floating_damage.png thành atlas sạch.

Ảnh gốc là bốn hàng "1234567890+-": sát thương thường, bạo kích, hồi phục,
linh khí. Các glyph được vẽ chồng viền/glow lên nhau nên cắt theo hình chữ nhật
sẽ kéo theo nét của glyph bên cạnh. Công cụ này lấy từng thành phần liên thông
của alpha, đặt riêng vào một ô có lề trong suốt, rồi ghi ra
media/assets/world/vfx/floating_damage_glyphs.png.

Chạy lại khi thay ảnh gốc:
    python3 tools/gen-float-damage.py

Yêu cầu: Pillow (chỉ dùng cho công cụ phát triển, không phải phụ thuộc game).
"""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'media/assets/world/vfx/floating_damage.png'
TARGET = ROOT / 'media/assets/world/vfx/floating_damage_glyphs.png'
GLYPHS = '1234567890+-'
ROW_TOP = (77, 304, 529, 756)
ROW_HEIGHT = 195
PAD = 3
ALPHA = 8
MIN_PIXELS = 200


def components(image):
    width, height = image.size
    alpha = image.split()[3].load()
    seen = bytearray(width * height)
    found = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index] or alpha[x, y] <= ALPHA:
                continue
            seen[index] = 1
            queue = deque([(x, y)])
            pixels = []
            while queue:
                cx, cy = queue.popleft()
                pixels.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < width and 0 <= ny < height:
                            ni = ny * width + nx
                            if not seen[ni] and alpha[nx, ny] > ALPHA:
                                seen[ni] = 1
                                queue.append((nx, ny))
            if len(pixels) >= MIN_PIXELS:
                found.append(pixels)
    return found


def main():
    source = Image.open(SOURCE).convert('RGBA')
    pixels = source.load()
    by_row = [[] for _ in ROW_TOP]
    for item in components(source):
        x0 = min(x for x, _ in item)
        y0 = min(y for _, y in item)
        x1 = max(x for x, _ in item)
        y1 = max(y for _, y in item)
        row = min(range(len(ROW_TOP)), key=lambda i: abs(y0 - ROW_TOP[i]))
        by_row[row].append((x0, y0, x1, y1, set(item)))
    for row, items in enumerate(by_row):
        items.sort(key=lambda item: item[0])
        if len(items) != len(GLYPHS):
            raise SystemExit(f'Hàng {row + 1} có {len(items)} glyph, cần {len(GLYPHS)}.')
        if any(item[3] - ROW_TOP[row] >= ROW_HEIGHT for item in items):
            raise SystemExit(f'Hàng {row + 1} tràn khỏi ô dọc.')

    widths = [[item[2] - item[0] + 1 for item in items] for items in by_row]
    row_width = [sum(width + PAD * 2 for width in widths[row]) for row in range(len(ROW_TOP))]
    sheet_w = max(row_width)
    sheet_h = ROW_HEIGHT * len(ROW_TOP)
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    target = sheet.load()

    for row, items in enumerate(by_row):
        cell_x = 0
        top = row * ROW_HEIGHT
        for item, width in zip(items, widths[row]):
            x0, y0, _, _, mask = item
            for x, y in mask:
                if pixels[x, y][3] <= ALPHA:
                    continue
                tx, ty = cell_x + PAD + (x - x0), top + (y - ROW_TOP[row])
                if 0 <= tx < sheet_w and 0 <= ty < sheet_h:
                    target[tx, ty] = pixels[x, y]
            cell_x += width + PAD * 2

    sheet.save(TARGET, optimize=True)
    print(f'{TARGET.relative_to(ROOT)}: {sheet_w}×{sheet_h}, {len(GLYPHS)}×4 glyph')
    print('widths =', widths)


if __name__ == '__main__':
    main()

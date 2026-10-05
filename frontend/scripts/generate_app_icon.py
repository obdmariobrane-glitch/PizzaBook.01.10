from math import hypot
from pathlib import Path
from struct import pack
from zlib import crc32, compress


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "images"
SCALE = 3
SIZE = 1024
CANVAS = SIZE * SCALE


def color(value):
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (255,)


def set_pixel(pixels, x, y, fill):
    if 0 <= x < CANVAS and 0 <= y < CANVAS:
        pixels[y * CANVAS + x] = fill


def inside_polygon(x, y, points):
    is_inside = False
    previous_x, previous_y = points[-1]
    for current_x, current_y in points:
        if (current_y > y) != (previous_y > y):
            crossing = (previous_x - current_x) * (y - current_y) / (previous_y - current_y) + current_x
            if x < crossing:
                is_inside = not is_inside
        previous_x, previous_y = current_x, current_y
    return is_inside


def polygon(pixels, points, fill):
    points = [(x * SCALE, y * SCALE) for x, y in points]
    left = max(0, int(min(x for x, _ in points)) - 2)
    right = min(CANVAS, int(max(x for x, _ in points)) + 2)
    top = max(0, int(min(y for _, y in points)) - 2)
    bottom = min(CANVAS, int(max(y for _, y in points)) + 2)
    for y in range(top, bottom):
        for x in range(left, right):
            if inside_polygon(x + 0.5, y + 0.5, points):
                set_pixel(pixels, x, y, fill)


def ellipse(pixels, bounds, fill):
    left, top, right, bottom = (value * SCALE for value in bounds)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    radius_x = (right - left) / 2
    radius_y = (bottom - top) / 2
    for y in range(max(0, int(top)), min(CANVAS, int(bottom) + 1)):
        for x in range(max(0, int(left)), min(CANVAS, int(right) + 1)):
            if ((x + 0.5 - center_x) / radius_x) ** 2 + ((y + 0.5 - center_y) / radius_y) ** 2 <= 1:
                set_pixel(pixels, x, y, fill)


def rounded_bar(pixels, bounds, fill):
    left, top, right, bottom = bounds
    radius = (bottom - top) / 2
    polygon(pixels, [(left + radius, top), (right - radius, top), (right - radius, bottom), (left + radius, bottom)], fill)
    ellipse(pixels, (left, top, left + radius * 2, bottom), fill)
    ellipse(pixels, (right - radius * 2, top, right, bottom), fill)


def draw_mark(pixels, offset=0, scale=1):
    def point(x, y):
        return (offset + x * scale, offset + y * scale)

    def bounds(left, top, right, bottom):
        return tuple(offset + value * scale for value in (left, top, right, bottom))

    outline = color("#3C1F18")
    crust = color("#B85A24")
    crust_highlight = color("#F1A24A")
    sauce = color("#B83225")
    cheese = color("#FFE2A4")
    pepperoni = color("#8F241F")
    pepperoni_highlight = color("#D65A35")
    basil = color("#28543E")

    outer_slice = [point(214, 285), point(786, 285), point(500, 820)]
    polygon(pixels, outer_slice, outline)
    inner_slice = [point(250, 320), point(750, 320), point(500, 770)]
    polygon(pixels, inner_slice, sauce)
    cheese_slice = [point(280, 335), point(720, 335), point(500, 730)]
    polygon(pixels, cheese_slice, cheese)

    rounded_bar(pixels, (190 * scale + offset, 230 * scale + offset, 810 * scale + offset, 350 * scale + offset), outline)
    rounded_bar(pixels, (208 * scale + offset, 244 * scale + offset, 792 * scale + offset, 338 * scale + offset), crust)
    rounded_bar(pixels, (238 * scale + offset, 258 * scale + offset, 762 * scale + offset, 308 * scale + offset), crust_highlight)

    for center_x, center_y, radius in ((390, 430, 42), (570, 470, 46), (475, 585, 42), (615, 625, 38)):
        ellipse(pixels, bounds(center_x - radius, center_y - radius, center_x + radius, center_y + radius), pepperoni)
        ellipse(pixels, bounds(center_x - radius * 0.45, center_y - radius * 0.55, center_x - radius * 0.05, center_y - radius * 0.2), pepperoni_highlight)

    polygon(pixels, [point(380, 535), point(424, 515), point(447, 536), point(408, 574)], basil)
    polygon(pixels, [point(561, 565), point(596, 540), point(621, 562), point(580, 598)], basil)


def downsample(pixels):
    output = []
    for y in range(SIZE):
        for x in range(SIZE):
            samples = [pixels[(y * SCALE + sample_y) * CANVAS + x * SCALE + sample_x] for sample_y in range(SCALE) for sample_x in range(SCALE)]
            output.append(tuple(sum(sample[channel] for sample in samples) // len(samples) for channel in range(4)))
    return output


def write_png(path, pixels, transparent=False):
    rows = []
    for y in range(SIZE):
        row = bytearray([0])
        for pixel in pixels[y * SIZE:(y + 1) * SIZE]:
            row.extend(pixel if not transparent else pixel[:3] + (pixel[3],))
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(kind, data):
        return pack(">I", len(data)) + kind + data + pack(">I", crc32(kind + data) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)) + chunk(b"IDAT", compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def create_icon(background):
    pixels = [background] * (CANVAS * CANVAS)
    draw_mark(pixels)
    return downsample(pixels)


def create_foreground():
    pixels = [(0, 0, 0, 0)] * (CANVAS * CANVAS)
    draw_mark(pixels, offset=120, scale=0.68)
    return downsample(pixels)


OUTPUT.mkdir(parents=True, exist_ok=True)
write_png(OUTPUT / "icon.png", create_icon(color("#D15900")))
write_png(OUTPUT / "adaptive-icon.png", create_foreground(), transparent=True)
write_png(OUTPUT / "favicon.png", create_icon(color("#D15900")))
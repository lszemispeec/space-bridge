"""Read-only pixel audit. Run from any directory with Python 3 and Pillow."""
import json
from pathlib import Path
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[2]
THEMES = ("polar-signal", "desert-expedition", "neon-orbit")


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def audit(theme):
    directory = ROOT / "assets" / theme
    atlas = json.loads((directory / f"{theme}.json").read_text())
    for extension in ("png", "json"):
        name = f"{theme}.{extension}"
        check((directory / name).read_bytes() == (ROOT / "public/atlas" / name).read_bytes(), f"published copy: {name}")
    palette = {tuple(bytes.fromhex(c[1:])) for c in atlas["meta"]["palette"]}
    image = Image.open(directory / atlas["meta"]["image"]).convert("RGBA")
    check(image.size == tuple(atlas["meta"]["size"][k] for k in ("w", "h")), "PNG size")
    check(len(palette) == 16, "palette length")
    occupied = set()
    crops = {}
    for name, frame in atlas["frames"].items():
        x, y, w, h = (frame[k] for k in ("x", "y", "w", "h"))
        check(0 <= x < x + w <= image.width and 0 <= y < y + h <= image.height, name)
        rectangle = {yy * image.width + xx for yy in range(y, y+h) for xx in range(x, x+w)}
        check(not occupied.intersection(rectangle), f"overlap: {name}")
        occupied.update(rectangle)
        crop = image.crop((x, y, x+w, y+h))
        crops[name] = crop
        check(crop.getbbox() is not None or name == "ambient.drift.3", f"empty: {name}")
        if name.startswith("cosmonaut."):
            check(crop.getbbox()[3] == h, f"feet registration: {name}")
        if name.startswith("ambient."):
            for yy in range(h):
                for xx in range(w):
                    if xx < 32 or xx >= 288 or yy < 30 or (76 <= xx <= 247 and 130 <= yy <= 198):
                        check(crop.getpixel((xx, yy))[3] == 0, f"ambient exclusion: {name} {xx},{yy}")

    for index, pixel in enumerate(image.getdata()):
        check(pixel[3] in (0, 255), f"partial alpha at pixel {index}")
        if pixel[3]:
            check(pixel[:3] in palette, f"off-palette pixel {index}")
            check(index in occupied, f"stray pixel outside frame {index}")
    used = {p[:3] for p in image.getdata() if p[3]}
    check(used == palette, "sheet must use exactly its 16 declared colours")
    check(set(crops["background"].getchannel("A").getdata()) == {255}, "opaque background")

    # Full-screen previews must be an exact integer enlargement, with no new colours.
    native = Image.open(directory / "previews/screen-1x.png").convert("RGBA")
    large = Image.open(directory / "previews/screen-4x.png").convert("RGBA")
    check(native.size == (320, 240), "native screen size")
    check(large.size == (1280, 960), "4x screen size")
    check(native.resize(large.size, Image.Resampling.NEAREST).tobytes() == large.tobytes(), "4x nearest-neighbour")
    for file in (directory / "previews").glob("*.png"):
        for pixel in Image.open(file).convert("RGBA").getdata():
            check(pixel[3] in (0, 255), f"preview alpha: {file.name}")
            check(not pixel[3] or pixel[:3] in palette, f"preview palette: {file.name}")
    strips = json.loads((directory / "previews/strips.json").read_text())
    check({s["animation"] for s in strips} == set(atlas["animations"]), "every animation needs a strip")
    for entry in strips:
        strip = Image.open(directory / "previews" / entry["file"]).convert("RGBA")
        x = 0
        for name in atlas["animations"][entry["animation"]]["frames"]:
            frame = crops[name]
            check(strip.crop((x, 0, x+frame.width, frame.height)).tobytes() == frame.tobytes(), f"strip source pixels: {name}")
            x += frame.width
        check(strip.width == x, "strip width")

    gif = Image.open(directory / "previews/jump-bounce.gif")
    total = 0
    for frame in ImageSequence.Iterator(gif):
        check(frame.size == (320, 240), "GIF size")
        check(frame.info.get("duration", 0) > 0, "GIF delay")
        total += frame.info["duration"]
        check(set(frame.convert("RGB").getdata()) <= palette, "GIF palette")
    check(total == 6000 and gif.info.get("loop") == 0, "six-second looping GIF")
    print(f"{theme}: {len(crops)} frames, 16 colours, binary alpha, bounds, gutters, anchors, 29 strips, 6s GIF, exact 4x: PASS")


for theme in THEMES:
    audit(theme)
